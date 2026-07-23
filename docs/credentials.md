# Credentials & where they live

This repo is public, so no secret values are ever committed here — only a
map of what exists and where to rotate it.

## Supabase Personal Access Token (account-level)

- Created 2026-07-23, set to **never expire**.
- Used once to run `supabase login` / `link` / `functions deploy` / `secrets set`
  from the CLI. Not stored anywhere after that session.
- Grants full control over the Supabase account (all projects), not just this one —
  treat it like a master password.
- Rotate or revoke: Supabase Dashboard → avatar (top right) → Account →
  Access Tokens.
- If you don't expect to redeploy functions from the CLI again soon, revoking
  it now is reasonable — a new one takes 30 seconds to generate when needed.

## Supabase project API keys (project-level, in GitHub Actions secrets)

Repo → Settings → Secrets and variables → Actions:
- `VITE_SUPABASE_URL` — project URL, baked into the frontend build.
- `VITE_SUPABASE_ANON_KEY` — the `sb_publishable_...` key. Safe to expose
  client-side by design.

The `sb_secret_...` key (full DB access, bypasses RLS) is **not** stored
anywhere in this project — it was used once, directly in a terminal command,
to insert the first row into `masters`. Edge Functions don't need it: Supabase
auto-injects a service-role key into their runtime env as
`SUPABASE_SERVICE_ROLE_KEY`.

## Supabase Edge Function secrets (Project Settings → Edge Functions → Secrets)

- `TELEGRAM_BOT_TOKEN` — from @BotFather.
- `TELEGRAM_WEBHOOK_SECRET` — random string, checked against the
  `X-Telegram-Bot-Api-Secret-Token` header on incoming webhook calls.
- `MINI_APP_URL` — the GitHub Pages URL, used to build the "Open app" button
  in bot replies.

Rotating the bot token means re-running Telegram's `setWebhook` with the new
token too (the old one stops being valid for that call).
