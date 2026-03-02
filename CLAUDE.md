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

## Design System: "Dark Liquid Glass"

### Philosophy
Glassmorphism on structural/navigation elements (20-30% of UI). Solid surfaces for content. Glass should feel premium, not cheap.

### Background
NEVER pure black. Use rich dark with subtle colored blobs:
```css
/* Page background */
background: #0C0C14;
/* Add 2-3 radial gradient blobs behind content */
/* Blob 1: */ radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)
/* Blob 2: */ radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
/* Blob 3: */ radial-gradient(ellipse at 50% 80%, rgba(6, 182, 212, 0.04) 0%, transparent 50%)
```

### Glass Card (for nav, sidebar, KPI cards, modals):
```css
background: rgba(255, 255, 255, 0.06);
backdrop-filter: blur(12px) saturate(180%);
-webkit-backdrop-filter: blur(12px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### Glass Nav/Sidebar (heavier):
```css
background: rgba(12, 12, 20, 0.75);
backdrop-filter: blur(16px) saturate(180%);
border-right: 1px solid rgba(255, 255, 255, 0.06);
```

### Solid Surface (for content areas, inputs, data tables):
```css
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 12px;
/* NO backdrop-filter on content */
```

### Input Fields:
```css
background: rgba(255, 255, 255, 0.06);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 12px;
/* NO backdrop-filter — must be readable */
```

### Buttons:
```css
/* Primary — fully opaque, never glass */
background: #7C5CFC;
border-radius: 12px;
box-shadow: 0 4px 16px rgba(124, 92, 252, 0.3);

/* Secondary — subtle glass */
background: rgba(255, 255, 255, 0.06);
border: 1px solid rgba(255, 255, 255, 0.10);
```

### Colors:
```
Background:       #0C0C14
Surface:          rgba(255,255,255,0.06) with blur
Surface solid:    rgba(255,255,255,0.03) no blur
Border:           rgba(255,255,255,0.08)
Border hover:     rgba(255,255,255,0.15)
Text primary:     #E8E8F0
Text secondary:   #9898B0
Text muted:       #6B6B80
Purple (brand):   #7C5CFC
Purple light:     #A78BFA
Green:            #81C784
Amber:            #FFB74D
Red:              #E57373
Chart grid:       rgba(255,255,255,0.04)
```

### Glass Rules:
- ✅ Use glass on: sidebar, nav, KPI stat cards, modals, floating chat bar, dropdowns
- ❌ NEVER glass on: inputs, buttons, data tables, long text, list items, chart content
- ❌ NEVER stack more than 2 glass layers
- ❌ NEVER use bg-gray-* — always use rgba() or hex values from this system
- ✅ Always add `saturate(180%)` alongside blur for richness in dark mode
- ✅ Use gradient borders (lighter on top edge) for premium feel
- ✅ Keep backgrounds dark but NOT pure black — always #0C0C14 or similar with color blobs

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
