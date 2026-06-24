import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { encryptToken } from "@/lib/crypto";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const base = process.env.APP_BASE_URL || "";

  if (!code) {
    return NextResponse.redirect(`${base}/setup?error=missing_code`);
  }

  try {
    const { refreshToken, email } = await exchangeCodeForTokens(code);
    const supabase = getSupabaseServer();

    await supabase.from("oauth_tokens").insert({
      provider: "google",
      email,
      encrypted_refresh_token: encryptToken(refreshToken),
    });

    return NextResponse.redirect(`${base}/setup?connected=${email}`);
  } catch (err: any) {
    return NextResponse.redirect(
      `${base}/setup?error=${encodeURIComponent(err.message)}`
    );
  }
}
