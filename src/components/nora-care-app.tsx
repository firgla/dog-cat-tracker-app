/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";

import { BREEDS, CARE_TYPES, DEFAULT_REMINDERS, type CareTypeKey, type PetKind } from "@/lib/constants";
import type { ApiPet, ApiUser } from "@/lib/types";
import { emptyPetForm, formatDate, formatPetType, pluralizeDays } from "@/lib/utils";

type Screen = "home" | "form" | "detail";
type PetFormState = ReturnType<typeof emptyPetForm>;
type PreferencesFormState = {
  notificationsEnabled: boolean;
  notificationTimeLocal: string;
  timezone: string;
};

type BootstrapResult = {
  user: ApiUser;
  pets: ApiPet[];
};

async function apiFetch<T>(input: string, init?: RequestInit) {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "content-type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed.");
  }

  return payload as T;
}

function serializeTelegramPayload(pets: ApiPet[]) {
  return {
    pets: pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      type: formatPetType(pet.type),
      breed: pet.breed,
      birthDate: pet.birthDate,
      importantInfo: pet.importantInfo,
      photo: pet.photoUrl,
      care: CARE_TYPES.map((careType) => ({
        title: careType.title,
        date: pet.care[careType.key].date,
        note: pet.care[careType.key].note,
        medicine: pet.care[careType.key].medicine,
        intervalDays: pet.care[careType.key].intervalDays,
        nextDate: pet.care[careType.key].nextDate,
        reminders: pet.care[careType.key].reminders,
        history: pet.care[careType.key].history,
      })),
    })),
  };
}

