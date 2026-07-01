"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ScoredPosting {
  id: string;
  company_name: string;
  title: string;
  location: string | null;
  apply_url: string | null;
  jd_text: string | null;
  stage1_score: number;
  posted_date: string | null;
  discovered_at: string;
}

interface RejectedPosting {
  id: string;
  company_name: string;
  title: string;
  location: string | null;
  reject_reason: string | null;
}

interface RunSummary {
  fetched: number;
  skipped: number;
  rejected: number;
  scored: number;
}

export default function DiscoverPage() {
  const router = useRouter();

  const [scored, setScored] = useState<ScoredPosting[]>([]);
  const [rejected, setRejected] = useState<RejectedPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  async function loadPostings() {
    const res = await fetch("/api/postings");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setScored(data.scored ?? []);
    setRejected(data.rejected ?? []);
  }

  useEffect(() => {
    loadPostings()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDiscover() {
    setRunning(true);
    setError(null);
    setRunSummary(null);
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunSummary(data);
      await loadPostings();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  // Pre-fill /new with company name and JD snippet from the posting, then navigate.
  function handleCreateApplication(posting: ScoredPosting) {
    setCreatingFor(posting.id);
    const params = new URLSearchParams({
      company: posting.company_name,
      ...(posting.jd_text ? { jd: posting.jd_text } : {}),
    });
    router.push(`/new?${params.toString()}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
            Phase 2
          </p>
          <h1 className="font-display text-3xl">Discovery</h1>
        </div>
        <button
          onClick={handleDiscover}
          disabled={running}
          className="bg-ink text-paper px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-moss disabled:opacity-50 transition-colors"
        >
          {running ? "Discovering…" : "Discover now"}
        </button>
      </div>

      {/* Run summary */}
      {runSummary && (
        <p className="font-mono text-xs uppercase tracking-wide text-muted mb-8">
          Fetched {runSummary.fetched} · Skipped {runSummary.skipped} · Scored{" "}
          {runSummary.scored} · Rejected {runSummary.rejected}
        </p>
      )}

      {error && <p className="text-sm text-clay mb-6">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {/* Scored postings */}
          {scored.length === 0 ? (
            <div className="border border-line rounded-sm p-10 text-center text-muted mb-8">
              <p>No scored postings yet — run a discovery pass first.</p>
            </div>
          ) : (
            <div className="border border-line rounded-sm divide-y divide-line mb-8">
              {scored.map((p) => (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.company_name}</p>
                      <p className="text-sm text-muted truncate">{p.title}</p>
                      {p.location && (
                        <p className="text-xs text-muted mt-0.5">{p.location}</p>
                      )}
                    </div>
                    <span className="font-mono text-sm shrink-0 text-moss">
                      {p.stage1_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-3">
                    {p.apply_url && (
                      <a
                        href={p.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-line px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-white transition-colors"
                      >
                        View posting ↗
                      </a>
                    )}
                    <button
                      onClick={() => handleCreateApplication(p)}
                      disabled={creatingFor === p.id}
                      className="bg-ink text-paper px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-moss disabled:opacity-50 transition-colors"
                    >
                      {creatingFor === p.id ? "Opening…" : "Create application"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rejected — collapsible */}
          {rejected.length > 0 && (
            <div className="border border-line rounded-sm">
              <button
                onClick={() => setRejectedOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-white/60 transition-colors"
              >
                <span>
                  {rejected.length} hard-rejected posting
                  {rejected.length === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-muted text-xs">
                  {rejectedOpen ? "▲ hide" : "▼ show"}
                </span>
              </button>
              {rejectedOpen && (
                <div className="divide-y divide-line border-t border-line">
                  {rejected.map((p) => (
                    <div
                      key={p.id}
                      className="px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{p.company_name}</span>
                          {" — "}
                          {p.title}
                        </p>
                        {p.location && (
                          <p className="text-xs text-muted mt-0.5">{p.location}</p>
                        )}
                      </div>
                      <span className="font-mono text-xs text-clay shrink-0">
                        {p.reject_reason ?? "rejected"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
