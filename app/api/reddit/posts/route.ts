import { NextRequest, NextResponse } from "next/server";
import { searchRedditPosts } from "@/lib/reddit/client";
import { RedditSearchApiResponse, RedditSort } from "@/lib/reddit/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<RedditSearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    const keywords = (
      searchParams.get("keywords") ||
      searchParams.get("query") ||
      searchParams.get("q") ||
      ""
    ).trim();

    const subreddit = (
      searchParams.get("subreddit") ||
      searchParams.get("r") ||
      ""
    ).trim() || undefined;

    const dateParam =
      searchParams.get("date") ||
      searchParams.get("date_posted") ||
      searchParams.get("timeframe") ||
      searchParams.get("t") ||
      undefined;

    const sortParam = (
      searchParams.get("sort") ||
      searchParams.get("sort_by") ||
      undefined
    ) as RedditSort | undefined;

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 10;

    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required parameter: 'keywords' (e.g., ?keywords=AI+Agents&date=past+7+days&limit=10)",
        },
        { status: 400 }
      );
    }

    const result = await searchRedditPosts({
      keywords,
      subreddit,
      date: dateParam,
      sort: sortParam,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        query: result.queryInfo,
      },
    });
  } catch (error: unknown) {
    console.error("Reddit search GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search Reddit posts";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<RedditSearchApiResponse>> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const keywords = (
      (body.keywords as string) ||
      (body.query as string) ||
      (body.q as string) ||
      ""
    ).trim();

    const subreddit = (
      (body.subreddit as string) ||
      (body.r as string) ||
      ""
    ).trim() || undefined;

    const dateParam =
      (body.date as string) ||
      (body.date_posted as string) ||
      (body.timeframe as string) ||
      (body.t as string) ||
      undefined;

    const sortParam = (
      body.sort ||
      body.sort_by ||
      undefined
    ) as RedditSort | undefined;

    const rawLimit = body.limit ? Number(body.limit) : 10;
    const limit = isNaN(rawLimit) ? 10 : rawLimit;

    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: 'keywords' in JSON request body.",
        },
        { status: 400 }
      );
    }

    const result = await searchRedditPosts({
      keywords,
      subreddit,
      date: dateParam,
      sort: sortParam,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        query: result.queryInfo,
      },
    });
  } catch (error: unknown) {
    console.error("Reddit search POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search Reddit posts";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
