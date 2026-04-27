import { and, desc, eq, inArray } from "drizzle-orm";

import { BREEDS, CARE_TYPES, DEFAULT_REMINDERS, type CareTypeKey, type PetKind, isCareTypeKey } from "./constants";
import { getDb } from "./db";
import { ApiError } from "./http";
import { careHistory, careProfiles, pets } from "./schema";
import type { ApiPet, CareHistoryItem } from "./types";
import { assertPetBreed, calculateNextDate, sortReminderOffsets, toIsoString } from "./utils";

type PetRow = typeof pets.$inferSelect;
type CareProfileRow = typeof careProfiles.$inferSelect;
type CareHistoryRow = typeof careHistory.$inferSelect;

export type PetInput = {
  name: string;
  type: PetKind;
  breed: string;
  birthDate?: string | null;
  importantInfo?: string | null;
};

export type CareProfileInput = {
  date?: string | null;
  medicine?: string | null;
  intervalDays?: number | null;
  note?: string | null;
  reminders?: number[];
};

export type CareHistoryInput = {
  date: string;
  medicine?: string | null;
  intervalDays?: number | null;
  note?: string | null;
  reminders?: number[];
};

function mapHistoryRow(row: CareHistoryRow): CareHistoryItem {
  return {
    id: row.id,
    date: row.procedureDate,
    medicine: row.medicine ?? "",
    intervalDays: row.intervalDays ? String(row.intervalDays) : "",
    note: row.note ?? "",
    reminders: sortReminderOffsets(row.reminderOffsets ?? DEFAULT_REMINDERS),
    createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
  };
}

function buildPetResponse(petRow: PetRow, profileRows: CareProfileRow[], historyRows: CareHistoryRow[]): ApiPet {
  const profileByType = new Map(profileRows.map((row) => [row.careType, row] as const));
  const historyByType = new Map<CareTypeKey, CareHistoryItem[]>();

  for (const row of historyRows) {
    if (!isCareTypeKey(row.careType)) {
      continue;
    }

    const existing = historyByType.get(row.careType) ?? [];
    existing.push(mapHistoryRow(row));
    historyByType.set(row.careType, existing);
  }

  const care = Object.fromEntries(
    CARE_TYPES.map((item) => {
      const profile = profileByType.get(item.key);

      return [
        item.key,
        {
          date: profile?.draftDate ?? "",
          medicine: profile?.medicine ?? "",
          intervalDays: profile?.intervalDays ? String(profile.intervalDays) : "",
          note: profile?.note ?? "",
          reminders: sortReminderOffsets(profile?.reminderOffsets ?? DEFAULT_REMINDERS),
          nextDate: profile?.nextDueDate ?? null,
          history: historyByType.get(item.key) ?? [],
        },
      ];
    }),
  ) as ApiPet["care"];

  return {
    id: petRow.id,
    name: petRow.name,
    type: (petRow.type === "cat" ? "cat" : "dog") satisfies PetKind,
    breed: petRow.breed,
    birthDate: petRow.birthDate ?? "",
    importantInfo: petRow.importantInfo ?? "",
    photoUrl: petRow.photoBlobUrl ?? null,
    care,
  };
}

async function touchPet(petId: string) {
  const db = getDb();

  await db
    .update(pets)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(pets.id, petId));
}

async function ensurePetOwned(userId: string, petId: string) {
  const db = getDb();
  const [petRow] = await db
    .select()
    .from(pets)
    .where(and(eq(pets.id, petId), eq(pets.ownerUserId, userId)))
    .limit(1);

  if (!petRow) {
    throw new ApiError(404, "Pet not found.");
  }

  return petRow;
}

async function ensureCareProfileRow(petId: string, careType: CareTypeKey) {
  const db = getDb();

  await db
    .insert(careProfiles)
    .values({
      petId,
      careType,
      reminderOffsets: [...DEFAULT_REMINDERS],
    })
    .onConflictDoNothing();

  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(and(eq(careProfiles.petId, petId), eq(careProfiles.careType, careType)))
    .limit(1);

  if (!profile) {
    throw new ApiError(500, "Failed to initialize pet care profile.");
  }

  return profile;
}

