# OAuth Setup Guide — Clack Social Connections

This guide walks you through creating OAuth apps for each platform so users can connect their social accounts.

**Base URL for local dev:** `http://localhost:3000`  
**Base URL for production:** Your deployed URL (e.g. `https://useclack.com`)

OAuth redirects automatically use the request origin, so they work on useclack.com and any deployment URL without extra config. In Vercel, add your platform credentials (TIKTOK_CLIENT_KEY, META_APP_ID, etc.) to **Project → Settings → Environment Variables**.

---

## 1. TikTok

### Create the app

1. Go to [developers.tiktok.com](https://developers.tiktok.com/)
2. Sign in and open **Manage apps** → **Create an app**
3. Fill in app name, category, and description
4. After creation, open your app

### Add Login Kit

1. In the app, go to **Products** → **Login Kit**
2. Click **Set up** or **Add product**
3. Under **Login Kit for Web**, add your redirect URI:
   - Local: `http://localhost:3000/api/auth/tiktok/callback`
   - Production: `https://yourdomain.com/api/auth/tiktok/callback`

### Get credentials

1. Go to **Basic Information** or **Credentials**
2. Copy **Client Key** → `TIKTOK_CLIENT_KEY`
3. Copy **Client Secret** → `TIKTOK_CLIENT_SECRET`

### Add to `.env.local`

```
TIKTOK_CLIENT_KEY=your_client_key_here
TIKTOK_CLIENT_SECRET=your_client_secret_here
```

### Sandbox: Video list returns empty / internal_error

1. **Add Display API to your sandbox** – Video list is part of the **Display API** product. In your app → Sandbox → Products, ensure **Display API** is added (not just Login Kit).

2. **Add target users** – Sandbox only returns video data for TikTok accounts in the Target users list. Add your test account under Sandbox → Target users → Add account. Wait up to an hour for it to take effect.

3. **Scopes** – The sandbox must include `video.list` in its allowed scopes. Check Sandbox → Products → Display API → Scopes.

4. **Retries** – The sync route retries up to 3 times on `internal_error`; TikTok’s API can be flaky. If it still fails after retries, contact [TikTok Developer Support](https://developers.tiktok.com/support) with the `log_id` from the error response.

---

## 2. Instagram (Meta)

Instagram uses the **Meta for Developers** platform. You need a Facebook app with Instagram Graph API.

### Create the app

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. **My Apps** → **Create App** → **Consumer** type
3. Name it (e.g. "Clack") and create

### Add Facebook Login

1. In the app dashboard, go to **Products** → **Facebook Login** → **Set up**
2. Choose **Web**
3. Add redirect URI:
   - Local: `http://localhost:3000/api/auth/instagram/callback`
   - Production: `https://yourdomain.com/api/auth/instagram/callback`
4. Save

### Add Instagram Graph API

1. Go to **Products** → **Add Product**
2. Add **Instagram Graph API**
3. In **Instagram Graph API** settings, ensure:
   - **Instagram Basic Display** is not required (we use Graph API)
   - You need a **Facebook Page** linked to an **Instagram Business or Creator account**

### Configure app settings

1. **Settings** → **Basic**:
   - Copy **App ID** → `META_APP_ID`
   - Copy **App Secret** → `META_APP_SECRET` (click **Show**)

2. **App Domains** (add for production):
   - `localhost` (for dev)
   - `yourdomain.com` (for production)

### Add to `.env.local`

```
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
```

---

## 3. Facebook (same Meta app)

Facebook uses the **same app** as Instagram. Use the same `META_APP_ID` and `META_APP_SECRET`.

### Add Facebook Login redirect URI

1. In your Meta app: **Facebook Login** → **Settings**
2. Add **Valid OAuth Redirect URIs**:
   - Local: `http://localhost:3000/api/auth/facebook/callback`
   - Production: `https://yourdomain.com/api/auth/facebook/callback`

No extra env vars needed — it uses `META_APP_ID` and `META_APP_SECRET`.

---

## 4. YouTube (Google)

### Create the project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a project or select one
3. **APIs & Services** → **Credentials**

### Create OAuth client

1. **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: e.g. "Clack"
4. **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/youtube/callback`
   - Production: `https://yourdomain.com/api/auth/youtube/callback`
5. Create and copy **Client ID** and **Client Secret**

### Enable APIs

1. **APIs & Services** → **Library**
2. Enable:
   - **YouTube Data API v3**
   - **YouTube Analytics API**

### Add to `.env.local`

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

---

## 5. LinkedIn

### Create the app

1. Go to [developer.linkedin.com](https://developer.linkedin.com/)
2. **My Apps** → **Create app**
3. Fill in app name, LinkedIn Page, etc.

### Configure OAuth

1. In the app, go to **Auth** tab
2. **Authorized redirect URLs**:
   - Local: `http://localhost:3000/api/auth/linkedin/callback`
   - Production: `https://yourdomain.com/api/auth/linkedin/callback`
3. Under **Products**, request:
   - **Sign In with LinkedIn**
   - **Share on LinkedIn** (for `w_member_social`)

### Get credentials

1. **Auth** tab → **Application credentials**
2. Copy **Client ID** → `LINKEDIN_CLIENT_ID`
3. Copy **Client Secret** → `LINKEDIN_CLIENT_SECRET`

### Add to `.env.local`

```
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
```

---

## 6. Twitter/X

### Create the app

1. Go to [developer.x.com](https://developer.x.com/)
2. **Developer Portal** → **Projects & Apps** → **Your Apps**
3. Create a new app or use an existing one

### OAuth 2.0 with PKCE

1. **Settings** → **User authentication settings**
2. **Set up** OAuth 2.0
3. Choose **Web App, Automated App or Bot**
4. **Callback URI / Redirect URL**:
   - Local: `http://localhost:3000/api/auth/twitter/callback`
   - Production: `https://yourdomain.com/api/auth/twitter/callback`
5. **Website URL**: `http://localhost:3000` (or your production URL)
6. Request scopes: `tweet.read`, `users.read`, `offline.access`
7. Save

### Get credentials

1. **Keys and tokens** tab
2. Copy **OAuth 2.0 Client ID** → `TWITTER_CLIENT_ID`
3. Copy **OAuth 2.0 Client Secret** → `TWITTER_CLIENT_SECRET`

### Add to `.env.local`

```
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here
```

---

## 7. Copy-paste template for `.env.local`

Add these to your `.env.local` and replace the placeholder values:

```env
# ========== SUPABASE (you likely have these) ==========
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ========== APP URL ==========
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ========== TOKEN ENCRYPTION (required for social OAuth) ==========
SOCIAL_TOKENS_ENCRYPTION_KEY=your_32_char_minimum_secret_key_here

# ========== TIKTOK ==========
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# ========== META (Instagram + Facebook) ==========
META_APP_ID=
META_APP_SECRET=

# ========== GOOGLE (YouTube) ==========
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ========== LINKEDIN ==========
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# ========== TWITTER/X ==========
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

**If you already have Supabase configured**, paste only this block (add `SUPABASE_SERVICE_ROLE_KEY` if you don't have it — needed for sync jobs):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
SOCIAL_TOKENS_ENCRYPTION_KEY=your_32_char_minimum_secret_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

---

## 8. After setup

1. Restart the dev server: `npm run dev`
2. Go to `/dashboard/accounts`
3. Click **Connect** on each platform

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `META_APP_ID` not configured | Add env vars and restart dev server |
| `redirect_uri_mismatch` | Ensure redirect URI in the portal matches exactly (including trailing slash or not) |
| Instagram: "no_page" | Link a Facebook Page with an Instagram Business account |
| Instagram: "no_ig" | Convert the Instagram account to Business/Creator and link it to the Page |
| Facebook: "no_page" | Create a Facebook Page first; the user must be an admin |
