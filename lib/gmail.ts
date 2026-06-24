import { google } from "googleapis";
import { getSupabaseServer } from "./supabase";
import { decryptToken } from "./crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // forces refresh_token on every connect, not just the first time
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned. Revoke prior access at https://myaccount.google.com/permissions and try connecting again."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  return { refreshToken: tokens.refresh_token, email: data.email! };
}

async function getAuthenticatedClient() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("provider", "google")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("No Gmail account connected yet. Go to /setup first.");
  }

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: decryptToken(data.encrypted_refresh_token),
  });
  return { client, senderEmail: data.email as string };
}

function buildRawMessage({
  to,
  from,
  subject,
  html,
}: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): string {
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];
  const message = messageParts.join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string; threadId: string }> {
  const { client, senderEmail } = await getAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth: client });

  const raw = buildRawMessage({ to, from: senderEmail, subject, html });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return { id: res.data.id!, threadId: res.data.threadId! };
}

// Returns true if the thread now has more messages than just the one we sent —
// a simple, no-AI signal that the recruiter replied. Classification of the
// reply content is a Phase 3 feature.
export async function threadHasReply(threadId: string): Promise<boolean> {
  const { client } = await getAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.threads.get({ userId: "me", id: threadId });
  const messages = res.data.messages ?? [];
  return messages.length > 1;
}
