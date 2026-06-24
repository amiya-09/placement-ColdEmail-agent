"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewApplicationPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    jdText: "",
    contactName: "",
    contactEmail: "",
    resumeLabel: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
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
          <Field label="Recruiter email">
            <input
              required
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white"
              placeholder="name@company.com"
            />
          </Field>
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
