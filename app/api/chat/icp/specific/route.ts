import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { icps } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAndSaveSpecificIcps } from "@/lib/ai/icp";

export const maxDuration = 90;

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
    const { icpId } = body as { icpId: string };

    if (!icpId) {
      return NextResponse.json({ error: "icpId is required" }, { status: 400 });
    }

    // Verify ownership
    const [generalIcp] = await db
      .select()
      .from(icps)
      .where(and(eq(icps.id, icpId), eq(icps.userId, session.userId)))
      .limit(1);

    if (!generalIcp) {
      return NextResponse.json({ error: "ICP not found" }, { status: 404 });
    }

    const savedSpecificIcps = await generateAndSaveSpecificIcps(
      generalIcp,
      session.userId,
    );

    return NextResponse.json({ specificIcps: savedSpecificIcps });
  } catch (error: unknown) {
    console.error("Specific ICP generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate specific ICPs.",
      },
      { status: 500 },
    );
  }
}
