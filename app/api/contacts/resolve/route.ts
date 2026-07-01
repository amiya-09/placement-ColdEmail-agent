import { NextRequest, NextResponse } from "next/server";
import { resolveContact } from "@/lib/contacts";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const companyName: string = (body.companyName ?? "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }
  const result = await resolveContact(companyName);
  return NextResponse.json(result);
}
