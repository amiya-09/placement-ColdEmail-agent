import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, resumeLabel, resumeText, skills, targetRoles } = body;

  if (!name || !resumeLabel || !resumeText) {
    return NextResponse.json(
      { error: "name, resumeLabel, and resumeText are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: existing } = await supabase
    .from("profile")
    .select("id")
    .eq("resume_label", resumeLabel)
    .maybeSingle();

  const row = {
    name,
    resume_label: resumeLabel,
    resume_text: resumeText,
    skills: skills ?? [],
    target_roles: targetRoles ?? [],
  };

  const result = existing
    ? await supabase.from("profile").update(row).eq("id", existing.id).select("*").single()
    : await supabase.from("profile").insert(row).select("*").single();

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ profile: result.data });
}
