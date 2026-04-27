import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: varchar("telegram_user_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  languageCode: varchar("language_code", { length: 32 }),
  notificationsEnabled: boolean("notifications_enabled"),
  notificationTimeLocal: varchar("notification_time_local", { length: 5 }),
  timezone: varchar("timezone", { length: 120 }),
  botStartedAt: timestamp("bot_started_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const pets = pgTable("pets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  breed: varchar("breed", { length: 255 }).notNull(),
  birthDate: date("birth_date", { mode: "string" }),
  importantInfo: text("important_info"),
  photoBlobUrl: text("photo_blob_url"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const careProfiles = pgTable(
  "care_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    petId: uuid("pet_id")
      .references(() => pets.id, { onDelete: "cascade" })
      .notNull(),
    careType: varchar("care_type", { length: 64 }).notNull(),
    draftDate: date("draft_date", { mode: "string" }),
    medicine: varchar("medicine", { length: 255 }),
    intervalDays: integer("interval_days"),
    note: text("note"),
    reminderOffsets: integer("reminder_offsets")
      .array()
      .notNull()
      .default(sql`ARRAY[30, 7, 1]::integer[]`),
    nextDueDate: date("next_due_date", { mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    petTypeUnique: uniqueIndex("care_profiles_pet_type_unique").on(table.petId, table.careType),
  }),
);

export const careHistory = pgTable("care_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  petId: uuid("pet_id")
    .references(() => pets.id, { onDelete: "cascade" })
    .notNull(),
  careType: varchar("care_type", { length: 64 }).notNull(),
  procedureDate: date("procedure_date", { mode: "string" }).notNull(),
  medicine: varchar("medicine", { length: 255 }),
  intervalDays: integer("interval_days"),
  note: text("note"),
  reminderOffsets: integer("reminder_offsets")
    .array()
    .notNull()
    .default(sql`ARRAY[30, 7, 1]::integer[]`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    petId: uuid("pet_id")
      .references(() => pets.id, { onDelete: "cascade" })
      .notNull(),
    careType: varchar("care_type", { length: 64 }).notNull(),
    targetDueDate: date("target_due_date", { mode: "string" }).notNull(),
    offsetDays: integer("offset_days").notNull(),
    scheduledForLocalDate: date("scheduled_for_local_date", { mode: "string" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    telegramMessageId: varchar("telegram_message_id", { length: 64 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueDelivery: uniqueIndex("notification_log_unique_delivery").on(
      table.userId,
      table.petId,
      table.careType,
      table.targetDueDate,
      table.offsetDays,
      table.scheduledForLocalDate,
    ),
  }),
);
