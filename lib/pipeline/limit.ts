import { db } from "@/db";
import { companyDetails } from "@/db/schema";
import { desc, gte, eq, and, sql, count } from "drizzle-orm";

export const LINKEDIN_DAILY_COMPANY_LIMIT = 100;

export interface LinkedInDailyLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  limitReached: boolean;
  resetsAt: string | null;
  oldestFetchedAt: string | null;
  message?: string;
}

/**
 * Checks if the last 100 company profiles in the database were fetched in the last 24 hours.
 * LinkedIn enforces a safety threshold of ~100 company profiles per day.
 * If 100 profiles were fetched within the last 24 hours, the pipeline must stop.
 */
export async function checkLinkedInDailyLimit(
  userId?: string
): Promise<LinkedInDailyLimitStatus> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const userFilter = userId ? eq(companyDetails.userId, userId) : undefined;

  // 1. Fetch the last 100 company profiles ordered by most recent fetch
  const recentProfiles = await db
    .select({
      id: companyDetails.id,
      name: companyDetails.name,
      lastFetchedAt: companyDetails.lastFetchedAt,
      createdAt: companyDetails.createdAt,
    })
    .from(companyDetails)
    .where(userFilter)
    .orderBy(
      desc(
        sql`COALESCE(${companyDetails.lastFetchedAt}, ${companyDetails.createdAt})`
      )
    )
    .limit(LINKEDIN_DAILY_COMPANY_LIMIT);

  // 2. Count total profiles fetched in the last 24 hours
  const dateCoalesce = sql`COALESCE(${companyDetails.lastFetchedAt}, ${companyDetails.createdAt})`;
  const countCondition = userFilter
    ? and(userFilter, gte(dateCoalesce, oneDayAgo))
    : gte(dateCoalesce, oneDayAgo);

  const [countRes] = await db
    .select({ total: count() })
    .from(companyDetails)
    .where(countCondition);

  const totalInLast24h = Number(countRes?.total || 0);

  // Filter profiles within the last 24h from the recent 100
  const profilesInLastDay = recentProfiles.filter((p) => {
    const fetchDate = p.lastFetchedAt || p.createdAt;
    return fetchDate && new Date(fetchDate).getTime() >= oneDayAgo.getTime();
  });

  const used = Math.max(totalInLast24h, profilesInLastDay.length);
  const limitReached = used >= LINKEDIN_DAILY_COMPANY_LIMIT;
  const remaining = Math.max(0, LINKEDIN_DAILY_COMPANY_LIMIT - used);

  let resetsAt: string | null = null;
  let oldestFetchedAt: string | null = null;
  let message: string | undefined;

  if (limitReached && profilesInLastDay.length >= LINKEDIN_DAILY_COMPANY_LIMIT) {
    // The 100th most recent profile determines when the window drops below 100
    const profile100 = profilesInLastDay[LINKEDIN_DAILY_COMPANY_LIMIT - 1];
    const fetchDate = profile100?.lastFetchedAt || profile100?.createdAt;

    if (fetchDate) {
      const oldestTime = new Date(fetchDate).getTime();
      oldestFetchedAt = new Date(oldestTime).toISOString();
      const resetDate = new Date(oldestTime + 24 * 60 * 60 * 1000);
      resetsAt = resetDate.toISOString();

      const diffMs = resetDate.getTime() - Date.now();
      const diffMins = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      message = `LinkedIn daily limit reached: ${LINKEDIN_DAILY_COMPANY_LIMIT} company profiles fetched in the last 24 hours. The pipeline was stopped to protect your LinkedIn account. Next slot frees up in ~${timeStr} (at ${resetDate.toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      )}).`;
    }
  }

  return {
    limit: LINKEDIN_DAILY_COMPANY_LIMIT,
    used,
    remaining,
    limitReached,
    resetsAt,
    oldestFetchedAt,
    message,
  };
}
