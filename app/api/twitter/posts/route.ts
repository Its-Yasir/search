import { NextRequest, NextResponse } from "next/server";
import { searchTwitterPosts } from "@/lib/twitter/client";
import { TwitterPostSearchApiResponse } from "@/lib/twitter/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<TwitterPostSearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    const keywords = (
      searchParams.get("keywords") ||
      searchParams.get("query") ||
      searchParams.get("q") ||
      ""
    ).trim();

    const username = searchParams.get("username")?.trim() || undefined;

    const dateParam =
      searchParams.get("date") ||
      searchParams.get("date_posted") ||
      searchParams.get("timeframe") ||
      undefined;

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 10;

    const queryTypeParam = (
      searchParams.get("queryType") ||
      searchParams.get("sort_by") ||
      "Latest"
    ).toLowerCase();
    const queryType = queryTypeParam === "top" ? "Top" : "Latest";

    const cursor = searchParams.get("cursor")?.trim() || undefined;

    if (!keywords && !username) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required parameter: 'keywords' or 'username' (e.g., ?keywords=AI+Agents&date=past+7+days&limit=10)",
        },
        { status: 400 }
      );
    }

    const result = await searchTwitterPosts({
      keywords,
      username,
      date: dateParam,
      limit,
      queryType,
      cursor,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        cursor: result.cursor,
        has_next_page: result.has_next_page,
        query: result.queryInfo,
      },
    });
  } catch (error: unknown) {
    console.error("Twitter posts search GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search Twitter posts";
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
): Promise<NextResponse<TwitterPostSearchApiResponse>> {
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

    const username = (body.username as string)?.trim() || undefined;

    const dateParam =
      (body.date as string) ||
      (body.date_posted as string) ||
      (body.timeframe as string) ||
      undefined;

    const rawLimit = body.limit ? Number(body.limit) : 10;
    const limit = isNaN(rawLimit) ? 10 : rawLimit;

    const queryTypeParam = String(
      body.queryType || body.sort_by || "Latest"
    ).toLowerCase();
    const queryType = queryTypeParam === "top" ? "Top" : "Latest";

    const cursor = (body.cursor as string)?.trim() || undefined;

    if (!keywords && !username) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required field: 'keywords' or 'username' in JSON request body.",
        },
        { status: 400 }
      );
    }

    const result = await searchTwitterPosts({
      keywords,
      username,
      date: dateParam,
      limit,
      queryType,
      cursor,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        cursor: result.cursor,
        has_next_page: result.has_next_page,
        query: result.queryInfo,
      },
    });
  } catch (error: unknown) {
    console.error("Twitter posts search POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search Twitter posts";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
