import crypto from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "./db";
import { ApiError } from "./http";
import { sessions, users } from "./schema";
import { toIsoString } from "./utils";

const SESSION_COOKIE = "noracare_session";

type UserRow = typeof users.$inferSelect;

export function userNeedsOnboarding(user: UserRow) {
  return user.notificationsEnabled === null || !user.notificationTimeLocal || !user.timezone;
}

export function serializeUser(user: UserRow) {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    languageCode: user.languageCode,
    notificationsEnabled: user.notificationsEnabled,
    notificationTimeLocal: user.notificationTimeLocal,
    timezone: user.timezone,
    botStartedAt: toIsoString(user.botStartedAt),
    needsOnboarding: userNeedsOnboarding(user),
  };
}

function getSessionTtlDays() {
  const raw = Number(process.env.SESSION_TTL_DAYS ?? "30");
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export async function createSessionResponse(user: UserRow, payload?: Record<string, unknown>) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + getSessionTtlDays() * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    token,
    userId: user.id,
    expiresAt,
  });

  const response = NextResponse.json(payload ?? { user: serializeUser(user) });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

export async function requireUser(request: NextRequest) {
  const db = getDb();
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    throw new ApiError(401, "Authentication required.");
  }

  const [row] = await db
    .select({
      user: users,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    throw new ApiError(401, "Session expired.");
  }

  await db
    .update(sessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(sessions.id, row.sessionId));

  return row.user;
}
