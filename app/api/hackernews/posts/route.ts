import { NextRequest, NextResponse } from "next/server";
import { searchHackerNews } from "@/lib/hackernews/client";
import {
  HnSearchApiResponse,
  HnSort,
  HnTag,
} from "@/lib/hackernews/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<HnSearchApiResponse>> {
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

    const tagParam = (
      searchParams.get("tag") ||
      searchParams.get("type") ||
      undefined
    ) as HnTag | undefined;

    const sortParam = (
      searchParams.get("sort") ||
      searchParams.get("sort_by") ||
      "date"
    ).toLowerCase();
    const sort: HnSort = sortParam === "relevance" ? "relevance" : "date";

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : 10;

    const rawPage = searchParams.get("page");
    const page = rawPage ? parseInt(rawPage, 10) : 0;

    const minPointsParam =
      searchParams.get("min_points") || searchParams.get("minPoints");
    const minPoints = minPointsParam ? parseInt(minPointsParam, 10) : undefined;

    const minCommentsParam =
      searchParams.get("min_comments") || searchParams.get("minComments");
    const minComments = minCommentsParam
      ? parseInt(minCommentsParam, 10)
      : undefined;

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

    const result = await searchHackerNews({
      keywords,
      date: dateParam,
      tag: tagParam,
      sort,
      limit,
      page,
      minPoints,
      minComments,
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
    console.error("Hacker News search GET error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search Hacker News posts";
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
): Promise<NextResponse<HnSearchApiResponse>> {
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

    const tagParam = (body.tag as HnTag) || (body.type as HnTag) || undefined;

    const sortParam = String(
      body.sort || body.sort_by || "date"
    ).toLowerCase();
    const sort: HnSort = sortParam === "relevance" ? "relevance" : "date";

    const rawLimit = body.limit ? Number(body.limit) : 10;
    const limit = isNaN(rawLimit) ? 10 : rawLimit;

    const rawPage = body.page ? Number(body.page) : 0;
    const page = isNaN(rawPage) ? 0 : rawPage;

    const minPoints =
      body.min_points !== undefined
        ? Number(body.min_points)
        : body.minPoints !== undefined
        ? Number(body.minPoints)
        : undefined;

    const minComments =
      body.min_comments !== undefined
        ? Number(body.min_comments)
        : body.minComments !== undefined
        ? Number(body.minComments)
        : undefined;

    if (!keywords) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: 'keywords' in JSON request body.",
        },
        { status: 400 }
      );
    }

    const result = await searchHackerNews({
      keywords,
      date: dateParam,
      tag: tagParam,
      sort,
      limit,
      page,
      minPoints,
      minComments,
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
    console.error("Hacker News search POST error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to search Hacker News posts";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
