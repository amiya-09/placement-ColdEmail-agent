// Hand-edit this file to tune the discovery pipeline.
// Changes take effect on the next "Discover now" run — no redeploy needed locally.
// On Vercel, a redeploy is required after editing (it's compiled in at build time).

export interface FilterConfig {
  role_keywords: {
    // Adzuna `what` is built from each include keyword (one API call per keyword).
    // Stage 1 keyword_score = % of these found in the job title + description.
    include: string[];
    // Any job whose title contains one of these is immediately hard-rejected.
    exclude: string[];
  };
  locations: {
    // Job's location.display_name must contain at least one of these (case-insensitive).
    include: string[];
    // If true, jobs with "remote" in their location or title pass the location filter.
    remote_ok: boolean;
  };
  // Jobs older than this many days are hard-rejected.
  posting_age_max_days: number;
  // If a company in target_companies has last_contacted_at within this many days,
  // any posting from them is hard-rejected with reason "cooldown".
  company_cooldown_days: number;
  // Number of results requested per Adzuna API call (one call per keyword × location).
  results_per_fetch: number;
}

const filterConfig: FilterConfig = {
  role_keywords: {
    include: [
      "software engineer",
      "SDE",
      "backend developer",
      "full stack developer",
    ],
    exclude: [
      "senior",
      "staff",
      "2",
      "principal",
      "lead",
      "manager",
    ],
  },
  locations: {
    include: ["Bangalore", "Delhi NCR", "Gurgaon", "Mumbai", "Hyderabad", "Lucknow", "Gurugram", "Chennai", "Ahmedabad"],
    remote_ok: false,
  },
  posting_age_max_days: 14,
  company_cooldown_days: 60,
  results_per_fetch: 50,
};

export default filterConfig;
