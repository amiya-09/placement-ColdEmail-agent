import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { generateDraft } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const { applicationId } = await req.json();
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("*, contacts(name, email, company_name)")
    .eq("id", applicationId)
    .single();
  if (appErr || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Pick the matching resume version if one is tagged on the application,
  // otherwise fall back to whichever profile row exists first.
  let profileQuery = supabase.from("profile").select("*").limit(1);
  if (application.resume_label) {
    profileQuery = supabase
      .from("profile")
      .select("*")
      .eq("resume_label", application.resume_label)
      .limit(1);
  }
  const { data: profiles, error: profileErr } = await profileQuery;
  if (profileErr || !profiles || profiles.length === 0) {
    return NextResponse.json(
      { error: "No profile found. Set one up at /setup first." },
      { status: 400 }
    );
  }
  const profile = profiles[0];

  try {
    const draft = await generateDraft({
      companyName: application.company_name,
      jdText: application.jd_text,
      resumeText: profile.resume_text,
      studentName: profile.name,
      contactName: application.contacts?.name ?? null,
    });

    const { data: updated, error: updateErr } = await supabase
      .from("applications")
      .update({
        draft_subject: draft.subject,
        draft_body: draft.body,
        status: "drafted",
        resume_label: application.resume_label || profile.resume_label,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (updateErr) throw new Error(updateErr.message);
    return NextResponse.json({ application: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
