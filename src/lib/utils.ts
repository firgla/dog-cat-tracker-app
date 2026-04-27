import { addDays, format, parseISO } from "date-fns";

import { BREEDS, CARE_TYPES, DEFAULT_REMINDERS, type CareTypeKey, type PetKind } from "./constants";
import type { CareState } from "./types";

export function formatPetType(type: PetKind) {
  return type === "cat" ? "кошка" : "собака";
}

export function formatDate(dateValue: string | null | undefined, dateFormat = "d MMMM yyyy") {
  if (!dateValue) {
    return "";
  }

  try {
    return format(parseISO(dateValue), dateFormat);
  } catch {
    return "";
  }
}

export function pluralizeDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }

  return "дней";
}

export function calculateNextDate(dateValue: string | null | undefined, intervalDays: number | null | undefined) {
  if (!dateValue || !intervalDays || intervalDays < 1) {
    return null;
  }

  try {
    return format(addDays(parseISO(dateValue), intervalDays), "yyyy-MM-dd");
  } catch {
    return null;
  }
}

export function sortReminderOffsets(reminders: readonly number[]) {
  return [...new Set(reminders.map(Number).filter((value) => Number.isFinite(value) && value > 0))].sort(
    (left, right) => right - left,
  );
}

export function emptyCareState(): CareState {
  return {
    date: "",
    medicine: "",
    intervalDays: "",
    note: "",
    reminders: [...DEFAULT_REMINDERS],
    nextDate: null,
    history: [],
  };
}

export function emptyPetForm(type: PetKind = "dog") {
  return {
    name: "",
    type,
    breed: BREEDS[type][0],
    birthDate: "",
    importantInfo: "",
  };
}

export function assertPetBreed(type: PetKind, breed: string) {
  return BREEDS[type].includes(breed) ? breed : BREEDS[type][0];
}

export function getInitialCareMap() {
  return Object.fromEntries(CARE_TYPES.map((careType) => [careType.key, emptyCareState()])) as Record<
    CareTypeKey,
    CareState
  >;
}

export function toIsoString(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}
