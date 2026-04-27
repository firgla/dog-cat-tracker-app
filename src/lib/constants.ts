export const DEFAULT_REMINDERS = [30, 7, 1] as const;

export const CARE_TYPES = [
  { key: "complexVaccine", title: "Комплексная", shortTitle: "Комплекс" },
  { key: "rabiesVaccine", title: "Бешенство", shortTitle: "Бешенство" },
  { key: "tickTreatment", title: "Клещи", shortTitle: "Клещи" },
  { key: "parasiteTreatment", title: "Паразиты", shortTitle: "Паразиты" },
] as const;

export type CareTypeKey = (typeof CARE_TYPES)[number]["key"];
export type PetKind = "dog" | "cat";

export const BREEDS: Record<PetKind, string[]> = {
  dog: [
    "Без породы",
    "Австралийская овчарка",
    "Акита-ину",
    "Американский кокер-спаниель",
    "Бигль",
    "Бишон фризе",
    "Боксер",
    "Бордер-колли",
    "Вельш-корги пемброк",
    "Грейхаунд",
    "Джек-рассел-терьер",
    "Доберман",
    "Йоркширский терьер",
    "Кане-корсо",
    "Лабрадор-ретривер",
    "Мопс",
    "Немецкая овчарка",
    "Померанский шпиц",
    "Пудель той",
    "Ротвейлер",
    "Самоед",
    "Сиба-ину",
    "Сибирский хаски",
    "Такса стандартная",
    "Французский бульдог",
    "Чихуахуа",
  ],
  cat: [
    "Без породы",
    "Абиссинская",
    "Американская короткошерстная",
    "Бенгальская",
    "Британская короткошерстная",
    "Бурма",
    "Девон-рекс",
    "Донской сфинкс",
    "Канадский сфинкс",
    "Корниш-рекс",
    "Курильский бобтейл",
    "Манчкин",
    "Мейн-кун",
    "Невская маскарадная",
    "Норвежская лесная",
    "Ориентальная",
    "Персидская",
    "Русская голубая",
    "Рэгдолл",
    "Саванна",
    "Сиамская",
    "Сибирская",
    "Скоттиш-страйт",
    "Тайская",
    "Турецкая ангора",
    "Шотландская вислоухая",
  ],
};

export const CARE_TYPE_LABELS = Object.fromEntries(
  CARE_TYPES.map((item) => [item.key, item.title]),
) as Record<CareTypeKey, string>;

export function isCareTypeKey(value: string): value is CareTypeKey {
  return CARE_TYPES.some((item) => item.key === value);
}
