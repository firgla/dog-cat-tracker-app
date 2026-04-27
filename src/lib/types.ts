import type { CareTypeKey, PetKind } from "./constants";

export type ApiUser = {
  id: string;
  telegramUserId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  notificationsEnabled: boolean | null;
  notificationTimeLocal: string | null;
  timezone: string | null;
  botStartedAt: string | null;
  needsOnboarding: boolean;
};

export type CareHistoryItem = {
  id: string;
  date: string;
  medicine: string;
  intervalDays: string;
  note: string;
  reminders: number[];
  createdAt: string;
};

export type CareState = {
  date: string;
  medicine: string;
  intervalDays: string;
  note: string;
  reminders: number[];
  nextDate: string | null;
  history: CareHistoryItem[];
};

export type ApiPet = {
  id: string;
  name: string;
  type: PetKind;
  breed: string;
  birthDate: string;
  importantInfo: string;
  photoUrl: string | null;
  care: Record<CareTypeKey, CareState>;
};

export type TelegramIdentity = {
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
};
