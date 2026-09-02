import { convexClient } from "@/services/convexClient";
import type { AppSelectionSummary } from "@/services/deviceActivity";
import type { FocusDurationMode, FocusSchedule } from "@/store/user";
import type { AcquisitionSource } from "@/types";
import { api } from "../../convex/_generated/api";

export interface UserSyncPayload {
  appUserId: string;
  name: string;
  age: number | null;
  quranFrequency: string;
  reasonsDisconnect: string[];
  acquisitionSource: AcquisitionSource | null;
  focusSchedules: FocusSchedule[];
  focusDurationMode: FocusDurationMode;
  focusCompletionDays?: number;
  focusMinutesPerPage?: number;
  appSelection: AppSelectionSummary;
  isBlockingPaused: boolean;
  lastReadPage: number;
  translationEnabled: boolean;
  quranFontScale: number;
  isPremium: boolean;
  completedUnlockSessions: number;
  streakCompletedDates: string[];
}

export interface FocusLockSession {
  id: string;
  label: string;
  kind: "prayer" | "custom";
  hour: number;
  minute: number;
  durationMinutes: number;
}

export interface FocusLockStatus {
  dateKey: string;
  isAppsLocked: boolean;
  activeSession?: FocusLockSession;
  pendingSessions: FocusLockSession[];
  updatedAt: number;
}

export const syncUserProfile = async (payload: UserSyncPayload) => {
  if (!convexClient) return;
  if (!payload.appUserId) return;
  try {
    await convexClient.mutation(api.users.upsertUser, {
      ...payload,
      age: payload.age ?? undefined,
      quranFrequency: payload.quranFrequency || undefined,
      acquisitionSource: payload.acquisitionSource ?? undefined,
      focusCompletionDays: payload.focusCompletionDays,
      focusMinutesPerPage: payload.focusMinutesPerPage,
    });
  } catch {
    // Silent background sync; ignore failures.
  }
};

export const syncFocusLockStatus = async (params: {
  appUserId: string;
  focusLockStatus: FocusLockStatus;
}) => {
  if (!convexClient || !params.appUserId) return null;
  try {
    return await convexClient.mutation(api.users.syncFocusLockStatus, params);
  } catch {
    return null;
  }
};
