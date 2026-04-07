import { NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "No APIFY_TOKEN" }, { status: 500 });

  const username = req.nextUrl.searchParams.get("username") ?? "thorenai";
  const platform = req.nextUrl.searchParams.get("platform") ?? "tiktok";
  const apify = new ApifyClient({ token });

  if (platform === "instagram") {
    const handle = username.startsWith("@") ? username.slice(1) : username;
    const run = await apify.actor("apify/instagram-scraper").call(
      { usernames: [handle], resultsLimit: 5 },
      { waitSecs: 120 }
    );
    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 2 });
    return NextResponse.json({
      itemCount: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstItem: items[0] ?? null,
    });
  }

  const run = await apify.actor("clockworks/tiktok-scraper").call(
    { profiles: [`https://www.tiktok.com/@${username}`], resultsPerPage: 5 },
    { waitSecs: 60 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 3 });

  return NextResponse.json({
    itemCount: items.length,
    firstItemKeys: items[0] ? Object.keys(items[0]) : [],
    firstItem: items[0] ?? null,
    secondItemKeys: items[1] ? Object.keys(items[1]) : [],
  });
}
