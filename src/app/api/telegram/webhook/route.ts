import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/http";
import { sendStartMessage, upsertTelegramUser } from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    text?: string;
    from?: {
      id: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };
    chat?: {
      id: number | string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;

    if (!message?.text || message.text !== "/start" || !message.from) {
      return NextResponse.json({ ok: true });
    }

    await upsertTelegramUser(
      {
        telegramUserId: String(message.from.id),
        username: message.from.username ?? null,
        firstName: message.from.first_name ?? "Telegram user",
        lastName: message.from.last_name ?? null,
        languageCode: message.from.language_code ?? null,
      },
      { markBotStarted: true },
    );

    await sendStartMessage(String(message.chat?.id ?? message.from.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
