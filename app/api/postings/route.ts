import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();

  const [scoredResult, rejectedResult] = await Promise.all([
    supabase
      .from("postings")
      .select("*")
      .eq("status", "scored")
      .order("stage1_score", { ascending: false }),

    // Cap at 200 so the reject list doesn't overwhelm the page on busy runs.
    supabase
      .from("postings")
      .select("id, company_name, title, location, reject_reason, discovered_at")
      .eq("status", "hard_rejected")
      .order("discovered_at", { ascending: false })
      .limit(200),
  ]);

  if (scoredResult.error) {
    return NextResponse.json({ error: scoredResult.error.message }, { status: 500 });
  }
  if (rejectedResult.error) {
    return NextResponse.json({ error: rejectedResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    scored: scoredResult.data ?? [],
    rejected: rejectedResult.data ?? [],
  });
}
