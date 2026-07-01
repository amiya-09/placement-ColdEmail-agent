import { getSupabaseServer } from "@/lib/supabase";

export type ContactSource =
  | "contacts_table"
  | "apollo"
  | "hunter"
  | "generic_guess";

export interface ResolvedContact {
  found: true;
  email: string;
  name: string | null;
  source: ContactSource;
}

export interface ContactNotFound {
  found: false;
}

export type ContactResult = ResolvedContact | ContactNotFound;

// --- helpers ----------------------------------------------------------------

const RECRUITER_KEYWORDS = [
  "recruit", "talent", "hiring", "hr", "human resource", "people ops",
  "people partner", "ta ", "t.a.", "staffing",
];

function isRecruiterTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return RECRUITER_KEYWORDS.some((kw) => t.includes(kw));
}

// Strip common legal suffixes and non-alphanumeric chars to make a bare domain slug.
function domainSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(
      /\b(inc|llc|ltd|limited|pvt|private|corp|corporation|co|technologies|technology|solutions|services|software|systems|group|global)\b\.?/gi,
      ""
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

// --- step 1: contacts table -------------------------------------------------

async function lookupTable(companyName: string): Promise<ResolvedContact | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("contacts")
    .select("email, name")
    .ilike("company_name", `%${companyName}%`)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();

  if (data?.email) {
    return { found: true, email: data.email, name: data.name ?? null, source: "contacts_table" };
  }
  return null;
}

// --- step 2: Apollo (org domain → people search → enrichment) ---------------
// Free tier often blocks people/match (enrichment). We try anyway and fall
// through silently on any error or empty result.

async function lookupApollo(companyName: string): Promise<{ domain: string | null; contact: ResolvedContact | null }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { domain: null, contact: null };

  try {
    // 2a. Org search → primary domain
    const orgRes = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ q_organization_name: companyName, page: 1, per_page: 1 }),
    });
    if (!orgRes.ok) return { domain: null, contact: null };
    const orgData = await orgRes.json();
    const domain: string | null = orgData.organizations?.[0]?.primary_domain ?? null;

    if (!domain) return { domain: null, contact: null };

    // 2b. People search by domain + recruiter titles (returns names, not emails on free tier)
    const peopleRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        q_organization_domains_list: [domain],
        person_titles: ["recruiter", "talent acquisition", "hr manager", "hiring manager", "talent partner"],
        page: 1,
        per_page: 5,
      }),
    });
    if (!peopleRes.ok) return { domain, contact: null };
    const peopleData = await peopleRes.json();
    const person = (peopleData.people ?? []).find((p: any) => p.has_email);
    if (!person) return { domain, contact: null };

    // 2c. People enrichment to get actual email (restricted on free tier — catch gracefully)
    const enrichRes = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ id: person.id, reveal_personal_emails: false }),
    });
    if (!enrichRes.ok) return { domain, contact: null };
    const enrichData = await enrichRes.json();
    const email: string | null = enrichData.person?.email ?? null;
    if (!email) return { domain, contact: null };

    const name = [person.first_name, enrichData.person?.last_name].filter(Boolean).join(" ") || null;
    return { domain, contact: { found: true, email, name, source: "apollo" } };
  } catch {
    return { domain: null, contact: null };
  }
}

// --- step 3: Hunter.io domain-search ----------------------------------------

async function lookupHunter(
  companyName: string,
  domain: string | null
): Promise<ResolvedContact | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    // Prefer domain (from Apollo) for precision; fall back to company name auto-resolve.
    if (domain) {
      url.searchParams.set("domain", domain);
    } else {
      url.searchParams.set("company", companyName);
    }
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const emails: any[] = data.data?.emails ?? [];
    if (emails.length === 0) return null;

    // Prefer recruiter/HR emails; otherwise take highest-confidence entry.
    const recruiterEmails = emails.filter((e) => isRecruiterTitle(e.position));
    const pool = recruiterEmails.length > 0 ? recruiterEmails : emails;
    const best = pool.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (!best?.value) return null;

    const name = [best.first_name, best.last_name].filter(Boolean).join(" ") || null;
    return { found: true, email: best.value, name, source: "hunter" };
  } catch {
    return null;
  }
}

// --- step 4: generic guess --------------------------------------------------

function genericGuess(companyName: string): ResolvedContact {
  return {
    found: true,
    email: `careers@${domainSlug(companyName)}.com`,
    name: null,
    source: "generic_guess",
  };
}

// --- save newly-found contact to contacts table for reuse -------------------

async function saveContact(companyName: string, contact: ResolvedContact): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from("contacts").insert({
    company_name: companyName,
    email: contact.email,
    name: contact.name ?? null,
    source: contact.source,
  });
}

// --- public API -------------------------------------------------------------

export async function resolveContact(companyName: string): Promise<ContactResult> {
  // 1. Contacts table
  const fromTable = await lookupTable(companyName);
  if (fromTable) return fromTable;

  // 2. Apollo (domain + people + enrichment)
  const { domain, contact: apolloContact } = await lookupApollo(companyName);
  if (apolloContact) {
    await saveContact(companyName, apolloContact);
    return apolloContact;
  }

  // 3. Hunter.io (pass Apollo domain for precision, or company name as fallback)
  const fromHunter = await lookupHunter(companyName, domain);
  if (fromHunter) {
    await saveContact(companyName, fromHunter);
    return fromHunter;
  }

  // 4. Generic guess (careers@cleanname.com)
  return genericGuess(companyName);
}
