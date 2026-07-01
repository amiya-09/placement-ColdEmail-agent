import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { sendEmail } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  const { applicationId } = await req.json();
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // --- Daily send cap guard ---
  const cap = parseInt(process.env.DAILY_SEND_CAP || "15", 10);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error: countErr } = await supabase
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "sent")
    .gte("occurred_at", startOfDay.toISOString());

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= cap) {
    return NextResponse.json(
      {
        error: `Daily send cap (${cap}) already reached. This protects your Gmail account from looking automated — try again tomorrow.`,
      },
      { status: 429 }
    );
  }

  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("*, contacts(name, email, company_name)")
    .eq("id", applicationId)
    .single();

  if (appErr || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!application.draft_subject || !application.draft_body) {
    return NextResponse.json(
      { error: "No draft to send yet — generate one first." },
      { status: 400 }
    );
  }
  if (!application.contacts?.email) {
    return NextResponse.json(
      { error: "This application has no contact email." },
      { status: 400 }
    );
  }

  const base = process.env.APP_BASE_URL || "";
  const pixelUrl = `${base}/api/track/open/${applicationId}`;
  const bodyHtml = application.draft_body
    .split("\n")
    .map((line: string) => `<p>${line}</p>`)
    .join("\n");
  const html = `${bodyHtml}\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;

  try {
    const sent = await sendEmail({
      to: application.contacts.email,
      subject: application.draft_subject,
      html,
    });

    await supabase.from("email_events").insert({
      application_id: applicationId,
      event_type: "sent",
    });

    // Track last contact time on the company watch-list (insert if not already there).
    await supabase.from("target_companies").upsert(
      {
        company_name: application.company_name,
        last_contacted_at: new Date().toISOString(),
        source: "manual",
      },
      { onConflict: "company_name" }
    );

    const { data: updated, error: updateErr } = await supabase
      .from("applications")
      .update({
        status: "sent",
        gmail_thread_id: sent.threadId,
        gmail_message_id: sent.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select("*, contacts(name, email, company_name)")
      .single();

    if (updateErr) throw new Error(updateErr.message);
    return NextResponse.json({ application: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
