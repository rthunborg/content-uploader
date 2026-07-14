import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const ACCOUNT_STATES = [
  "invited",
  "active",
  "inactive_declined",
  "inactive_withdrawn",
  "deactivated",
] as const;

const ACCOUNT_STATE_CHECK_VALUES = sql.raw(
  ACCOUNT_STATES.map((state) => `'${state.replaceAll("'", "''")}'`).join(", "),
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey(),
    accountState: text({ enum: ACCOUNT_STATES }).notNull().default("invited"),
    email: text().notNull(),
    mobile: text(),
    invitedAt: timestamp({ withTimezone: true, mode: "date" }),
    firstAcceptedAt: timestamp({ withTimezone: true, mode: "date" }),
    firstUploadAt: timestamp({ withTimezone: true, mode: "date" }),
    lastLoginAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "profiles_account_state_check",
      sql`${table.accountState} in (${ACCOUNT_STATE_CHECK_VALUES})`,
    ),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
