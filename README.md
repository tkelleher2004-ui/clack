# Clack

An AI social media strategist for creators. Connect your accounts, and Claude analyzes your content and audience, then answers questions using your actual data.

This repo is the first version of Clack. Later work on an autonomous posting engine lives in a private repo.

## What it does
- **Account connections:** OAuth flows for social platforms, with stored tokens encrypted
- **Data ingestion:** per-platform ingest modules for TikTok, Instagram, YouTube, LinkedIn, Facebook, and X, plus Apify scrapers
- **AI chat:** a strategist chat that can reference the user's own account data
- **Background jobs:** Inngest handles data sync and scheduled analysis

## How it fits together
Next.js routes handle auth and the dashboard. Accounts connect over OAuth, ingest modules normalize each platform's data into Supabase, and Inngest keeps it fresh. The chat route loads that data as context for Claude.

## Stack
Next.js, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage), Anthropic Claude API, Inngest, Apify, Vercel
