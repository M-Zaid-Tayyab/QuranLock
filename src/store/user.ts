import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "@/constants/entitlements";
import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface UserState {
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
  quranFontScale: number;
  isPremium: boolean;
  subscriptionTier: SubscriptionTier;
  completedUnlockSessions: number;
}

export interface FocusSchedule {
  id: string;
  label: string;
  kind: "prayer" | "custom";
  hour: number;
  minute: number;
  durationMinutes: number;
}

interface UserActions {
  setAppUserId: (value: string) => void;
  setName: (name: string) => void;
  setAge: (age: number | null) => void;
  setQuranFrequency: (value: string) => void;
  setReasonsDisconnect: (value: string[]) => void;
  setFocusSchedules: (value: FocusSchedule[]) => void;
  setOnboardingComplete: (value: boolean) => void;
  setHasSelectedApps: (value: boolean) => void;
  setLastReadPage: (page: number) => void;
  setWordByWordEnabled: (value: boolean) => void;
  setTranslationEnabled: (value: boolean) => void;
  setQuranFontScale: (value: number) => void;
  setIsPremium: (value: boolean) => void;
  setSubscriptionTier: (value: SubscriptionTier) => void;
  incrementCompletedUnlockSessions: () => void;
}

const initialState: UserState = {
  appUserId: "",
  name: "",
  age: null,
  quranFrequency: "",
  reasonsDisconnect: [],
  focusSchedules: [],
  onboardingComplete: false,
  hasSelectedApps: false,
  lastReadPage: 1,
  wordByWordEnabled: true,
  translationEnabled: false,
  quranFontScale: 1,
  isPremium: false,
  subscriptionTier: SUBSCRIPTION_TIERS.FREE,
  completedUnlockSessions: 0,
};

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...initialState,

      setAppUserId: (appUserId) => set({ appUserId }),
      setName: (name) => set({ name }),
      setAge: (age) => set({ age }),
      setQuranFrequency: (quranFrequency) => set({ quranFrequency }),
      setReasonsDisconnect: (reasonsDisconnect) => set({ reasonsDisconnect }),
      setFocusSchedules: (focusSchedules) => set({ focusSchedules }),
      setOnboardingComplete: (onboardingComplete) =>
        set({ onboardingComplete }),
      setHasSelectedApps: (hasSelectedApps) => set({ hasSelectedApps }),
      setLastReadPage: (lastReadPage) => set({ lastReadPage }),
      setWordByWordEnabled: (wordByWordEnabled) => set({ wordByWordEnabled }),
      setTranslationEnabled: (translationEnabled) =>
        set({ translationEnabled }),
      setQuranFontScale: (quranFontScale) => set({ quranFontScale }),
      setIsPremium: (isPremium) =>
        set({
          isPremium,
          subscriptionTier: isPremium
            ? SUBSCRIPTION_TIERS.PRO
            : SUBSCRIPTION_TIERS.FREE,
        }),
      setSubscriptionTier: (subscriptionTier) =>
        set({
          subscriptionTier,
          isPremium: subscriptionTier === SUBSCRIPTION_TIERS.PRO,
        }),
      incrementCompletedUnlockSessions: () =>
        set((state) => ({
          completedUnlockSessions: state.completedUnlockSessions + 1,
        })),
    }),
    {
      name: STORE_KEYS.USER_STORE,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
