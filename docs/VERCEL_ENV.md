# Vercel Environment Variables

Add these in **Vercel → Project → Settings → Environment Variables**. `.env.local` is not deployed.

## Required (app won't work without these)

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (auth, database) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (browser auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side operations (RLS bypass) |

## For TikTok connect + sync

| Variable | Used for |
|----------|----------|
| `TIKTOK_CLIENT_KEY` | TikTok OAuth client key |
| `TIKTOK_CLIENT_SECRET` | TikTok OAuth client secret |
| `SOCIAL_TOKENS_ENCRYPTION_KEY` | Encrypts tokens (min 32 chars). Required for TikTok connect. |

## For Instagram connect + sync

| Variable | Used for |
|----------|----------|
| `META_APP_ID` | Meta/Facebook app ID |
| `META_APP_SECRET` | Meta/Facebook app secret |

## For AI chat

| Variable | Used for |
|----------|----------|
| `ANTHROPIC_API_KEY` | Claude API for chat/strategy |

## Optional / other features

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_APP_URL` | **TikTok OAuth:** Must match TikTok app redirect URI exactly (e.g. `https://www.useclack.com`). Fixes `server_error` / token exchange failures from www vs non-www mismatch. |
| `SOCIAL_OAUTH_STATE_SECRET` | OAuth state signing (falls back to anon key) |
| `SOCIAL_TOKENS_ENCRYPTION_KEY` | If using encrypted tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | YouTube OAuth |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Twitter OAuth |
| `OPENAI_API_KEY` | Video transcription (if using) |

---

**Minimum for accounts page + TikTok:** Supabase URL + anon key + service role key + TikTok credentials.

---

## If you see "Failed to load accounts" (400 Bad Request)

1. **Check env vars** — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set in Vercel and match your Supabase project.
2. **Redeploy** — After adding env vars, trigger a new deployment (or redeploy from Vercel dashboard).
3. **Check migrations** — Ensure your Supabase DB has the schema from `supabase/migrations/20250226_instagram_oauth_schema.sql` (columns: `platform_account_id`, `access_token`, etc.). Run `npx supabase db push` against your production Supabase if needed.
