import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser, serializeUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { users } from "@/lib/schema";

export const runtime = "nodejs";

const preferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  notificationTimeLocal: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1).max(120),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireUser(request);
    const body = preferencesSchema.parse(await request.json());
    const db = getDb();

    const [user] = await db
      .update(users)
      .set({
        notificationsEnabled: body.notificationsEnabled,
        notificationTimeLocal: body.notificationTimeLocal,
        timezone: body.timezone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, currentUser.id))
      .returning();

    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
