import { NextRequest, NextResponse } from "next/server";
import {
  normalizeDatePosted,
  searchLinkedinPosts,
} from "@/lib/linkedin/client";
import {
  LinkedinPostSearchApiResponse,
  LinkedinPostItem,
} from "@/lib/linkedin/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<LinkedinPostSearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    const keywords = (
      searchParams.get("keywords") ||
      searchParams.get("query") ||
      searchParams.get("q") ||
      ""
    ).trim();

    const dateParam =
      searchParams.get("date") ||
      searchParams.get("date_posted") ||
      searchParams.get("timeframe") ||
      undefined;

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 10;

    const sortByParam = (
      searchParams.get("sort_by") ||
      searchParams.get("sortBy") ||
      "date"
    ).toLowerCase();
    const sortBy = sortByParam === "relevance" ? "relevance" : "date";

    const cursor = searchParams.get("cursor")?.trim() || undefined;

    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: 'keywords' (e.g., ?keywords=AI+Agents&date=past+7+days&limit=10)",
        },
        { status: 400 }
      );
    }

    const normalizedDate = normalizeDatePosted(dateParam);

    const rawResponse = await searchLinkedinPosts({
      keywords,
      date_posted: normalizedDate,
      sort_by: sortBy,
      limit,
      cursor,
    });

    const items: LinkedinPostItem[] = Array.isArray(rawResponse.items)
      ? rawResponse.items
      : [];

    const nextCursor = rawResponse.cursor || null;

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
        cursor: nextCursor,
        has_next_page: Boolean(nextCursor),
        query: {
          keywords,
          date_input: dateParam,
          normalized_date: normalizedDate,
          limit: Math.min(Math.max(limit, 1), 50),
          sort_by: sortBy,
        },
        paging: rawResponse.paging,
      },
    });
  } catch (error: unknown) {
    console.error("LinkedIn Posts Search GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search LinkedIn posts";
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
): Promise<NextResponse<LinkedinPostSearchApiResponse>> {
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

    const dateParam =
      (body.date as string) ||
      (body.date_posted as string) ||
      (body.timeframe as string) ||
      undefined;

    const rawLimit = body.limit ? Number(body.limit) : 10;
    const limit = isNaN(rawLimit) ? 10 : rawLimit;

    const sortByParam = String(
      body.sort_by || body.sortBy || "date"
    ).toLowerCase();
    const sortBy = sortByParam === "relevance" ? "relevance" : "date";

    const cursor = (body.cursor as string)?.trim() || undefined;

    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: 'keywords' in JSON request body.",
        },
        { status: 400 }
      );
    }

    const normalizedDate = normalizeDatePosted(dateParam);

    const rawResponse = await searchLinkedinPosts({
      keywords,
      date_posted: normalizedDate,
      sort_by: sortBy,
      limit,
      cursor,
    });

    const items: LinkedinPostItem[] = Array.isArray(rawResponse.items)
      ? rawResponse.items
      : [];

    const nextCursor = rawResponse.cursor || null;

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
        cursor: nextCursor,
        has_next_page: Boolean(nextCursor),
        query: {
          keywords,
          date_input: dateParam,
          normalized_date: normalizedDate,
          limit: Math.min(Math.max(limit, 1), 50),
          sort_by: sortBy,
        },
        paging: rawResponse.paging,
      },
    });
  } catch (error: unknown) {
    console.error("LinkedIn Posts Search POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search LinkedIn posts";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
