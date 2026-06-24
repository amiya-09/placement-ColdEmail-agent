"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Profile {
  id: string;
  name: string;
  resume_label: string;
  resume_text: string;
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupContent />
    </Suspense>
  );
}

function SetupContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const oauthError = searchParams.get("error");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    name: "",
    resumeLabel: "",
    resumeText: "",
    skills: "",
    targetRoles: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          resumeLabel: form.resumeLabel,
          resumeText: form.resumeText,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          targetRoles: form.targetRoles.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const refreshed = await fetch("/api/profile").then((r) => r.json());
      setProfiles(refreshed.profiles ?? []);
      setForm({ name: form.name, resumeLabel: "", resumeText: "", skills: "", targetRoles: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
          Setup
        </p>
        <h1 className="font-display text-3xl mb-6">Gmail connection</h1>

        {connected && (
          <p className="text-sm text-moss mb-4">Connected as {connected}</p>
        )}
        {oauthError && (
          <p className="text-sm text-clay mb-4">Connection failed: {oauthError}</p>
        )}

        <a
          href="/api/auth/google"
          className="inline-block bg-ink text-paper px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-moss transition-colors"
        >
          Connect Gmail
        </a>
        <p className="text-xs text-muted mt-3">
          Opens Google's consent screen. You'll see an "unverified app" warning —
          that's expected since you're the only user; click through it.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-6">Resume versions</h2>

        {profiles.length > 0 && (
          <ul className="mb-6 text-sm text-muted space-y-1">
            {profiles.map((p) => (
              <li key={p.id}>
                <span className="font-mono">{p.resume_label}</span> — {p.name}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Your name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">
              Resume label (used as a key — pick something short and unique)
            </span>
            <input
              required
              value={form.resumeLabel}
              onChange={(e) => setForm((f) => ({ ...f, resumeLabel: e.target.value }))}
              placeholder="e.g. SWE-general"
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">
              Resume bullets (plain text, this is what the AI reads to draft emails)
            </span>
            <textarea
              required
              rows={8}
              value={form.resumeText}
              onChange={(e) => setForm((f) => ({ ...f, resumeText: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Skills (comma separated)</span>
            <input
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">
              Target roles (comma separated)
            </span>
            <input
              value={form.targetRoles}
              onChange={(e) => setForm((f) => ({ ...f, targetRoles: e.target.value }))}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            />
          </label>

          {error && <p className="text-sm text-clay">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-ink text-paper px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-moss disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save resume version"}
          </button>
        </form>
      </section>
    </div>
  );
}
