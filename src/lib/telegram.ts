import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./db";
import { ApiError } from "./http";
import { users } from "./schema";
import type { TelegramIdentity } from "./types";

const telegramUserSchema = z.object({
  id: z.union([z.number(), z.string()]),
  username: z.string().optional(),
  first_name: z.string(),
  last_name: z.string().optional(),
  language_code: z.string().optional(),
});

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  return token;
}

export function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getDevelopmentTelegramIdentity(): TelegramIdentity {
  const fallback = {
    telegramUserId: "123456789",
    username: "local_noracare",
    firstName: "Local",
    lastName: "Tester",
    languageCode: "ru",
  };

  const raw = process.env.DEV_TELEGRAM_USER_JSON;
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = telegramUserSchema.parse(JSON.parse(raw));

    return {
      telegramUserId: String(parsed.id),
      username: parsed.username ?? null,
      firstName: parsed.first_name,
      lastName: parsed.last_name ?? null,
      languageCode: parsed.language_code ?? null,
    };
  } catch {
    return fallback;
  }
}

export function verifyTelegramInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new ApiError(401, "Telegram signature is missing.");
  }

  const entries = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort();

  const secret = crypto.createHmac("sha256", "WebAppData").update(getBotToken()).digest();
  const calculated = crypto.createHmac("sha256", secret).update(entries.join("\n")).digest("hex");

  if (
    hash.length !== calculated.length ||
    !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculated))
  ) {
    throw new ApiError(401, "Telegram signature is invalid.");
  }

  const authDate = Number(params.get("auth_date") ?? "0");
  if (authDate && Date.now() / 1000 - authDate > 24 * 60 * 60) {
    throw new ApiError(401, "Telegram auth data is stale.");
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    throw new ApiError(400, "Telegram user payload is missing.");
  }

  const parsed = telegramUserSchema.parse(JSON.parse(rawUser));

  return {
    telegramUserId: String(parsed.id),
    username: parsed.username ?? null,
    firstName: parsed.first_name,
    lastName: parsed.last_name ?? null,
    languageCode: parsed.language_code ?? null,
  } satisfies TelegramIdentity;
}

export async function upsertTelegramUser(identity: TelegramIdentity, options?: { markBotStarted?: boolean }) {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.telegramUserId, identity.telegramUserId)).limit(1);

  const values = {
    telegramUserId: identity.telegramUserId,
    username: identity.username,
    firstName: identity.firstName,
    lastName: identity.lastName,
    languageCode: identity.languageCode,
    updatedAt: new Date(),
    ...(options?.markBotStarted ? { botStartedAt: new Date() } : {}),
  };

  if (existing) {
    const [updated] = await db.update(users).set(values).where(eq(users.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      ...values,
      notificationsEnabled: null,
      notificationTimeLocal: null,
      timezone: null,
      botStartedAt: options?.markBotStarted ? new Date() : null,
    })
    .returning();

  return created;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? "Telegram API request failed.");
  }

  return payload.result.message_id as number;
}

export function buildOpenAppKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "Открыть NoraCare",
          web_app: {
            url: getAppUrl(),
          },
        },
      ],
    ],
  };
}

export async function sendStartMessage(chatId: string) {
  return sendTelegramMessage(
    chatId,
    "NoraCare готов помочь. Открывайте приложение, добавляйте питомцев и настраивайте напоминания по уходу.",
    buildOpenAppKeyboard(),
  );
}
