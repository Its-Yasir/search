import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pipelineManager } from "@/lib/pipeline/manager";
import { db } from "@/db";
import { profileUrls, companyEvents, companyDetails, companyPosts } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const state = pipelineManager.getStatus();

    // Query DB overview statistics
    const [totalUrlsRes] = await db
      .select({ count: count() })
      .from(profileUrls)
      .where(eq(profileUrls.userId, session.userId));

    const [pendingUrlsRes] = await db
      .select({ count: count() })
      .from(profileUrls)
      .where(
        and(
          eq(profileUrls.userId, session.userId),
          eq(profileUrls.status, "pending")
        )
      );

    const [completedUrlsRes] = await db
      .select({ count: count() })
      .from(profileUrls)
      .where(
        and(
          eq(profileUrls.userId, session.userId),
          eq(profileUrls.status, "completed")
        )
      );

    const [totalEventsRes] = await db
      .select({ count: count() })
      .from(companyEvents)
      .where(eq(companyEvents.userId, session.userId));

    const [totalPostsRes] = await db
      .select({ count: count() })
      .from(companyPosts)
      .innerJoin(
        companyDetails,
        eq(companyPosts.companyDetailId, companyDetails.id)
      )
      .where(eq(companyDetails.userId, session.userId));

    // If recentEvents in memory is empty, fetch the top 200 from DB
    let events = state.recentEvents;
    if (events.length === 0) {
      events = await db
        .select()
        .from(companyEvents)
        .where(eq(companyEvents.userId, session.userId))
        .orderBy(desc(companyEvents.createdAt))
        .limit(200);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...state,
        recentEvents: events,
        overview: {
          totalUrls: totalUrlsRes?.count || 0,
          pendingUrls: pendingUrlsRes?.count || 0,
          completedUrls: completedUrlsRes?.count || 0,
          totalEvents: totalEventsRes?.count || 0,
          totalPosts: totalPostsRes?.count || 0,
        },
      },
    });
  } catch (err) {
    console.error("[API /api/pipeline/status] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch pipeline status",
      },
      { status: 500 }
    );
  }
}