async function getLatestHistoryRecord(petId: string, careType: CareTypeKey) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(careHistory)
    .where(and(eq(careHistory.petId, petId), eq(careHistory.careType, careType)))
    .orderBy(desc(careHistory.procedureDate), desc(careHistory.createdAt))
    .limit(1);

  return row ?? null;
}

async function getPetBundle(userId: string, petId: string) {
  const db = getDb();
  const petRow = await ensurePetOwned(userId, petId);
  const [profileRows, historyRows] = await Promise.all([
    db.select().from(careProfiles).where(eq(careProfiles.petId, petId)),
    db
      .select()
      .from(careHistory)
      .where(eq(careHistory.petId, petId))
      .orderBy(desc(careHistory.procedureDate), desc(careHistory.createdAt)),
  ]);

  return buildPetResponse(petRow, profileRows, historyRows);
}

export async function listPetsForUser(userId: string) {
  const db = getDb();
  const petRows = await db.select().from(pets).where(eq(pets.ownerUserId, userId)).orderBy(desc(pets.updatedAt));

  if (!petRows.length) {
    return [] as ApiPet[];
  }

  const petIds = petRows.map((row) => row.id);
  const [profileRows, historyRows] = await Promise.all([
    db.select().from(careProfiles).where(inArray(careProfiles.petId, petIds)),
    db
      .select()
      .from(careHistory)
      .where(inArray(careHistory.petId, petIds))
      .orderBy(desc(careHistory.procedureDate), desc(careHistory.createdAt)),
  ]);

  return petRows.map((petRow) =>
    buildPetResponse(
      petRow,
      profileRows.filter((row) => row.petId === petRow.id),
      historyRows.filter((row) => row.petId === petRow.id),
    ),
  );
}

export async function getPetForUser(userId: string, petId: string) {
  return getPetBundle(userId, petId);
}

export async function createPetForUser(userId: string, input: PetInput) {
  const db = getDb();
  const [petRow] = await db
    .insert(pets)
    .values({
      ownerUserId: userId,
      name: input.name.trim(),
      type: input.type,
      breed: assertPetBreed(input.type, input.breed),
      birthDate: input.birthDate || null,
      importantInfo: input.importantInfo?.trim() || null,
    })
    .returning();

  await db.insert(careProfiles).values(
    CARE_TYPES.map((item) => ({
      petId: petRow.id,
      careType: item.key,
      reminderOffsets: [...DEFAULT_REMINDERS],
    })),
  );

  return getPetBundle(userId, petRow.id);
}

export async function updatePetForUser(userId: string, petId: string, input: Partial<PetInput>) {
  const db = getDb();
  const existing = await ensurePetOwned(userId, petId);
  const nextType = (input.type ?? (existing.type === "cat" ? "cat" : "dog")) as PetKind;

  await db
    .update(pets)
    .set({
      name: input.name?.trim() ?? existing.name,
      type: nextType,
      breed: assertPetBreed(nextType, input.breed ?? existing.breed),
      birthDate: input.birthDate !== undefined ? input.birthDate || null : existing.birthDate,
      importantInfo:
        input.importantInfo !== undefined ? input.importantInfo?.trim() || null : existing.importantInfo,
      updatedAt: new Date(),
    })
    .where(eq(pets.id, petId));

  return getPetBundle(userId, petId);
}

export async function deletePetForUser(userId: string, petId: string) {
  const db = getDb();
  await ensurePetOwned(userId, petId);
  await db.delete(pets).where(eq(pets.id, petId));
}

export async function updatePetPhotoForUser(userId: string, petId: string, photoUrl: string) {
  const db = getDb();
  await ensurePetOwned(userId, petId);

  await db
    .update(pets)
    .set({
      photoBlobUrl: photoUrl,
      updatedAt: new Date(),
    })
    .where(eq(pets.id, petId));

  return getPetBundle(userId, petId);
}

export async function listCareForUser(userId: string, petId: string) {
  const pet = await getPetBundle(userId, petId);
  return pet.care;
}

