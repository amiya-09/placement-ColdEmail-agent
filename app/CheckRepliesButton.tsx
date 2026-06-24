"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckRepliesButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheck() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/replies/check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setMessage(
        data.repliesFound > 0
          ? `${data.repliesFound} new repl${data.repliesFound === 1 ? "y" : "ies"} found`
          : "No new replies"
      );
      router.refresh();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-muted">{message}</span>}
      <button
        onClick={handleCheck}
        disabled={loading}
        className="border border-line px-4 py-2 rounded-sm text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
      >
        {loading ? "Checking…" : "Check for replies"}
      </button>
    </div>
  );
}
