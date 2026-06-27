import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import CheckRepliesButton from "./CheckRepliesButton";

const STATUS_COLOR: Record<string, string> = {
  new: "#A8A6A0",
  drafted: "#A8552E",
  sent: "#6B6A63",
  opened: "#3D6B82",
  replied: "#3F5B47",
  follow_up_sent: "#8A6D3B",
  closed: "#1C1B19",
};

const STATUS_ORDER = ["new", "drafted", "sent", "opened", "replied", "follow_up_sent", "closed"];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = getSupabaseServer();
  const { data: applications } = await supabase
    .from("applications")
    .select("*, contacts(name, email, company_name)")
    .order("created_at", { ascending: false });

  const apps = applications ?? [];
  const rawCounts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  // Sort by pipeline order so the summary bar reads left-to-right by stage.
  const counts = STATUS_ORDER
    .filter((s) => s in rawCounts)
    .map((s) => [s, rawCounts[s]] as [string, number]);

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
            Queue
          </p>
          <h1 className="font-display text-3xl">Applications</h1>
        </div>
        <div className="flex gap-3">
          <CheckRepliesButton />
          <Link
            href="/new"
            className="bg-ink text-paper px-4 py-2 rounded-sm text-sm font-medium hover:bg-moss transition-colors"
          >
            + New application
          </Link>
        </div>
      </div>

      <div className="flex gap-6 mb-8 font-mono text-xs uppercase tracking-wide text-muted">
        {counts.map(([status, n]) => (
          <span key={status} className="flex items-center gap-2">
            <span
              className="status-dot"
              style={
                status === "opened"
                  ? { backgroundColor: "transparent", border: "1.5px solid #6B6A63", boxSizing: "border-box" }
                  : { backgroundColor: STATUS_COLOR[status] ?? "#A8A6A0" }
              }
            />
            <span title={status === "opened" ? "Gmail can prefetch images on delivery, so this isn't a reliable signal that the email was actually read" : undefined}>
              {status.replaceAll("_", " ")}
              {status === "opened" && <span className="normal-case tracking-normal ml-1 opacity-60">(unreliable)</span>}
            </span>
            {" · "}{n}
          </span>
        ))}
      </div>

      {apps.length === 0 ? (
        <div className="border border-line rounded-sm p-10 text-center text-muted">
          <p className="mb-4">No applications yet.</p>
          <Link href="/new" className="underline hover:text-ink">
            Add your first one
          </Link>
        </div>
      ) : (
        <div className="border border-line rounded-sm divide-y divide-line">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/applications/${app.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="status-dot"
                  style={
                    app.status === "opened"
                      ? { backgroundColor: "transparent", border: "1.5px solid #6B6A63", boxSizing: "border-box" }
                      : { backgroundColor: STATUS_COLOR[app.status] ?? "#A8A6A0" }
                  }
                />
                <div>
                  <p className="font-medium">{app.company_name}</p>
                  <p className="text-sm text-muted">
                    {app.contacts?.name || app.contacts?.email || "no contact"}
                  </p>
                </div>
              </div>
              <span
                className="font-mono text-xs uppercase tracking-wide text-muted"
                title={app.status === "opened" ? "Gmail can prefetch images on delivery, so this isn't a reliable signal that the email was actually read" : undefined}
              >
                {app.status.replaceAll("_", " ")}
                {app.status === "opened" && <span className="normal-case tracking-normal ml-1 opacity-60">(unreliable)</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
