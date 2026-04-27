import { NextResponse } from "next/server";

import { handleRouteError, ApiError } from "@/lib/http";
import { runReminderCron } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
      throw new ApiError(401, "Unauthorized cron request.");
    }

    const stats = await runReminderCron();
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return handleRouteError(error);
  }
}
