"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewApplicationPage() {
  return (
    <Suspense fallback={null}>
      <NewApplicationContent />
    </Suspense>
  );
}

function NewApplicationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    companyName: "",
    jdText: "",
    contactName: "",
    contactEmail: "",
    resumeLabel: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveSource, setResolveSource] = useState<string | null>(null);

  // Pre-fill from ?company= and ?jd= when arriving from the Discover page.
  useEffect(() => {
    const company = searchParams.get("company");
    const jd = searchParams.get("jd");
    if (company || jd) {
      setForm((f) => ({
        ...f,
        ...(company ? { companyName: company } : {}),
        ...(jd ? { jdText: jd } : {}),
      }));
    }
  }, [searchParams]);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const RESOLVE_LABELS: Record<string, string> = {
    contacts_table: "Found in saved contacts",
    apollo: "Found via Apollo",
    hunter: "Found via Hunter.io",
    generic_guess: "Generic guess — verify before sending",
    not_found: "Not found — enter manually",
  };

  async function handleResolve() {
    if (!form.companyName) return;
    setResolving(true);
    setResolveSource(null);
    try {
      const res = await fetch("/api/contacts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: form.companyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resolve failed");
      if (data.found) {
        setForm((f) => ({
          ...f,
          contactEmail: data.email,
          ...(data.name ? { contactName: data.name } : {}),
        }));
        setResolveSource(data.source);
      } else {
        setResolveSource("not_found");
      }
    } catch {
      setResolveSource("not_found");
    } finally {
      setResolving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create application");
      router.push(`/applications/${data.application.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
        New
      </p>
      <h1 className="font-display text-3xl mb-8">Add an application</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Company name">
          <input
            required
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            placeholder="e.g. Razorpay"
          />
        </Field>

        <Field label="Job description">
          <textarea
            required
            rows={8}
            value={form.jdText}
            onChange={(e) => update("jdText", e.target.value)}
            className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            placeholder="Paste the JD text here"
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Recruiter name (optional)">
            <input
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
              placeholder="Leave blank if unknown"
            />
          </Field>
          <div>
            <span className="block text-sm font-medium mb-1.5">Recruiter email</span>
            <div className="flex gap-2">
              <input
                required
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                className="flex-1 min-w-0 border border-line rounded-sm px-3 py-2 bg-white"
                placeholder="name@company.com"
              />
              <button
                type="button"
                onClick={handleResolve}
                disabled={resolving || !form.companyName}
                title={form.companyName ? "Auto-find a recruiter email" : "Enter a company name first"}
                className="border border-line px-3 py-2 rounded-sm text-xs font-medium hover:bg-white disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {resolving ? "Finding…" : "Find contact"}
              </button>
            </div>
            {resolveSource && (
              <p className={`text-xs mt-1.5 ${resolveSource === "not_found" || resolveSource === "generic_guess" ? "text-clay" : "text-muted"}`}>
                {RESOLVE_LABELS[resolveSource] ?? resolveSource}
              </p>
            )}
          </div>
        </div>

        <Field label="Resume version (optional)">
          <input
            value={form.resumeLabel}
            onChange={(e) => update("resumeLabel", e.target.value)}
            className="w-full border border-line rounded-sm px-3 py-2 bg-white"
            placeholder="Leave blank to auto-pick your only saved resume"
          />
        </Field>

        {error && <p className="text-sm text-clay">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-ink text-paper px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-moss disabled:opacity-50 transition-colors"
        >
          {submitting ? "Adding…" : "Add application"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}
