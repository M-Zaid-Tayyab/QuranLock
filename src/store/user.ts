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
  focusDurationMode: FocusDurationMode;
  focusCompletionDays?: number;
  focusMinutesPerPage?: number;
  onboardingComplete: boolean;
  hasSelectedApps: boolean;
  familyActivitySelection: string | null;
  lastReadPage: number;
  translationEnabled: boolean;
  quranFontScale: number;
  isPremium: boolean;
  isBlockingPaused: boolean;
  completedUnlockSessions: number;
  streakCompletedDates: string[];
  hasRequestedFirstStreakReview: boolean;
}

export interface FocusSchedule {
  id: string;
  label: string;
  kind: "prayer" | "custom";
  hour: number;
  minute: number;
  durationMinutes: number;
}

export type FocusDurationMode = "manual" | "goal";

interface UserActions {
  setAppUserId: (value: string) => void;
  setName: (name: string) => void;
  setAge: (age: number | null) => void;
  setQuranFrequency: (value: string) => void;
  setReasonsDisconnect: (value: string[]) => void;
  setFocusSchedules: (value: FocusSchedule[]) => void;
  setFocusDurationMode: (value: FocusDurationMode) => void;
  setFocusCompletionDays: (value?: number) => void;
  setFocusMinutesPerPage: (value?: number) => void;
  setOnboardingComplete: (value: boolean) => void;
  setHasSelectedApps: (value: boolean) => void;
  setFamilyActivitySelection: (value: string | null) => void;
  setLastReadPage: (page: number) => void;
  setTranslationEnabled: (value: boolean) => void;
  setQuranFontScale: (value: number) => void;
  setIsPremium: (value: boolean) => void;
  setIsBlockingPaused: (value: boolean) => void;
  incrementCompletedUnlockSessions: () => void;
  setStreakCompletedDates: (value: string[]) => void;
  markStreakDayCompleted: (dateKey?: string) => void;
  setHasRequestedFirstStreakReview: (value: boolean) => void;
}

const getLocalDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createInitialUserState = (): UserState => ({
  appUserId: "",
  name: "",
  age: null,
  quranFrequency: "",
  reasonsDisconnect: [],
  focusSchedules: [],
  focusDurationMode: "goal",
  onboardingComplete: false,
  hasSelectedApps: false,
  familyActivitySelection: null,
  lastReadPage: 1,
  translationEnabled: false,
  quranFontScale: 1,
  isPremium: false,
  isBlockingPaused: false,
  completedUnlockSessions: 0,
  streakCompletedDates: [],
  hasRequestedFirstStreakReview: false,
});

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...createInitialUserState(),

      setAppUserId: (appUserId) => set({ appUserId }),
      setName: (name) => set({ name }),
      setAge: (age) => set({ age }),
      setQuranFrequency: (quranFrequency) => set({ quranFrequency }),
      setReasonsDisconnect: (reasonsDisconnect) => set({ reasonsDisconnect }),
      setFocusSchedules: (focusSchedules) => set({ focusSchedules }),
      setFocusDurationMode: (focusDurationMode) => set({ focusDurationMode }),
      setFocusCompletionDays: (focusCompletionDays) =>
        set({ focusCompletionDays }),
      setFocusMinutesPerPage: (focusMinutesPerPage) =>
        set({ focusMinutesPerPage }),
      setOnboardingComplete: (onboardingComplete) =>
        set({ onboardingComplete }),
      setHasSelectedApps: (hasSelectedApps) => set({ hasSelectedApps }),
      setFamilyActivitySelection: (familyActivitySelection) =>
        set({ familyActivitySelection }),
      setLastReadPage: (lastReadPage) => set({ lastReadPage }),
      setTranslationEnabled: (translationEnabled) =>
        set({ translationEnabled }),
      setQuranFontScale: (quranFontScale) => set({ quranFontScale }),
      setIsPremium: (isPremium) => set({ isPremium }),
      setIsBlockingPaused: (isBlockingPaused) => set({ isBlockingPaused }),
      incrementCompletedUnlockSessions: () =>
        set((state) => ({
          completedUnlockSessions: state.completedUnlockSessions + 1,
        })),
      setStreakCompletedDates: (streakCompletedDates) =>
        set({ streakCompletedDates }),
      markStreakDayCompleted: (dateKey) =>
        set((state) => {
          const key = dateKey ?? getLocalDateKey();
          if (state.streakCompletedDates.includes(key)) return state;
          return {
            streakCompletedDates: [...state.streakCompletedDates, key].sort(),
          };
        }),
      setHasRequestedFirstStreakReview: (hasRequestedFirstStreakReview) =>
        set({ hasRequestedFirstStreakReview }),
    }),
    {
      name: STORE_KEYS.USER_STORE,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export const resetUserStore = () => {
  useUserStore.setState(createInitialUserState());
  void useUserStore.persist.clearStorage();
};
