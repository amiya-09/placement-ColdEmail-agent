import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { threadHasReply } from "@/lib/gmail";

// Phase 1: triggered manually from the dashboard. Phase 3 wires this up to
// a GitHub Actions cron job so it runs without you lifting a finger, and adds
// AI classification of what the reply actually says.
export async function POST() {
  const supabase = getSupabaseServer();

  const { data: applications, error } = await supabase
    .from("applications")
    .select("id, gmail_thread_id, status")
    .in("status", ["sent", "opened"])
    .not("gmail_thread_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let repliesFound = 0;

  for (const app of applications ?? []) {
    try {
      const replied = await threadHasReply(app.gmail_thread_id!);
      if (replied) {
        repliesFound += 1;
        await supabase.from("email_events").insert({
          application_id: app.id,
          event_type: "replied",
        });
        await supabase
          .from("applications")
          .update({ status: "replied", updated_at: new Date().toISOString() })
          .eq("id", app.id);
      }
    } catch {
      // One bad thread lookup shouldn't kill the whole batch check.
      continue;
    }
  }

  return NextResponse.json({
    checked: applications?.length ?? 0,
    repliesFound,
  });
}
