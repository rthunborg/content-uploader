import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./assets";

export const themes = pgTable(
  "themes",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    archivedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("themes_name_unique").on(table.name)],
);

export const assetThemes = pgTable(
  "asset_themes",
  {
    assetId: uuid().notNull().references(() => assets.id, { onDelete: "cascade" }),
    themeId: uuid().notNull().references(() => themes.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.themeId], name: "asset_themes_pkey" }),
    index("idx_asset_themes_theme_id_asset_id").on(table.themeId, table.assetId),
  ],
);

export type ThemeRow = typeof themes.$inferSelect;
export type AssetThemeRow = typeof assetThemes.$inferSelect;
