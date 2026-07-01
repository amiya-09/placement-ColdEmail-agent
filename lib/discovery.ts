import filterConfig from "@/config/filters";
import { fetchAdzunaJobs, AdzunaJob } from "@/lib/adzuna";
import { getSupabaseServer } from "@/lib/supabase";

export interface DiscoverySummary {
  fetched: number;   // raw results from Adzuna (after cross-request deduplication)
  skipped: number;   // already in postings table — not reprocessed
  rejected: number;  // failed at least one hard filter
  scored: number;    // passed all filters and received a Stage 1 score
}

// --- Hard filter + Stage 1 scoring ----------------------------------------

function buildRow(
  job: AdzunaJob,
  status: string,
  rejectReason: string | null,
  stage1Score: number | null
) {
  return {
    external_id: job.id,
    source: "adzuna" as const,
    company_name: job.company?.display_name ?? "Unknown",
    title: job.title,
    jd_text: job.description ?? null,
    location: job.location?.display_name ?? null,
    apply_url: job.redirect_url ?? null,
    // "created" is an ISO 8601 timestamp; take only the date part for posted_date.
    posted_date: job.created ? job.created.slice(0, 10) : null,
    status,
    reject_reason: rejectReason,
    stage1_score: stage1Score,
  };
}

// Fuzzy-ish company match: "Razorpay" matches "Razorpay Software Pvt Ltd" and vice versa.
function companyMatches(postingName: string, watchlistName: string): boolean {
  const a = postingName.toLowerCase();
  const b = watchlistName.toLowerCase();
  return a.includes(b) || b.includes(a);
}

// ---------------------------------------------------------------------------

export async function runDiscovery(): Promise<DiscoverySummary> {
  const cfg = filterConfig;
  const supabase = getSupabaseServer();

  // 1. Fetch raw jobs from Adzuna.
  const jobs = await fetchAdzunaJobs({
    keywords: cfg.role_keywords.include,
    locations: cfg.locations.include,
    maxDaysOld: cfg.posting_age_max_days,
    resultsPerPage: cfg.results_per_fetch,
  });

  // 2. Load the set of external_ids already in the DB so we can skip them.
  const { data: existingRows } = await supabase
    .from("postings")
    .select("external_id")
    .eq("source", "adzuna");
  const existingIds = new Set((existingRows ?? []).map((r) => r.external_id));

  // 3. Load the target company watch-list (names + last_contacted_at).
  const { data: watchlistRows } = await supabase
    .from("target_companies")
    .select("company_name, last_contacted_at");
  const watchlist = watchlistRows ?? [];

  // 4. Determine which companies are in cooldown.
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cfg.company_cooldown_days);
  const cooledDown = watchlist.filter(
    (w) => w.last_contacted_at && new Date(w.last_contacted_at) > cooldownCutoff
  );

  const now = new Date();
  const includeKws = cfg.role_keywords.include.map((k) => k.toLowerCase());
  const excludeKws = cfg.role_keywords.exclude.map((k) => k.toLowerCase());

  let skipped = 0;
  let rejected = 0;
  let scored = 0;

  const toInsert: ReturnType<typeof buildRow>[] = [];

  for (const job of jobs) {
    // Skip jobs already in the DB — don't reprocess or overwrite existing rows.
    if (existingIds.has(job.id)) {
      skipped++;
      continue;
    }

    const titleLower = job.title.toLowerCase();
    const textLower = titleLower + " " + (job.description ?? "").toLowerCase();
    const companyName = job.company?.display_name ?? "Unknown";

    // --- Hard filter: excluded keyword in title ---
    const excludeHit = excludeKws.find((kw) => titleLower.includes(kw));
    if (excludeHit) {
      toInsert.push(buildRow(job, "hard_rejected", `exclude_keyword:${excludeHit}`, null));
      rejected++;
      continue;
    }

    // --- Hard filter: posting age ---
    const postedAt = new Date(job.created);
    const daysOld = (now.getTime() - postedAt.getTime()) / 86_400_000;
    if (daysOld > cfg.posting_age_max_days) {
      toInsert.push(buildRow(job, "hard_rejected", "too_old", null));
      rejected++;
      continue;
    }

    // Location filter intentionally omitted — open to any location.
    // locations.include in config still scopes the Adzuna API queries.

    // --- Hard filter: company cooldown ---
    const inCooldown = cooledDown.some((w) => companyMatches(companyName, w.company_name));
    if (inCooldown) {
      toInsert.push(buildRow(job, "hard_rejected", "cooldown", null));
      rejected++;
      continue;
    }

    // --- Stage 1 scoring (only postings that pass all hard filters) ---

    // keyword_score: % of include keywords found anywhere in title + description snippet
    const matchedKws = includeKws.filter((kw) => textLower.includes(kw));
    const keyword_score = (matchedKws.length / includeKws.length) * 100;

    // recency_score: linear decay from 100 (today) to 0 (posting_age_max_days)
    const recency_score = Math.max(0, (1 - daysOld / cfg.posting_age_max_days) * 100);

    // watchlist_bonus: 100 if company fuzzy-matches any target_companies row, else 0
    const onWatchlist = watchlist.some((w) => companyMatches(companyName, w.company_name));
    const watchlist_bonus = onWatchlist ? 100 : 0;

    const stage1_score =
      0.5 * keyword_score + 0.3 * recency_score + 0.2 * watchlist_bonus;

    toInsert.push(
      buildRow(job, "scored", null, parseFloat(stage1_score.toFixed(2)))
    );
    scored++;
  }

  // 5. Batch-insert all processed rows.
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("postings")
      .upsert(toInsert, { onConflict: "source,external_id", ignoreDuplicates: false });
    if (error) throw new Error(`Failed to save postings: ${error.message}`);
  }

  return { fetched: jobs.length, skipped, rejected, scored };
}
