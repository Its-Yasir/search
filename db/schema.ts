import { pgTable, text, timestamp, uuid, integer, pgEnum } from "drizzle-orm/pg-core";
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
