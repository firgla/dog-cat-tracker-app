import { and, eq, isNotNull } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";

import { CARE_TYPE_LABELS } from "./constants";
import { getDb } from "./db";
import { buildOpenAppKeyboard, sendTelegramMessage } from "./telegram";
import { careProfiles, notificationLog, pets, users } from "./schema";
import { formatDate, sortReminderOffsets } from "./utils";

function getLocalTimeParts(timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function shouldSendInThisHour(notificationTimeLocal: string, timezone: string) {
  const [targetHour] = notificationTimeLocal.split(":").map(Number);
  return getLocalTimeParts(timezone).hour === targetHour;
}

function buildReminderText(petName: string, careType: string, offsetDays: number, dueDate: string) {
  const when = offsetDays === 1 ? "завтра" : `через ${offsetDays} дн.`;
  return `Напоминание NoraCare: ${when} у ${petName} запланирована процедура "${careType}". Следующая дата: ${formatDate(dueDate)}.`;
}

export async function runReminderCron() {
  const db = getDb();
  const stats = {
    scannedUsers: 0,
    dueEvents: 0,
    sent: 0,
    failed: 0,
    duplicates: 0,
  };

  const availableUsers = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.notificationsEnabled, true),
        isNotNull(users.botStartedAt),
        isNotNull(users.notificationTimeLocal),
        isNotNull(users.timezone),
      ),
    );

  for (const user of availableUsers) {
    stats.scannedUsers += 1;

    if (!user.notificationTimeLocal || !user.timezone || !shouldSendInThisHour(user.notificationTimeLocal, user.timezone)) {
      continue;
    }

    const localParts = getLocalTimeParts(user.timezone);
    const dueProfiles = await db
      .select({
        petId: pets.id,
        petName: pets.name,
        careType: careProfiles.careType,
        nextDueDate: careProfiles.nextDueDate,
        reminderOffsets: careProfiles.reminderOffsets,
      })
      .from(careProfiles)
      .innerJoin(pets, eq(careProfiles.petId, pets.id))
      .where(and(eq(pets.ownerUserId, user.id), isNotNull(careProfiles.nextDueDate)));

    for (const profile of dueProfiles) {
      if (!profile.nextDueDate) {
        continue;
      }

      for (const offsetDays of sortReminderOffsets(profile.reminderOffsets)) {
        const scheduledDate = format(subDays(parseISO(profile.nextDueDate), offsetDays), "yyyy-MM-dd");

        if (scheduledDate !== localParts.date) {
          continue;
        }

        stats.dueEvents += 1;

        const [pendingLog] = await db
          .insert(notificationLog)
          .values({
            userId: user.id,
            petId: profile.petId,
            careType: profile.careType,
            targetDueDate: profile.nextDueDate,
            offsetDays,
            scheduledForLocalDate: localParts.date,
            status: "pending",
          })
          .onConflictDoNothing()
          .returning({
            id: notificationLog.id,
          });

        if (!pendingLog) {
          stats.duplicates += 1;
          continue;
        }

        try {
          const telegramMessageId = await sendTelegramMessage(
            user.telegramUserId,
            buildReminderText(
              profile.petName,
              CARE_TYPE_LABELS[profile.careType as keyof typeof CARE_TYPE_LABELS] ?? profile.careType,
              offsetDays,
              profile.nextDueDate,
            ),
            buildOpenAppKeyboard(),
          );

          await db
            .update(notificationLog)
            .set({
              status: "sent",
              sentAt: new Date(),
              telegramMessageId: String(telegramMessageId),
            })
            .where(eq(notificationLog.id, pendingLog.id));

          stats.sent += 1;
        } catch (error) {
          await db
            .update(notificationLog)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown Telegram error",
            })
            .where(eq(notificationLog.id, pendingLog.id));

          stats.failed += 1;
        }
      }
    }
  }

  return stats;
}
