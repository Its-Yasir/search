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

    const result = pipelineManager.stop();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[API /api/pipeline/stop] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to stop pipeline",
      },
      { status: 500 }
    );
  }
}
