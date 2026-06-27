"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Application {
  id: string;
  company_name: string;
  jd_text: string;
  status: string;
  draft_subject: string | null;
  draft_body: string | null;
  contacts: { name: string | null; email: string; company_name: string } | null;
}

export default function ApplicationDetail({ initial }: { initial: Application }) {
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [subject, setSubject] = useState(initial.draft_subject ?? "");
  const [body, setBody] = useState(initial.draft_body ?? "");
  const [busy, setBusy] = useState<"draft" | "save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateDraft() {
    setBusy("draft");
    setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApp(data.application);
      setSubject(data.application.draft_subject);
      setBody(data.application.draft_body);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_subject: subject, draft_body: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApp(data.application);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (!confirm(`Send this email to ${app.contacts?.email}? This can't be undone.`)) {
      return;
    }
    setBusy("send");
    setError(null);
    try {
      await saveEditsSilently();
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApp(data.application);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  // Make sure any unsaved edits go out before sending.
  async function saveEditsSilently() {
    await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_subject: subject, draft_body: body }),
    });
  }

  const hasDraft = Boolean(app.draft_subject && app.draft_body);
  const isSent = ["sent", "opened", "replied", "follow_up_sent", "closed"].includes(
    app.status
  );

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-widest text-muted mb-1">
        {app.status.replaceAll("_", " ")}
      </p>
      <h1 className="font-display text-3xl mb-1">{app.company_name}</h1>
      <p className="text-sm text-muted mb-8">
        {app.contacts?.name ? `${app.contacts.name} · ` : ""}
        {app.contacts?.email}
      </p>

      <details className="mb-8 border border-line rounded-sm">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium">
          Job description
        </summary>
        <p className="px-4 pb-4 text-sm text-muted whitespace-pre-wrap">{app.jd_text}</p>
      </details>

      {!hasDraft ? (
        <button
          onClick={generateDraft}
          disabled={busy !== null}
          className="bg-ink text-paper px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-moss disabled:opacity-50 transition-colors"
        >
          {busy === "draft" ? "Drafting…" : "Generate draft"}
        </button>
      ) : (
        <div className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSent}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white disabled:bg-line/40"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Body</span>
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSent}
              className="w-full border border-line rounded-sm px-3 py-2 bg-white disabled:bg-line/40"
            />
          </label>

          {error && <p className="text-sm text-clay">{error}</p>}

          {!isSent && (
            <div className="flex gap-3">
              <button
                onClick={saveEdits}
                disabled={busy !== null}
                className="border border-line px-4 py-2 rounded-sm text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
              >
                {busy === "save" ? "Saving…" : "Save edits"}
              </button>
              <button
                onClick={generateDraft}
                disabled={busy !== null}
                className="border border-line px-4 py-2 rounded-sm text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={approveAndSend}
                disabled={busy !== null}
                className="bg-moss text-paper px-4 py-2 rounded-sm text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {busy === "send" ? "Sending…" : "Approve & send"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
