import type { SubscriptionTier } from "@/constants/entitlements";
import { convexClient } from "@/services/convexClient";
import type { FocusSchedule } from "@/store/user";
import { api } from "../../convex/_generated/api";

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
  subscriptionTier: SubscriptionTier;
  completedUnlockSessions: number;
}

export const syncUserProfile = async (payload: UserSyncPayload) => {
  if (!convexClient) return;
  if (!payload.appUserId) return;
  try {
    await convexClient.mutation(api.users.upsertUser, {
      ...payload,
      age: payload.age ?? undefined,
      quranFrequency: payload.quranFrequency || undefined,
    });
  } catch {
    // Silent background sync; ignore failures.
  }
};
