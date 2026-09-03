"use server";

import { db } from "@/db";
import { icps, specificIcps, queries, type Icp, type SpecificIcp, type Query } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getUserIcpsAction(): Promise<Icp[]> {
  const session = await getSession();
  if (!session || !session.userId) {
    return [];
  }

  try {
    const userIcps = await db
      .select()
      .from(icps)
      .where(eq(icps.userId, session.userId))
      .orderBy(desc(icps.updatedAt));

    return userIcps;
  } catch (err) {
    console.error("Error fetching user ICPs:", err);
    return [];
  }
}

export async function getIcpAction(icpId: string): Promise<Icp | null> {
  const session = await getSession();
  if (!session || !session.userId) {
    return null;
  }

  try {
    const [icp] = await db
      .select()
      .from(icps)
      .where(and(eq(icps.id, icpId), eq(icps.userId, session.userId)))
      .limit(1);

    return icp || null;
  } catch (err) {
    console.error("Error fetching ICP:", err);
    return null;
  }
}

export async function deleteIcpAction(icpId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 1. Fetch all specific ICP IDs belonging to this ICP & user
    const specificList = await db
      .select({ id: specificIcps.id })
      .from(specificIcps)
      .where(
        and(
          eq(specificIcps.icpId, icpId),
          eq(specificIcps.userId, session.userId)
        )
      );

    const specificIcpIds = specificList.map((s) => s.id);

    // 2. Delete all queries for those specific ICPs
    if (specificIcpIds.length > 0) {
      await db
        .delete(queries)
        .where(
          and(
            inArray(queries.specificIcpId, specificIcpIds),
            eq(queries.userId, session.userId)
          )
        );
    }

    // 3. Delete all specific ICPs belonging to this ICP
    await db
      .delete(specificIcps)
      .where(
        and(
          eq(specificIcps.icpId, icpId),
          eq(specificIcps.userId, session.userId)
        )
      );

    // 4. Delete the ICP itself
    await db
      .delete(icps)
      .where(and(eq(icps.id, icpId), eq(icps.userId, session.userId)));

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Error deleting ICP:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete ICP",
    };
  }
}

export async function getSpecificIcpsForIcpAction(icpId: string): Promise<SpecificIcp[]> {
  const session = await getSession();
  if (!session || !session.userId) {
    return [];
  }

  try {
    const results = await db
      .select()
      .from(specificIcps)
      .where(
        and(
          eq(specificIcps.icpId, icpId),
          eq(specificIcps.userId, session.userId),
        ),
      )
      .orderBy(desc(specificIcps.createdAt));

    return results;
  } catch (err) {
    console.error("Error fetching specific ICPs:", err);
    return [];
  }
}

export async function getQueriesForSpecificIcpsAction(
  specificIcpIds: string[],
): Promise<Query[]> {
  const session = await getSession();
  if (!session || !session.userId || specificIcpIds.length === 0) {
    return [];
  }

  try {
    const results = await db
      .select()
      .from(queries)
      .where(
        and(
          inArray(queries.specificIcpId, specificIcpIds),
          eq(queries.userId, session.userId),
        ),
      )
      .orderBy(desc(queries.createdAt));

    return results;
  } catch (err) {
    console.error("Error fetching queries:", err);
    return [];
  }
}

