# CLAUDE.md — Clack Project Configuration

## Project Overview
Clack is an AI-powered social media marketing platform. Users connect their social accounts (Instagram, TikTok, YouTube), and an AI strategist (Claude) analyzes their content, engagement, and audience — then provides conversational marketing strategy, content plans, and virality scoring.

## Tech Stack
- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS 3.4+
- **Database:** Supabase (PostgreSQL, Auth, Storage, pgvector)
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **Background Jobs:** Inngest (for data sync, scheduled analysis)
- **Deployment:** Vercel
- **Package Manager:** npm

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — Lint code
- `npx supabase db push` — Push DB migrations

## Project Structure
```
app/
  (marketing)/        # Homepage, public pages (marketing site)
    page.tsx          # Landing page
  login/page.tsx
  signup/page.tsx
  dashboard/
    layout.tsx        # Auth check + DashboardLayoutClient
    page.tsx          # Redirects to /dashboard/chat
    chat/page.tsx     # AI Chat (THE main product)
    overview/page.tsx # Dashboard with metrics
    accounts/page.tsx # Connect social accounts
    marketing-plan/   # AI-generated marketing plan
    clips/            # Video clip extraction
    settings/         # User settings
components/
  ui/                 # Reusable UI components (Button, Input, Card, etc.)
  dashboard/          # Dashboard-specific components
  chat/               # Chat-specific components
lib/
  supabase/           # Supabase client (server.ts, client.ts, middleware.ts)
  anthropic.ts        # Claude API client
  dashboard-data.ts   # Data fetching utilities
  utils.ts            # General utilities
```

## Design System: "White Floating Glass"

### Philosophy
Light/white background with frosted glass cards. Cards and buttons use a gradient border (bright white at top, fading to near-black at bottom) to create a premium floating effect with depth. The interior is semi-transparent white with blur.

### Background
Soft lavender base with subtle color blobs (visionOS-style):
```css
background:
  radial-gradient(ellipse at 15% 25%, rgba(124,92,252,0.10) 0%, transparent 52%),
  radial-gradient(ellipse at 85% 12%, rgba(99,102,241,0.08) 0%, transparent 48%),
  radial-gradient(ellipse at 58% 88%, rgba(168,85,247,0.07) 0%, transparent 48%),
  radial-gradient(ellipse at 92% 72%, rgba(6,182,212,0.05) 0%, transparent 42%),
  #ECE8F5;
```

### Card / Button Style (the primary pattern for ALL cards, modals, KPI tiles, platform cards):
```css
/* Interior background + gradient border in one declaration */
background:
  linear-gradient(rgba(255,255,255,0), rgba(255,255,255,0)) padding-box,
  linear-gradient(180deg, rgba(255,255,255,0.90) 0%, rgba(220,220,220,0.50) 35%, rgba(140,140,140,0.30) 65%, rgba(0,0,0,0.18) 100%) border-box;
border: 1px solid transparent;
backdrop-filter: blur(20px) saturate(140%);
-webkit-backdrop-filter: blur(20px) saturate(140%);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05);
```

### Sidebar / Nav (heavier, less transparent):
```css
background: rgba(248,248,250,0.88);
backdrop-filter: blur(24px) saturate(140%);
border-right: 1px solid rgba(0,0,0,0.07);
```

### Solid Surface (for data tables, list rows):
```css
background: rgba(255,255,255,0.55);
border: 1px solid rgba(0,0,0,0.06);
border-radius: 12px;
/* NO backdrop-filter */
```

### Input Fields:
```css
background: rgba(0,0,0,0.04);
border: 1px solid rgba(0,0,0,0.07);
border-radius: 12px;
color: #111118;
/* NO backdrop-filter */
```

### Buttons:
```css
/* Primary — fully opaque, never glass */
background: #7C5CFC;
border-radius: 12px;
box-shadow: 0 4px 16px rgba(124, 92, 252, 0.3);

/* Secondary — subtle */
background: rgba(0,0,0,0.04);
border: 1px solid rgba(0,0,0,0.08);
```

### Colors:
```
Background:       #E8E8E8
Surface:          rgba(255,255,255,0.78) with blur + gradient border
Surface solid:    rgba(255,255,255,0.55) no blur
Border:           rgba(0,0,0,0.06)
Border hover:     rgba(0,0,0,0.12)
Text primary:     #111118
Text secondary:   #505060
Text muted:       #8A8A9A
Text faint:       #AAAABB
Purple (brand):   #7C5CFC
Green:            #16A34A
Amber:            #D97706
Red:              #DC2626
Chart grid:       rgba(0,0,0,0.05)
```

### Glass Rules:
- ✅ Use card/glass style on: sidebar, nav, KPI stat cards, modals, floating panels, dropdowns, platform cards
- ❌ NEVER glass on: inputs, primary buttons, data tables, long text, list items, chart content
- ❌ NEVER stack more than 2 glass layers
- ❌ NEVER use bg-gray-* — always use rgba() or hex values from this system
- ✅ Gradient border goes from white (top) to near-black (bottom) — this is the KEY visual element
- ✅ Always include box-shadow below cards for depth
- ✅ Keep page background at #E8E8E8 (light gray, not pure white)

## AI Chat Architecture
- Chat is the PRIMARY interface — `/dashboard` redirects to `/dashboard/chat`
- Left panel (35% width): conversation thread
- Right panel (65% width): artifacts workspace (reports, charts, plans)
- AI can also be accessed from any page via floating chat bar or Cmd+J
- Messages stream via Edge Runtime + Anthropic streaming SDK
- Store full conversation history in Supabase `ai_conversations` + `ai_messages`
- Use RAG with pgvector for context-aware responses

## Coding Conventions
- Use functional components with TypeScript
- Use `"use client"` only when needed (interactivity, hooks)
- Prefer named exports
- Use Tailwind for ALL styling — no separate CSS files
- All colors via design system values (rgba/hex), never Tailwind gray-* defaults
- Use `style` prop for box-shadow, backdrop-filter, gradients
- Use Framer Motion for animations (subtle, 150-300ms)
- Error handling: always try/catch API calls, show user-friendly errors
- Always run `npm run lint` before committing

## Database Tables (Supabase)
- `profiles` — user profiles, goals_raw, goals_timeframe, goals_structured
- `social_accounts` — platform connections, OAuth tokens (encrypted), metrics
- `social_posts` — synced posts with metrics JSONB, AI analysis
- `ai_conversations` — conversation metadata
- `ai_messages` — individual messages with role, content, token_count
- `ai_artifacts` — pinnable AI-generated reports (deep_dive, weekly_plan, etc.)
- `social_embeddings` — pgvector embeddings for RAG
- `activity_log` — user events for activity feed
- All tables have RLS policies scoped to auth.uid()

## Important Notes
- Homepage (marketing site) keeps its own glass-heavy design — don't touch it when working on the app
- The app (dashboard/*) follows this CLAUDE.md design system
- Instagram OAuth uses old scope names: instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list, business_management
- Claude API model string: "claude-sonnet-4-6"
- Environment variables are in .env.local (never commit this)
