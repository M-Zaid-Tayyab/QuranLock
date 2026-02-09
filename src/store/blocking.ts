import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface BlockingState {
  requiredQuranMinutes: number;
  accumulatedQuranMinutesForCurrentBlock: number;
  lastBlockedAt: number | null;
  quranMinutesToUnblock: number;
  activeScheduleId: string | null;
  activeScheduleDate: string | null;
  completedScheduleDate: string | null;
  completedScheduleIds: string[];
}

interface BlockingActions {
  startBlockSession: (requiredMinutes: number) => void;
  addQuranMinutes: (minutes: number) => boolean;
  getRequiredMinutes: () => number;
  resetAfterUnblock: () => void;
  setQuranMinutesToUnblock: (minutes: number) => void;
  setActiveSchedule: (
    scheduleId: string | null,
    requiredMinutes: number,
    dateKey: string,
  ) => void;
  ensureCompletionDate: (dateKey: string) => void;
  markScheduleCompleted: (scheduleId: string, dateKey: string) => void;
}

const initialState: BlockingState = {
  requiredQuranMinutes: 0,
  accumulatedQuranMinutesForCurrentBlock: 0,
  lastBlockedAt: null,
  quranMinutesToUnblock: 30,
  activeScheduleId: null,
  activeScheduleDate: null,
  completedScheduleDate: null,
  completedScheduleIds: [],
};

export const useBlockingStore = create<BlockingState & BlockingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      startBlockSession: (requiredMinutes: number) => {
        set({
          requiredQuranMinutes: requiredMinutes,
          accumulatedQuranMinutesForCurrentBlock: 0,
          lastBlockedAt: Date.now(),
        });
      },

      addQuranMinutes: (minutes: number) => {
        const state = get();
        const newAccumulated =
          state.accumulatedQuranMinutesForCurrentBlock + minutes;
        set({ accumulatedQuranMinutesForCurrentBlock: newAccumulated });
        const required =
          state.requiredQuranMinutes || state.quranMinutesToUnblock;
        return required > 0 && newAccumulated >= required;
      },

      getRequiredMinutes: () => {
        const state = get();
        if (state.requiredQuranMinutes > 0) {
          return state.requiredQuranMinutes;
        }
        if (state.lastBlockedAt != null) {
          return state.quranMinutesToUnblock;
        }
        return 0;
      },

      resetAfterUnblock: () => {
        set({
          accumulatedQuranMinutesForCurrentBlock: 0,
          lastBlockedAt: null,
          requiredQuranMinutes: 0,
        });
      },

      setQuranMinutesToUnblock: (minutes: number) => {
        set({ quranMinutesToUnblock: minutes });
      },

      setActiveSchedule: (scheduleId, requiredMinutes, dateKey) => {
        set((state) => {
          const isSameSchedule =
            state.activeScheduleId === scheduleId &&
            state.activeScheduleDate === dateKey;
          if (isSameSchedule) {
            return {
              requiredQuranMinutes:
                scheduleId ? requiredMinutes : state.requiredQuranMinutes,
            };
          }
          return {
            activeScheduleId: scheduleId,
            activeScheduleDate: scheduleId ? dateKey : null,
            requiredQuranMinutes: scheduleId ? requiredMinutes : 0,
            accumulatedQuranMinutesForCurrentBlock: 0,
            lastBlockedAt: scheduleId ? Date.now() : null,
          };
        });
      },

      ensureCompletionDate: (dateKey) => {
        set((state) => {
          if (state.completedScheduleDate === dateKey) return {};
          return {
            completedScheduleDate: dateKey,
            completedScheduleIds: [],
            activeScheduleId: null,
            activeScheduleDate: null,
            requiredQuranMinutes: 0,
            accumulatedQuranMinutesForCurrentBlock: 0,
            lastBlockedAt: null,
          };
        });
      },

      markScheduleCompleted: (scheduleId, dateKey) => {
        set((state) => {
          if (state.completedScheduleDate !== dateKey) {
            return {
              completedScheduleDate: dateKey,
              completedScheduleIds: [scheduleId],
            };
          }
          if (state.completedScheduleIds.includes(scheduleId)) return {};
          return {
            completedScheduleIds: [...state.completedScheduleIds, scheduleId],
          };
        });
      },
    }),
    {
      name: STORE_KEYS.BLOCKING_STORE,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
