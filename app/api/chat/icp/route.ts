import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import {
  ICP_SYSTEM_PROMPT,
  ICP_TOOLS,
  executeSaveOrUpdateIcp,
  type SaveIcpToolArgs,
} from "@/lib/ai/icp";
import type { Icp } from "@/db/schema";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

export const maxDuration = 60; // 60 seconds max execution time

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured in .env. Please add your API key to proceed.",
        },
        { status: 500 },
      );
    }

    const body = await req.json();
    const {
      messages = [],
      currentIcpId,
      turnCount = 0,
    } = body as {
      messages: { role: "user" | "assistant"; content: string }[];
      currentIcpId?: string;
      turnCount: number;
    };

    if (turnCount >= 5) {
      return NextResponse.json(
        {
          error:
            "Maximum revision limit reached (5/5 turns). Please start a new ICP session.",
        },
        { status: 400 },
      );
    }

    // Format messages for OpenAI
    const formattedMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: ICP_SYSTEM_PROMPT,
      },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Request chat completion with tool calling
    const modelName = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: formattedMessages,
      tools: ICP_TOOLS,
      tool_choice: "auto",
      reasoning_effort: "none",
    });

    const choice = completion.choices[0];
    const initialMessage = choice.message;
    let savedIcp: Icp | null = null;
    let finalAssistantText = initialMessage.content || "";

    // Handle tool call if requested by the model
    if (initialMessage.tool_calls && initialMessage.tool_calls.length > 0) {
      for (const toolCall of initialMessage.tool_calls) {
        if (
          toolCall.type === "function" &&
          toolCall.function.name === "save_or_update_icp"
        ) {
          const parsedArgs = JSON.parse(
            toolCall.function.arguments || "{}",
          ) as SaveIcpToolArgs;

          // Always enforce currentIcpId if updating within the existing multi-turn session
          if (!parsedArgs.icpId && currentIcpId) {
            parsedArgs.icpId = currentIcpId;
          }

          // Execute tool with server-validated session user ID
          savedIcp = await executeSaveOrUpdateIcp(parsedArgs, session.userId);

          // Always provide a follow-up conversational reply
          const toolMessage: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "success",
              icpId: savedIcp.id,
              title: savedIcp.title,
              name: savedIcp.name,
              updatedAt: savedIcp.updatedAt,
            }),
          };

          const followUp = await openai.chat.completions.create({
            model: modelName,
            messages: [...formattedMessages, initialMessage, toolMessage],
            temperature: 1,
          });

          finalAssistantText =
            followUp.choices[0]?.message.content || finalAssistantText;
        }
      }
    }

    const newTurnCount = turnCount + 1;

    return NextResponse.json({
      message: finalAssistantText,
      icp: savedIcp,
      turnCount: newTurnCount,
      isComplete: newTurnCount >= 5,
    });
  } catch (error: unknown) {
    console.error("ICP Chat API error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to process chat request.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
