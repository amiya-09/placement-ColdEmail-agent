# Placement Agent — Phase 1

The core loop: add a company + JD manually → AI drafts the email → you review and edit → you approve and it sends from your real Gmail → opens and replies get tracked.

Everything here is genuinely free — no credit card needed anywhere.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier, no card)
2. Once it's up, go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it
3. Go to **Settings → API** and copy:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (not the `anon` key) → this is `SUPABASE_SERVICE_ROLE_KEY`

## 2. Get a Groq API key

1. Go to [console.groq.com](https://console.groq.com) → sign up (no card) → API Keys → create one
2. That's your `GROQ_API_KEY`

## 3. Set up Google OAuth (for sending/reading Gmail)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a new project (any name)
2. **APIs & Services → Library** → search "Gmail API" → Enable
3. **APIs & Services → OAuth consent screen**:
   - User type: External
   - Fill in app name + your email
   - **Scopes**: add `gmail.send`, `gmail.readonly`, `userinfo.email`
   - **Test users**: add your own Gmail address
   - Leave it in "Testing" mode — since it's just you, you never need to submit this for Google's verification process
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI: `https://YOUR-VERCEL-URL.vercel.app/api/auth/google/callback` (use `http://localhost:3000/api/auth/google/callback` if testing locally first)
5. Copy the **Client ID** and **Client Secret** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

## 4. Generate the token encryption key

Run this once, locally, and save the output:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
That's your `TOKEN_ENCRYPTION_KEY`.

## 5. Set environment variables

Copy `.env.example` to `.env.local` for local testing, and fill in everything from steps 1–4. When you deploy, add the same variables under **Vercel → Project → Settings → Environment Variables**.

Set `APP_BASE_URL` to your real deployed URL once you have one (e.g. `https://placement-agent.vercel.app`) — the tracking pixel and OAuth redirect both depend on this being correct.

## 6. Run it

Locally:
```
npm install
npm run dev
```

Deploying: push this folder to a GitHub repo, then **Import Project** on [vercel.com](https://vercel.com) (free Hobby tier, no card) and point it at the repo. Add the env vars there too.

## 7. First-time use

1. Go to `/setup` → click **Connect Gmail** → you'll see an "unverified app" warning from Google. That's expected since you're the only test user — click "Advanced" → "Go to [app] (unsafe)" to continue. It's safe; it's your own app.
2. Still on `/setup` → fill in your name, a resume label (e.g. `SWE-general`), and your resume bullets as plain text. Save.
3. Go to `/new` → add a company, paste the JD, and the recruiter's email (and name, if you have it).
4. On the application page, click **Generate draft**, edit it if you want, then **Approve & send**.
5. Back on the dashboard, use **Check for replies** whenever you want to pull in updates — Phase 1 doesn't auto-check on a schedule yet, that comes in Phase 3.

---

## What's deliberately not here yet

- Automated discovery (Adzuna/ATS watch-list) — Phase 2
- AI reply classification + automated follow-ups — Phase 3 (right now, a reply just flips status to "replied," no auto-drafted follow-up)
- Sending ramp-up curve, randomized send delays, business-hour windows — Phase 4 (the daily cap is in, the rest isn't yet)
- Analytics dashboard, failure alerting, password gate on the dashboard — Phase 4
- Excel import for the priority company list — wired in as soon as you send over the file

See `placement-agent-spec.md` for the full plan these phases come from.
