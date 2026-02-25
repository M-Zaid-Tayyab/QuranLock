import type { SubscriptionTier } from "@/constants/entitlements";
import { convexClient } from "@/services/convexClient";
import type { FocusDurationMode, FocusSchedule } from "@/store/user";
import { api } from "../../convex/_generated/api";

export interface UserSyncPayload {
  appUserId: string;
  name: string;
  age: number | null;
  quranFrequency: string;
  reasonsDisconnect: string[];
  focusSchedules: FocusSchedule[];
  deferredFocusSchedules: FocusSchedule[];
  focusDurationMode: FocusDurationMode;
  focusCompletionDays: number;
  focusMinutesPerPage: number;
  onboardingComplete: boolean;
  hasSelectedApps: boolean;
  familyActivitySelection: string | null;
  lastReadPage: number;
  translationEnabled: boolean;
  quranFontScale: number;
  isPremium: boolean;
  subscriptionTier: SubscriptionTier;
  completedUnlockSessions: number;
  streakCompletedDates: string[];
}

export const syncUserProfile = async (payload: UserSyncPayload) => {
  if (!convexClient) return;
  if (!payload.appUserId) return;
  try {
    await convexClient.mutation(api.users.upsertUser, {
      ...payload,
      age: payload.age ?? undefined,
      quranFrequency: payload.quranFrequency || undefined,
      familyActivitySelection: payload.familyActivitySelection ?? undefined,
    });
  } catch {
    // Silent background sync; ignore failures.
  }
};
