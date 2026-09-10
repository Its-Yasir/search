"use server";

import { db } from "@/db";
import { profileUrls } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface SaveUrlsResult {
  success: boolean;
  saved?: number;
  duplicates?: number;
  error?: string;
}

/**
 * Parses a raw string of URLs separated by commas and/or newlines,
 * trims whitespace, and filters out empty strings.
 */
function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

export async function saveProfileUrlsAction(
  rawUrls: string
): Promise<SaveUrlsResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "Unauthorized" };
  }

  const urls = parseUrls(rawUrls);

  if (urls.length === 0) {
    return { success: false, error: "Please enter at least one URL." };
  }

  // Basic URL validation
  const invalid = urls.filter((url) => {
    try {
      new URL(url);
      return false;
    } catch {
      return true;
    }
  });

  if (invalid.length > 0) {
    return {
      success: false,
      error: `Invalid URL(s): ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? ` …and ${invalid.length - 3} more` : ""}`,
    };
  }

  try {
    // Insert all URLs, ignoring duplicates via onConflictDoNothing
    const rows = urls.map((url) => ({
      url,
      userId: session.userId,
    }));

    const result = await db
      .insert(profileUrls)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: profileUrls.id });

    const saved = result.length;
    const duplicates = urls.length - saved;

    revalidatePath("/add");

    return { success: true, saved, duplicates };
  } catch (err) {
    console.error("Error saving profile URLs:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save URLs.",
    };
  }
}
