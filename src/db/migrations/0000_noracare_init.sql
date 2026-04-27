CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "telegram_user_id" varchar(64) NOT NULL UNIQUE,
  "username" varchar(255),
  "first_name" varchar(255) NOT NULL,
  "last_name" varchar(255),
  "language_code" varchar(32),
  "notifications_enabled" boolean,
  "notification_time_local" varchar(5),
  "timezone" varchar(120),
  "bot_started_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" varchar(255) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "pets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "type" varchar(16) NOT NULL,
  "breed" varchar(255) NOT NULL,
  "birth_date" date,
  "important_info" text,
  "photo_blob_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "care_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pet_id" uuid NOT NULL REFERENCES "pets"("id") ON DELETE CASCADE,
  "care_type" varchar(64) NOT NULL,
  "draft_date" date,
  "medicine" varchar(255),
  "interval_days" integer,
  "note" text,
  "reminder_offsets" integer[] NOT NULL DEFAULT ARRAY[30, 7, 1]::integer[],
  "next_due_date" date,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "care_profiles_pet_type_unique" ON "care_profiles" ("pet_id", "care_type");

CREATE TABLE "care_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pet_id" uuid NOT NULL REFERENCES "pets"("id") ON DELETE CASCADE,
  "care_type" varchar(64) NOT NULL,
  "procedure_date" date NOT NULL,
  "medicine" varchar(255),
  "interval_days" integer,
  "note" text,
  "reminder_offsets" integer[] NOT NULL DEFAULT ARRAY[30, 7, 1]::integer[],
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "notification_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pet_id" uuid NOT NULL REFERENCES "pets"("id") ON DELETE CASCADE,
  "care_type" varchar(64) NOT NULL,
  "target_due_date" date NOT NULL,
  "offset_days" integer NOT NULL,
  "scheduled_for_local_date" date NOT NULL,
  "sent_at" timestamptz,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "telegram_message_id" varchar(64),
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_log_unique_delivery"
  ON "notification_log" ("user_id", "pet_id", "care_type", "target_due_date", "offset_days", "scheduled_for_local_date");
