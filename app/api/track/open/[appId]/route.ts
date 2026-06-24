import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// 1x1 transparent GIF, served regardless of whether logging succeeds —
// a tracking pixel must never error out visibly in the recipient's client.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    const supabase = getSupabaseServer();

    await supabase.from("email_events").insert({
      application_id: params.appId,
      event_type: "opened",
    });

    // Only move new "sent" applications forward — don't downgrade
    // "replied" or "closed" back to "opened".
    await supabase
      .from("applications")
      .update({ status: "opened", updated_at: new Date().toISOString() })
      .eq("id", params.appId)
      .eq("status", "sent");
  } catch {
    // Swallow errors — a broken pixel request should never surface to the
    // person reading the email.
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
