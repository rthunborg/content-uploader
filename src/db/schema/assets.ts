import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const assets = pgTable("assets", {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type AssetRow = typeof assets.$inferSelect;
