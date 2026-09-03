import { NextRequest, NextResponse } from "next/server";
import { searchGitHub } from "@/lib/github/client";
import { GitHubSearchApiResponse, GitHubSearchType } from "@/lib/github/types";

export async function GET(
  request: NextRequest
): Promise<NextResponse<GitHubSearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    const keywords = (
      searchParams.get("keywords") ||
      searchParams.get("query") ||
      searchParams.get("q") ||
      ""
    ).trim();

    const rawType = (
      searchParams.get("type") ||
      searchParams.get("category") ||
      "repositories"
    ).toLowerCase();
    const type: GitHubSearchType =
      rawType === "issues" || rawType === "issue" || rawType === "discussions"
        ? "issues"
        : "repositories";

    const dateParam =
      searchParams.get("date") ||
      searchParams.get("date_posted") ||
      searchParams.get("timeframe") ||
      undefined;

    const sort = searchParams.get("sort") || undefined;

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

    const result = await searchGitHub({
      keywords,
      type,
      date: dateParam,
      sort,
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
    console.error("GitHub search GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search GitHub";
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
): Promise<NextResponse<GitHubSearchApiResponse>> {
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

    const rawType = String(
      body.type || body.category || "repositories"
    ).toLowerCase();
    const type: GitHubSearchType =
      rawType === "issues" || rawType === "issue" || rawType === "discussions"
        ? "issues"
        : "repositories";

    const dateParam =
      (body.date as string) ||
      (body.date_posted as string) ||
      (body.timeframe as string) ||
      undefined;

    const sort = (body.sort as string) || undefined;

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

    const result = await searchGitHub({
      keywords,
      type,
      date: dateParam,
      sort,
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
    console.error("GitHub search POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to search GitHub";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