export async function updateCareProfileForUser(
  userId: string,
  petId: string,
  careType: CareTypeKey,
  input: CareProfileInput,
) {
  const db = getDb();
  await ensurePetOwned(userId, petId);
  const profile = await ensureCareProfileRow(petId, careType);
  const latestHistory = await getLatestHistoryRecord(petId, careType);

  const draftDate = input.date !== undefined ? input.date || null : profile.draftDate;
  const medicine = input.medicine !== undefined ? input.medicine?.trim() || null : profile.medicine;
  const intervalDays = input.intervalDays !== undefined ? input.intervalDays : profile.intervalDays;
  const note = input.note !== undefined ? input.note?.trim() || null : profile.note;
  const reminders = input.reminders ? sortReminderOffsets(input.reminders) : sortReminderOffsets(profile.reminderOffsets);
  const anchorDate = draftDate ?? latestHistory?.procedureDate ?? null;
  const interval = intervalDays ?? latestHistory?.intervalDays ?? null;

  await db
    .update(careProfiles)
    .set({
      draftDate,
      medicine,
      intervalDays,
      note,
      reminderOffsets: reminders,
      nextDueDate: calculateNextDate(anchorDate, interval),
      updatedAt: new Date(),
    })
    .where(eq(careProfiles.id, profile.id));

  await touchPet(petId);
  return getPetBundle(userId, petId);
}

export async function addCareHistoryForUser(
  userId: string,
  petId: string,
  careType: CareTypeKey,
  input: CareHistoryInput,
) {
  const db = getDb();
  await ensurePetOwned(userId, petId);
  const profile = await ensureCareProfileRow(petId, careType);
  const reminders = sortReminderOffsets(input.reminders ?? profile.reminderOffsets ?? DEFAULT_REMINDERS);
  const intervalDays = input.intervalDays ?? profile.intervalDays ?? null;

  await db.insert(careHistory).values({
    petId,
    careType,
    procedureDate: input.date,
    medicine: input.medicine?.trim() || null,
    intervalDays,
    note: input.note?.trim() || null,
    reminderOffsets: reminders,
  });

  await db
    .update(careProfiles)
    .set({
      draftDate: null,
      medicine: null,
      intervalDays,
      note: null,
      reminderOffsets: reminders,
      nextDueDate: calculateNextDate(input.date, intervalDays),
      updatedAt: new Date(),
    })
    .where(eq(careProfiles.id, profile.id));

  await touchPet(petId);
  return getPetBundle(userId, petId);
}

export async function deleteCareHistoryForUser(
  userId: string,
  petId: string,
  careType: CareTypeKey,
  recordId: string,
) {
  const db = getDb();
  await ensurePetOwned(userId, petId);

  const [deleted] = await db
    .delete(careHistory)
    .where(and(eq(careHistory.id, recordId), eq(careHistory.petId, petId), eq(careHistory.careType, careType)))
    .returning();

  if (!deleted) {
    throw new ApiError(404, "Care history record not found.");
  }

  const profile = await ensureCareProfileRow(petId, careType);
  const latestHistory = await getLatestHistoryRecord(petId, careType);
  const anchorDate = profile.draftDate ?? latestHistory?.procedureDate ?? null;
  const interval = profile.intervalDays ?? latestHistory?.intervalDays ?? null;

  await db
    .update(careProfiles)
    .set({
      nextDueDate: calculateNextDate(anchorDate, interval),
      updatedAt: new Date(),
    })
    .where(eq(careProfiles.id, profile.id));

  await touchPet(petId);
  return getPetBundle(userId, petId);
}

export function assertPetType(value: string): PetKind {
  if (value === "cat" || value === "dog") {
    return value;
  }

  throw new ApiError(400, "Unsupported pet type.");
}

export function assertCareType(value: string): CareTypeKey {
  if (isCareTypeKey(value)) {
    return value;
  }

  throw new ApiError(400, "Unsupported care type.");
}

export function getDefaultBreed(type: PetKind) {
  return BREEDS[type][0];
}