export function NoraCareApp() {
  const [status, setStatus] = useState<"booting" | "ready" | "needs-telegram" | "error">("booting");
  const [screen, setScreen] = useState<Screen>("home");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [pets, setPets] = useState<ApiPet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [editingPetId, setEditingPetId] = useState("");
  const [activeCareKey, setActiveCareKey] = useState<CareTypeKey>(CARE_TYPES[0].key);
  const [petForm, setPetForm] = useState<PetFormState>(emptyPetForm());
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [petPhotoPreview, setPetPhotoPreview] = useState<string | null>(null);
  const [preferencesForm, setPreferencesForm] = useState<PreferencesFormState>({
    notificationsEnabled: true,
    notificationTimeLocal: "09:00",
    timezone: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) ?? null, [pets, selectedPetId]);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    void (async () => {
      try {
        const initData = tg?.initData?.trim() ?? "";
        let bootstrap: BootstrapResult | null = null;

        try {
          const meResponse = await apiFetch<{ user: ApiUser }>("/api/me");
          const petsResponse = await apiFetch<{ pets: ApiPet[] }>("/api/pets");

          bootstrap = {
            user: meResponse.user,
            pets: petsResponse.pets,
          };
        } catch (error) {
          const isUnauthorized =
            error instanceof Error &&
            (error.message === "Authentication required." || error.message === "Session expired.");

          if (!isUnauthorized) {
            throw error;
          }

          if (!initData) {
            setErrorMessage("Откройте NoraCare из Telegram при первом входе. После этого приложение будет доступно и в браузере по текущей ссылке.");
            setStatus("needs-telegram");
            return;
          }

          const authResponse = await apiFetch<{ user: ApiUser }>("/api/auth/telegram", {
            method: "POST",
            body: JSON.stringify({ initData }),
          });
          const petsResponse = await apiFetch<{ pets: ApiPet[] }>("/api/pets");

          bootstrap = {
            user: authResponse.user,
            pets: petsResponse.pets,
          };
        }

        if (!bootstrap) {
          throw new Error("Не удалось инициализировать приложение.");
        }

        setUser(bootstrap.user);
        setPets(bootstrap.pets);
        setSelectedPetId(bootstrap.pets[0]?.id ?? "");
        setPreferencesForm({
          notificationsEnabled: bootstrap.user.notificationsEnabled ?? true,
          notificationTimeLocal: bootstrap.user.notificationTimeLocal ?? "09:00",
          timezone: bootstrap.user.timezone ?? browserTimeZone,
        });
        setStatus("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть приложение.");
        setStatus("error");
      }
    })();
  }, [browserTimeZone]);

  useEffect(() => {
    return () => {
      if (petPhotoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(petPhotoPreview);
      }
    };
  }, [petPhotoPreview]);

  function showNotice(nextMessage: string) {
    setMessage(nextMessage);
    setErrorMessage(null);
  }

  function showError(nextMessage: string) {
    setErrorMessage(nextMessage);
    setMessage(null);
  }

  function upsertPet(nextPet: ApiPet, placeFirst = false) {
    setPets((currentPets) => {
      const withoutCurrent = currentPets.filter((pet) => pet.id !== nextPet.id);
      return placeFirst || !currentPets.some((pet) => pet.id === nextPet.id)
        ? [nextPet, ...withoutCurrent]
        : currentPets.map((pet) => (pet.id === nextPet.id ? nextPet : pet));
    });
  }

  function updateSelectedPetLocal(updater: (pet: ApiPet) => ApiPet) {
    setPets((currentPets) => currentPets.map((pet) => (pet.id === selectedPetId ? updater(pet) : pet)));
  }

  function openCreateForm() {
    setEditingPetId("");
    setPetForm(emptyPetForm());
    setPetPhotoFile(null);
    setPetPhotoPreview(null);
    setScreen("form");
  }

  function openEditForm(pet: ApiPet) {
    setEditingPetId(pet.id);
    setPetForm({
      name: pet.name,
      type: pet.type,
      breed: pet.breed,
      birthDate: pet.birthDate,
      importantInfo: pet.importantInfo,
    });
    setPetPhotoFile(null);
    setPetPhotoPreview(pet.photoUrl);
    setScreen("form");
  }

  async function savePet() {
    if (!petForm.name.trim()) {
      showError("Укажите имя питомца.");
      return;
    }

    setIsSavingPet(true);

    try {
      const response = await apiFetch<{ pet: ApiPet }>(editingPetId ? `/api/pets/${editingPetId}` : "/api/pets", {
        method: editingPetId ? "PATCH" : "POST",
        body: JSON.stringify(petForm),
      });

      let nextPet = response.pet;

      if (petPhotoFile) {
        const formData = new FormData();
        formData.append("file", petPhotoFile);
        const uploadResponse = await apiFetch<{ pet: ApiPet }>(`/api/pets/${nextPet.id}/photo`, {
          method: "POST",
          body: formData,
        });
        nextPet = uploadResponse.pet;
      }

      upsertPet(nextPet, !editingPetId);
      setSelectedPetId(nextPet.id);
      setScreen("detail");
      showNotice(editingPetId ? "Карточка питомца обновлена." : "Питомец добавлен.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось сохранить питомца.");
    } finally {
      setIsSavingPet(false);
    }
  }

  async function removePet(petId: string) {
    const currentPet = pets.find((pet) => pet.id === petId);
    if (!currentPet || !window.confirm(`Удалить питомца ${currentPet.name}? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await apiFetch<{ ok: true }>(`/api/pets/${petId}`, { method: "DELETE" });
      const nextPets = pets.filter((pet) => pet.id !== petId);
      setPets(nextPets);
      setSelectedPetId(nextPets[0]?.id ?? "");
      setScreen("home");
      showNotice("Питомец удален.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось удалить питомца.");
    }
  }

  async function savePreferences() {
    setIsSavingPreferences(true);

    try {
      const response = await apiFetch<{ user: ApiUser }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(preferencesForm),
      });

      setUser(response.user);
      setPreferencesForm({
        notificationsEnabled: response.user.notificationsEnabled ?? true,
        notificationTimeLocal: response.user.notificationTimeLocal ?? "09:00",
        timezone: response.user.timezone ?? browserTimeZone,
      });
      showNotice("Настройки уведомлений сохранены.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось сохранить настройки.");
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function persistCareProfile(careKey: CareTypeKey, overrides: Partial<ApiPet["care"][CareTypeKey]>) {
    if (!selectedPet) {
      return;
    }

    const currentCare = selectedPet.care[careKey];
    const nextCare = {
      ...currentCare,
      ...overrides,
    };

    try {
      const response = await apiFetch<{ pet: ApiPet }>(`/api/pets/${selectedPet.id}/care/${careKey}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: nextCare.date || null,
          medicine: nextCare.medicine || null,
          intervalDays: nextCare.intervalDays ? Number(nextCare.intervalDays) : null,
          note: nextCare.note || null,
          reminders: nextCare.reminders,
        }),
      });

      upsertPet(response.pet);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось сохранить данные ухода.");
    }
  }

  async function addHistoryRecord(careKey: CareTypeKey) {
    if (!selectedPet) {
      return;
    }

    const care = selectedPet.care[careKey];
    if (!care.date) {
      showError("Укажите дату записи.");
      return;
    }

    try {
      const response = await apiFetch<{ pet: ApiPet }>(`/api/pets/${selectedPet.id}/care/${careKey}/history`, {
        method: "POST",
        body: JSON.stringify({
          date: care.date,
          medicine: care.medicine || null,
          intervalDays: care.intervalDays ? Number(care.intervalDays) : null,
          note: care.note || null,
          reminders: care.reminders,
        }),
      });

      upsertPet(response.pet);
      showNotice("Запись добавлена в историю.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось сохранить запись.");
    }
  }

  async function deleteHistoryRecord(careKey: CareTypeKey, recordId: string) {
    if (!selectedPet || !window.confirm("Удалить эту запись из истории?")) {
      return;
    }

    try {
      const response = await apiFetch<{ pet: ApiPet }>(`/api/pets/${selectedPet.id}/care/${careKey}/history/${recordId}`, {
        method: "DELETE",
      });

      upsertPet(response.pet);
      showNotice("Запись удалена.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Не удалось удалить запись.");
    }
  }

  function sendTelegramSnapshot() {
    const payload = serializeTelegramPayload(pets);
    const tg = window.Telegram?.WebApp;

    if (tg?.sendData) {
      tg.sendData(JSON.stringify(payload));
      showNotice("Данные отправлены в Telegram.");
      return;
    }

    console.log("Telegram payload", payload);
    showNotice("Telegram Web App недоступен. Данные выведены в консоль браузера.");
  }

  const activeScreen = screen === "detail" && !selectedPet ? "home" : screen;

  if (status === "booting") {
    return (
      <main className="app-shell">
        <section className="screen">
          <div className="loading-card">
            <h2>Подключаем NoraCare</h2>
            <p className="helper-text">Проверяем Telegram-сессию, загружаем ваших питомцев и настройки уведомлений.</p>
          </div>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="app-shell">
        <section className="screen">
          <div className="loading-card">
            <h2>Не удалось открыть NoraCare</h2>
            <p className="helper-text">{errorMessage ?? "Попробуйте обновить страницу или открыть приложение из Telegram."}</p>
          </div>
        </section>
      </main>
    );
  }

  if (status === "needs-telegram") {
    return (
      <main className="app-shell">
        <section className="screen">
          <div className="loading-card">
            <h2>Откройте NoraCare из Telegram</h2>
            <p className="helper-text">
              {errorMessage ??
                "Для первого входа нужен запуск из Telegram Web App. После авторизации приложение продолжит работать по этой ссылке и в обычном браузере."}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell app">
      <header className="header">
        <div className="brand">
          <div className="logo">NC</div>
          <div>
            <h1>NoraCare</h1>
            <p>Трекер для питомцев</p>
          </div>
        </div>
        <p className="header-meta">
          {user ? `${user.firstName}${user.username ? ` · @${user.username}` : ""}` : "Telegram user"}
        </p>
      </header>

      <section className="screen">
        <div className="stack">
          {message ? <div className="status-banner">{message}</div> : null}
          {errorMessage ? <div className="status-banner error">{errorMessage}</div> : null}

          {user?.needsOnboarding ? (
            <section className="onboarding-card">
              <h2>Настройте уведомления</h2>
              <p className="helper-text">
                Это обязательный шаг для первого запуска. Включите уведомления и задайте локальное время доставки.
              </p>

              <label>
                <input
                  checked={preferencesForm.notificationsEnabled}
                  type="checkbox"
                  onChange={(event) =>
                    setPreferencesForm((current) => ({
                      ...current,
                      notificationsEnabled: event.target.checked,
                    }))
                  }
                />
                Получать уведомления в Telegram
              </label>

              <div className="field-grid">
                <div>
                  <label htmlFor="notification_time_local">Время отправки</label>
                  <input
                    id="notification_time_local"
                    type="time"
                    value={preferencesForm.notificationTimeLocal}
                    onChange={(event) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        notificationTimeLocal: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="timezone">Таймзона</label>
                  <input
                    id="timezone"
                    value={preferencesForm.timezone}
                    onChange={(event) =>
                      setPreferencesForm((current) => ({
                        ...current,
                        timezone: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <button className="primary-btn" disabled={isSavingPreferences} type="button" onClick={() => void savePreferences()}>
                {isSavingPreferences ? "Сохраняем..." : "Сохранить настройки"}
              </button>
            </section>
          ) : null}

          {activeScreen === "home" ? (
            <section className="pet-list">
              {!pets.length ? (
                <div className="empty-state">
                  <p className="empty-note">
                    Пока нет питомцев. Начните с первой карточки, а дальше мы добавим вакцинации и обработки.
                  </p>
                  <button className="add-card" type="button" onClick={openCreateForm}>
                    <span className="add-icon">+</span>
                    <strong>Добавить питомца</strong>
                  </button>
                </div>
              ) : (
                <>
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      className="pet-card"
                      type="button"
                      onClick={() => {
                        setSelectedPetId(pet.id);
                        setScreen("detail");
                      }}
                    >
                      <div className="pet-photo">
                        {pet.photoUrl ? <img alt={pet.name} src={pet.photoUrl} /> : pet.name}
                      </div>
                      <div>
                        <h2>{pet.name}</h2>
                        <p>{formatPetType(pet.type)} · {pet.breed}</p>
                        <p>{pet.birthDate ? `Дата рождения: ${formatDate(pet.birthDate)}` : "Дата рождения не указана"}</p>
                      </div>
                      <span className="arrow">›</span>
                    </button>
                  ))}

                  <button className="add-card" type="button" onClick={openCreateForm}>
                    <span className="add-icon">+</span>
                    <strong>Добавить питомца</strong>
                  </button>
                </>
              )}
            </section>
          ) : null}

          {activeScreen === "form" ? (
            <section className="form-card">
              <div className="form-title">
                <button className="back-btn" type="button" onClick={() => setScreen("home")}>
                  ‹
                </button>
                <h2>{editingPetId ? "Изменить питомца" : "Добавить питомца"}</h2>
              </div>

              <label htmlFor="pet_name">Имя</label>
              <input
                id="pet_name"
                placeholder="Например, Нора"
                value={petForm.name}
                onChange={(event) => setPetForm((current) => ({ ...current, name: event.target.value }))}
              />

              <div className="field-grid">
                <div>
                  <label htmlFor="pet_type">Тип животного</label>
                  <select
                    id="pet_type"
                    value={petForm.type}
                  onChange={(event) => {
                      const type = event.target.value as PetKind;
                      setPetForm((current) => ({
                        ...current,
                        type,
                        breed: BREEDS[type][0],
                      }));
                    }}
                  >
                    <option value="dog">Собака</option>
                    <option value="cat">Кошка</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pet_breed">Порода</label>
                  <select
                    id="pet_breed"
                    value={petForm.breed}
                    onChange={(event) => setPetForm((current) => ({ ...current, breed: event.target.value }))}
                  >
                    {BREEDS[petForm.type].map((breed) => (
                      <option key={breed} value={breed}>
                        {breed}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label htmlFor="pet_birth_date">Дата рождения</label>
              <input
                id="pet_birth_date"
                type="date"
                value={petForm.birthDate}
                onChange={(event) => setPetForm((current) => ({ ...current, birthDate: event.target.value }))}
              />

              <label htmlFor="pet_important_info">Важная информация</label>
              <textarea
                id="pet_important_info"
                placeholder="Например, противопоказанные препараты, аллергии, особенности породы или рекомендации врача"
                value={petForm.importantInfo}
                onChange={(event) => setPetForm((current) => ({ ...current, importantInfo: event.target.value }))}
              />

              <div className="photo-field">
                <label htmlFor="pet_photo_file">Фотография</label>
                <div className="photo-preview">
                  {petPhotoPreview ? <img alt={petForm.name || "Питомец"} src={petPhotoPreview} /> : petForm.name || "Имя"}
                </div>
                <input
                  id="pet_photo_file"
                  accept="image/*"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPetPhotoFile(file);

                    if (petPhotoPreview?.startsWith("blob:")) {
                      URL.revokeObjectURL(petPhotoPreview);
                    }

                    setPetPhotoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </div>
              <p className="hint">Если фото не выбрать, карточка останется с мягкой цветной заглушкой.</p>

              <button className="primary-btn" disabled={isSavingPet} type="button" onClick={() => void savePet()}>
                {isSavingPet ? "Сохраняем..." : "Сохранить питомца"}
              </button>
            </section>
          ) : null}

          {activeScreen === "detail" && selectedPet ? (
            <section>
              <div className="detail-title">
                <button className="back-btn" type="button" onClick={() => setScreen("home")}>
                  ‹
                </button>
                <h2>Карточка</h2>
                <div className="detail-actions">
                  <button className="round-action danger-action" type="button" onClick={() => void removePet(selectedPet.id)}>
                    ×
                  </button>
                  <button className="round-action" type="button" onClick={() => openEditForm(selectedPet)}>
                    ✎
                  </button>
                </div>
              </div>

              <section className="profile-hero">
                <div className="pet-photo">
                  {selectedPet.photoUrl ? <img alt={selectedPet.name} src={selectedPet.photoUrl} /> : selectedPet.name}
                </div>
                <div>
                  <h2>{selectedPet.name}</h2>
                  <div className="chips">
                    <span className="chip">{formatPetType(selectedPet.type)}</span>
                    <span className="chip green">{selectedPet.breed}</span>
                    <span className="chip">
                      {selectedPet.birthDate ? formatDate(selectedPet.birthDate) : "дата рождения не указана"}
                    </span>
                  </div>
                </div>
              </section>

              {selectedPet.importantInfo ? (
                <details className="important-info">
                  <summary>Важная информация</summary>
                  <div className="important-info-content">{selectedPet.importantInfo}</div>
                </details>
              ) : null}

              <nav className="tabs">
                {CARE_TYPES.map((careType) => (
                  <button
                    key={careType.key}
                    className={`tab-btn ${activeCareKey === careType.key ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveCareKey(careType.key)}
                  >
                    {careType.shortTitle}
                  </button>
                ))}
              </nav>

              {(() => {
                const care = selectedPet.care[activeCareKey];

                return (
                  <section className="care-card">
                    <div className="care-head">
                      <div>
                        <h3>{CARE_TYPES.find((item) => item.key === activeCareKey)?.title}</h3>
                        <p className="meta-text">Заполните данные.</p>
                      </div>
                      <div className="next-date">{care.nextDate ? formatDate(care.nextDate, "d MMM yyyy") : "Нет даты"}</div>
                    </div>

                    <label htmlFor={`${activeCareKey}_date`}>Дата вакцинации / обработки</label>
                    <input
                      id={`${activeCareKey}_date`}
                      type="date"
                      value={care.date}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateSelectedPetLocal((pet) => ({
                          ...pet,
                          care: {
                            ...pet.care,
                            [activeCareKey]: {
                              ...pet.care[activeCareKey],
                              date: value,
                            },
                          },
                        }));
                        void persistCareProfile(activeCareKey, { date: value });
                      }}
                    />

                    <label htmlFor={`${activeCareKey}_medicine`}>Препарат</label>
                    <input
                      id={`${activeCareKey}_medicine`}
                      placeholder="Название препарата"
                      value={care.medicine}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateSelectedPetLocal((pet) => ({
                          ...pet,
                          care: {
                            ...pet.care,
                            [activeCareKey]: {
                              ...pet.care[activeCareKey],
                              medicine: value,
                            },
                          },
                        }));
                      }}
                      onBlur={() => void persistCareProfile(activeCareKey, { medicine: care.medicine })}
                    />

                    <label htmlFor={`${activeCareKey}_interval`}>Интервал до следующей процедуры, дней</label>
                    <input
                      id={`${activeCareKey}_interval`}
                      min="1"
                      placeholder="Например, 365"
                      type="number"
                      value={care.intervalDays}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateSelectedPetLocal((pet) => ({
                          ...pet,
                          care: {
                            ...pet.care,
                            [activeCareKey]: {
                              ...pet.care[activeCareKey],
                              intervalDays: value,
                            },
                          },
                        }));
                      }}
                      onBlur={() => void persistCareProfile(activeCareKey, { intervalDays: care.intervalDays })}
                    />

                    <label>Напоминания</label>
                    <div className="reminders">
                      {DEFAULT_REMINDERS.map((day) => (
                        <label key={day} className="reminder-option">
                          <input
                            checked={care.reminders.includes(day)}
                            type="checkbox"
                            onChange={(event) => {
                              const nextReminders = event.target.checked
                                ? [...care.reminders, day]
                                : care.reminders.filter((value) => value !== day);
                              const normalizedReminders = [...new Set(nextReminders)].sort((left, right) => right - left);

                              updateSelectedPetLocal((pet) => ({
                                ...pet,
                                care: {
                                  ...pet.care,
                                  [activeCareKey]: {
                                    ...pet.care[activeCareKey],
                                    reminders: normalizedReminders,
                                  },
                                },
                              }));
                              void persistCareProfile(activeCareKey, { reminders: normalizedReminders });
                            }}
                          />
                          <span>за {day} {pluralizeDays(day)}</span>
                        </label>
                      ))}
                    </div>

                    <label htmlFor={`${activeCareKey}_note`}>Заметка</label>
                    <textarea
                      id={`${activeCareKey}_note`}
                      placeholder="Например, реакция, рекомендации врача или важные детали"
                      value={care.note}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateSelectedPetLocal((pet) => ({
                          ...pet,
                          care: {
                            ...pet.care,
                            [activeCareKey]: {
                              ...pet.care[activeCareKey],
                              note: value,
                            },
                          },
                        }));
                      }}
                      onBlur={() => void persistCareProfile(activeCareKey, { note: care.note })}
                    />

                    <button className="primary-btn inline-care-action" type="button" onClick={() => void addHistoryRecord(activeCareKey)}>
                      Добавить запись в историю
                    </button>

                    <div className="history-section">
                      <h4 className="history-title">История</h4>
                      {!care.history.length ? (
                        <p className="meta-text">Пока записей нет. Добавьте первую запись выше.</p>
                      ) : (
                        <div className="history-list">
                          {care.history.map((record) => (
                            <article key={record.id} className="history-card">
                              <div className="history-card-head">
                                <strong>{record.date ? formatDate(record.date) : "Без даты"}</strong>
                                <button
                                  className="history-delete"
                                  type="button"
                                  onClick={() => void deleteHistoryRecord(activeCareKey, record.id)}
                                >
                                  ×
                                </button>
                              </div>
                              {record.medicine ? <p><strong>Препарат:</strong> {record.medicine}</p> : null}
                              {record.intervalDays ? (
                                <p>
                                  <strong>Интервал:</strong> {record.intervalDays} {pluralizeDays(Number(record.intervalDays))}
                                </p>
                              ) : null}
                              {record.note ? <p><strong>Заметка:</strong> {record.note}</p> : null}
                              {record.reminders.length ? (
                                <p>
                                  <strong>Напоминания:</strong>{" "}
                                  {record.reminders.map((day) => `за ${day} ${pluralizeDays(day)}`).join(", ")}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })()}

              <div className="bottom-actions">
                <button className="secondary-btn" type="button" onClick={() => setScreen("home")}>
                  К списку
                </button>
                <button className="primary-btn" type="button" onClick={sendTelegramSnapshot}>
                  Отправить
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
