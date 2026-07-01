// Adzuna Jobs Search API — country code "in" (India).
// Docs: https://developer.adzuna.com/docs/search
// Response shape confirmed from live API: top-level { count, results[] }
// Each result: { id, title, description, company.display_name,
//                location.display_name, location.area, redirect_url, created }

const BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1";

export interface AdzunaJob {
  id: string;
  title: string;
  description: string;                         // snippet only, not the full JD
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  redirect_url: string;
  created: string;                             // ISO 8601 timestamp
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
}

interface AdzunaResponse {
  count: number;
  results: AdzunaJob[];
}

export async function fetchAdzunaJobs({
  keywords,
  locations,
  maxDaysOld,
  resultsPerPage,
}: {
  keywords: string[];
  locations: string[];
  maxDaysOld: number;
  resultsPerPage: number;
}): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY env vars");
  }

  const seen = new Set<string>();
  const collected: AdzunaJob[] = [];

  // One request per (keyword, location) pair to cover each target city.
  // Results are deduplicated by job id across all requests.
  for (const keyword of keywords) {
    for (const location of locations) {
      const url = new URL(BASE_URL);
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("results_per_page", String(resultsPerPage));
      url.searchParams.set("what", keyword);
      url.searchParams.set("where", location);
      url.searchParams.set("max_days_old", String(maxDaysOld));
      url.searchParams.set("content-type", "application/json");

      const res = await fetch(url.toString(), { cache: "no-store" });

      if (!res.ok) {
        // Log and skip — one bad (keyword, location) pair shouldn't abort the run.
        console.error(
          `[adzuna] ${res.status} for keyword="${keyword}" location="${location}"`
        );
        continue;
      }

      const data: AdzunaResponse = await res.json();
      for (const job of data.results ?? []) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          collected.push(job);
        }
      }
    }
  }

  return collected;
}
