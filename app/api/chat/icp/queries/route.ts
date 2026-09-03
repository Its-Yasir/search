import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { specificIcps } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  generateQueriesForSingleSpecificIcp,
  generateQueriesForSpecificIcps,
} from "@/lib/ai/icp";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { specificIcpId, specificIcpIds } = body as {
      specificIcpId?: string;
      specificIcpIds?: string[];
    };

    // Case 1: Single specific ICP (one-by-one mode)
    if (specificIcpId) {
      const [ownedSpecificIcp] = await db
        .select()
        .from(specificIcps)
        .where(
          and(
            eq(specificIcps.id, specificIcpId),
            eq(specificIcps.userId, session.userId),
          ),
        )
        .limit(1);

      if (!ownedSpecificIcp) {
        return NextResponse.json(
          { error: "Specific ICP not found." },
          { status: 404 },
        );
      }

      const savedQueries = await generateQueriesForSingleSpecificIcp(
        ownedSpecificIcp,
        session.userId,
      );

      return NextResponse.json({ queries: savedQueries });
    }

    // Case 2: Array of specific ICP IDs
    if (!specificIcpIds?.length) {
      return NextResponse.json(
        { error: "specificIcpId or specificIcpIds is required" },
        { status: 400 },
      );
    }

    // Fetch and verify ownership of all specific ICPs
    const ownedSpecificIcps = await db
      .select()
      .from(specificIcps)
      .where(
        and(
          inArray(specificIcps.id, specificIcpIds),
          eq(specificIcps.userId, session.userId),
        ),
      );

    if (!ownedSpecificIcps.length) {
      return NextResponse.json(
        { error: "No valid specific ICPs found." },
        { status: 404 },
      );
    }

    const savedQueries = await generateQueriesForSpecificIcps(
      ownedSpecificIcps,
      session.userId,
    );

    return NextResponse.json({ queries: savedQueries });
  } catch (error: unknown) {
    console.error("Query generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate queries.",
      },
      { status: 500 },
    );
  }
}
