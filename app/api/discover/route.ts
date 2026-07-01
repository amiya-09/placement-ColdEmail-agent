import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery";

export async function POST() {
  try {
    const summary = await runDiscovery();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
