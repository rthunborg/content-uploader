import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { themes } from "./themes";

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text().notNull(),
    startsAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    themeId: uuid().references(() => themes.id, { onDelete: "set null" }),
    archivedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check("campaigns_date_order_check", sql`${table.endsAt} >= ${table.startsAt}`),
  ],
);

export const assetCampaigns = pgTable(
  "asset_campaigns",
  {
    assetId: uuid().notNull().references(() => assets.id, { onDelete: "cascade" }),
    campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.campaignId], name: "asset_campaigns_pkey" }),
    index("idx_asset_campaigns_campaign_id_asset_id").on(
      table.campaignId,
      table.assetId,
    ),
  ],
);

export type CampaignRow = typeof campaigns.$inferSelect;
export type AssetCampaignRow = typeof assetCampaigns.$inferSelect;
