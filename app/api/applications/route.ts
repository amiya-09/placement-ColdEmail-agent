import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("applications")
    .select("*, contacts(name, email, company_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { companyName, jdText, contactName, contactEmail, resumeLabel } = body;

  if (!companyName || !jdText || !contactEmail) {
    return NextResponse.json(
      { error: "companyName, jdText, and contactEmail are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Reuse an existing contact for this company+email if one exists, else create it.
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("company_name", companyName)
    .eq("email", contactEmail)
    .maybeSingle();

  let contactId = existingContact?.id;
  if (!contactId) {
    const { data: newContact, error: contactErr } = await supabase
      .from("contacts")
      .insert({
        company_name: companyName,
        name: contactName || null,
        email: contactEmail,
        source: "manual",
      })
      .select("id")
      .single();
    if (contactErr)
      return NextResponse.json({ error: contactErr.message }, { status: 500 });
    contactId = newContact.id;
  }

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      company_name: companyName,
      jd_text: jdText,
      contact_id: contactId,
      resume_label: resumeLabel || null,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application });
}
