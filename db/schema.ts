import { pgTable, text, timestamp, uuid, integer, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const platformEnum = pgEnum("platform", [
  "x",
  "reddit",
  "linkedin",
  "youtube",
  "hackernews",
  "jobs",
  "trustpilot",
  "github",
]);

export const icps = pgTable("icps", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const specificIcps = pgTable("specific_icps", {
  id: uuid("id").defaultRandom().primaryKey(),
  icpId: uuid("icp_id")
    .notNull()
    .references(() => icps.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  whatToSearch: text("what_to_search"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profileUrls = pgTable("profile_urls", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  publicIdentifier: text("public_identifier"),
  numericIdentifier: integer("numeric_identifier"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  lastProcessedAt: timestamp("last_processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyDetails = pgTable("company_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileUrlId: uuid("profile_url_id")
    .references(() => profileUrls.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  unipileId: text("unipile_id"),
  entityUrn: text("entity_urn"),
  name: text("name").notNull(),
  publicIdentifier: text("public_identifier"),
  profileUrl: text("profile_url"),
  description: text("description"),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  followersCount: integer("followers_count"),
  employeeCount: text("employee_count"),
  location: text("location"),
  logoUrl: text("logo_url"),
  rawProfile: jsonb("raw_profile"),
  lastFetchedAt: timestamp("last_fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyPosts = pgTable("company_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyDetailId: uuid("company_detail_id")
    .notNull()
    .references(() => companyDetails.id, { onDelete: "cascade" }),
  socialPostId: text("social_post_id"),
  shareUrl: text("share_url"),
  postText: text("post_text"),
  postedAt: timestamp("posted_at"),
  parsedDatetime: timestamp("parsed_datetime"),
  reactionCounter: integer("reaction_counter").default(0),
  commentCounter: integer("comment_counter").default(0),
  repostCounter: integer("repost_counter").default(0),
  attachments: jsonb("attachments"),
  rawPost: jsonb("raw_post"),
  aiEvaluated: boolean("ai_evaluated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyEvents = pgTable("company_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyDetailId: uuid("company_detail_id")
    .notNull()
    .references(() => companyDetails.id, { onDelete: "cascade" }),
  postId: uuid("post_id").references(() => companyPosts.id, { onDelete: "set null" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  hasEvent: boolean("has_event").notNull().default(true),
  eventType: text("event_type").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  targetEntities: jsonb("target_entities"),
  industrySector: text("industry_sector"),
  leadOpportunity: text("lead_opportunity").notNull(),
  confidenceScore: integer("confidence_score").default(0),
  postUrl: text("post_url"),
  postDate: timestamp("post_date"),
  rawAiOutput: jsonb("raw_ai_output"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const queries = pgTable("queries", {
  id: uuid("id").defaultRandom().primaryKey(),
  specificIcpId: uuid("specific_icp_id")
    .notNull()
    .references(() => specificIcps.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  query: text("query").notNull().default(""),
  rating: integer("rating").notNull().default(0),
  must: text("must")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  optional: text("optional")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  negativeKeywords: text("negative_keywords")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  icps: many(icps),
  specificIcps: many(specificIcps),
  queries: many(queries),
  profileUrls: many(profileUrls),
  companyDetails: many(companyDetails),
  companyEvents: many(companyEvents),
}));

export const icpsRelations = relations(icps, ({ one, many }) => ({
  user: one(users, {
    fields: [icps.userId],
    references: [users.id],
  }),
  specificIcps: many(specificIcps),
}));

export const specificIcpsRelations = relations(specificIcps, ({ one, many }) => ({
  icp: one(icps, {
    fields: [specificIcps.icpId],
    references: [icps.id],
  }),
  user: one(users, {
    fields: [specificIcps.userId],
    references: [users.id],
  }),
  queries: many(queries),
}));

export const queriesRelations = relations(queries, ({ one }) => ({
  specificIcp: one(specificIcps, {
    fields: [queries.specificIcpId],
    references: [specificIcps.id],
  }),
  user: one(users, {
    fields: [queries.userId],
    references: [users.id],
  }),
}));

export const profileUrlsRelations = relations(profileUrls, ({ one }) => ({
  user: one(users, {
    fields: [profileUrls.userId],
    references: [users.id],
  }),
  companyDetail: one(companyDetails, {
    fields: [profileUrls.id],
    references: [companyDetails.profileUrlId],
  }),
}));

export const companyDetailsRelations = relations(companyDetails, ({ one, many }) => ({
  profileUrl: one(profileUrls, {
    fields: [companyDetails.profileUrlId],
    references: [profileUrls.id],
  }),
  user: one(users, {
    fields: [companyDetails.userId],
    references: [users.id],
  }),
  posts: many(companyPosts),
  events: many(companyEvents),
}));

export const companyPostsRelations = relations(companyPosts, ({ one, many }) => ({
  companyDetail: one(companyDetails, {
    fields: [companyPosts.companyDetailId],
    references: [companyDetails.id],
  }),
  events: many(companyEvents),
}));

export const companyEventsRelations = relations(companyEvents, ({ one }) => ({
  companyDetail: one(companyDetails, {
    fields: [companyEvents.companyDetailId],
    references: [companyDetails.id],
  }),
  post: one(companyPosts, {
    fields: [companyEvents.postId],
    references: [companyPosts.id],
  }),
  user: one(users, {
    fields: [companyEvents.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Icp = typeof icps.$inferSelect;
export type NewIcp = typeof icps.$inferInsert;

export type SpecificIcp = typeof specificIcps.$inferSelect;
export type NewSpecificIcp = typeof specificIcps.$inferInsert;

export type Query = typeof queries.$inferSelect;
export type NewQuery = typeof queries.$inferInsert;

export type Platform = (typeof platformEnum.enumValues)[number];

export type ProfileUrl = typeof profileUrls.$inferSelect;
export type NewProfileUrl = typeof profileUrls.$inferInsert;

export type CompanyDetail = typeof companyDetails.$inferSelect;
export type NewCompanyDetail = typeof companyDetails.$inferInsert;

export type CompanyPost = typeof companyPosts.$inferSelect;
export type NewCompanyPost = typeof companyPosts.$inferInsert;

export type CompanyEvent = typeof companyEvents.$inferSelect;
export type NewCompanyEvent = typeof companyEvents.$inferInsert;

