import "dotenv/config";
import { db } from "../db";
import { companyDetails, companyEvents, companyPosts } from "../db/schema";
import { count, sql } from "drizzle-orm";

async function main() {
  const allCompanies = await db
    .select({
      id: companyDetails.id,
      name: companyDetails.name,
    })
    .from(companyDetails);

  const totalCompanies = allCompanies.length;

  const eventCounts = await db
    .select({
      companyDetailId: companyEvents.companyDetailId,
      totalEvents: count(),
      trueEvents: sql<number>`count(*) filter (where ${companyEvents.hasEvent} = true)`,
    })
    .from(companyEvents)
    .groupBy(companyEvents.companyDetailId);

  const postCounts = await db
    .select({
      companyDetailId: companyPosts.companyDetailId,
      totalPosts: count(),
    })
    .from(companyPosts)
    .groupBy(companyPosts.companyDetailId);

  const totalEventsInTable = await db.select({ c: count() }).from(companyEvents);
  const totalPostsInTable = await db.select({ c: count() }).from(companyPosts);

  const eventMap = new Map(
    eventCounts.map((e) => [
      e.companyDetailId,
      { total: Number(e.totalEvents), trueEvents: Number(e.trueEvents) },
    ])
  );

  const postMap = new Map(
    postCounts.map((p) => [p.companyDetailId, Number(p.totalPosts)])
  );

  const companiesWithEvents: Array<{ id: string; name: string; events: number; trueEvents: number; posts: number }> = [];
  const companiesWithoutEvents: Array<{ id: string; name: string; posts: number }> = [];

  for (const comp of allCompanies) {
    const ev = eventMap.get(comp.id);
    const posts = postMap.get(comp.id) || 0;
    if (ev && ev.total > 0) {
      companiesWithEvents.push({
        id: comp.id,
        name: comp.name,
        events: ev.total,
        trueEvents: ev.trueEvents,
        posts,
      });
    } else {
      companiesWithoutEvents.push({
        id: comp.id,
        name: comp.name,
        posts,
      });
    }
  }

  // Also check companies with posts but no events vs companies with no posts
  const noEventsWithPosts = companiesWithoutEvents.filter(c => c.posts > 0);
  const noEventsNoPosts = companiesWithoutEvents.filter(c => c.posts === 0);

  console.log("==========================================");
  console.log("📊 COMPANY EVENTS BREAKDOWN");
  console.log("==========================================");
  console.log(`Total companies (company_details): ${totalCompanies}`);
  console.log(`Total events in DB (company_events): ${totalEventsInTable[0].c}`);
  console.log(`Total posts in DB (company_posts): ${totalPostsInTable[0].c}`);
  console.log("------------------------------------------");
  console.log(`✅ Companies WITH company_events:    ${companiesWithEvents.length}`);
  console.log(`❌ Companies WITHOUT company_events: ${companiesWithoutEvents.length}`);
  console.log(`   ├─ Without events, but have posts: ${noEventsWithPosts.length}`);
  console.log(`   └─ Without events, and 0 posts:    ${noEventsNoPosts.length}`);
  console.log("==========================================");
  console.log("");
  console.log("List of companies WITH company_events:");
  companiesWithEvents.forEach((c, i) => {
    console.log(` ${i + 1}. ${c.name} (${c.events} events, ${c.posts} posts) [id: ${c.id}]`);
  });
  if (noEventsWithPosts.length > 0) {
    console.log("");
    console.log("Companies with posts but NO events evaluated yet:");
    noEventsWithPosts.forEach((c, i) => {
      console.log(` ${i + 1}. ${c.name} (${c.posts} posts)`);
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
