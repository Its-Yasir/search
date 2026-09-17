import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pipelineManager } from "@/lib/pipeline/manager";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await pipelineManager.start(session.userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          message: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[API /api/pipeline/start] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to start pipeline",
      },
      { status: 500 }
    );
  }
}
