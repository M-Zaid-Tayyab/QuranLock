import type { FocusSchedule } from "@/store/user";
import { convexClient } from "@/services/convexClient";

export interface UserSyncPayload {
  appUserId: string;
  name: string;
  age: number | null;
  quranFrequency: string;
  reasonsDisconnect: string[];
  focusSchedules: FocusSchedule[];
  onboardingComplete: boolean;
  hasSelectedApps: boolean;
  lastReadPage: number;
  wordByWordEnabled: boolean;
  translationEnabled: boolean;
  isPremium: boolean;
}

export const syncUserProfile = async (payload: UserSyncPayload) => {
  if (!convexClient) return;
  if (!payload.appUserId) return;
  try {
    await convexClient.mutation("users:upsertUser", {
      ...payload,
      age: payload.age ?? undefined,
      quranFrequency: payload.quranFrequency || undefined,
    });
  } catch {
    // Silent background sync; ignore failures.
  }
};
