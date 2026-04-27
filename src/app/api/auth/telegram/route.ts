import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSessionResponse, getUserFromSession, serializeUser } from "@/lib/auth";
import { handleRouteError, ApiError } from "@/lib/http";
import { getDevelopmentTelegramIdentity, upsertTelegramUser, verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

const authSchema = z.object({
  initData: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = authSchema.parse(await request.json());
    const initData = body.initData?.trim();

    if (!initData) {
      const existingUser = await getUserFromSession(request);

      if (existingUser) {
        return NextResponse.json({
          user: serializeUser(existingUser),
        });
      }
    }

    const identity =
      initData && initData.length > 0
        ? verifyTelegramInitData(initData)
        : process.env.NODE_ENV !== "production"
          ? getDevelopmentTelegramIdentity()
          : (() => {
              throw new ApiError(400, "Откройте NoraCare из Telegram, чтобы войти в приложение.");
            })();

    const user = await upsertTelegramUser(identity);

    return createSessionResponse(user, {
      user: serializeUser(user),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
