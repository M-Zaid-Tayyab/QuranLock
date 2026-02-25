import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

export interface BlockingState {
  requiredQuranMinutes: number;
  accumulatedQuranMinutesForCurrentBlock: number;
  liveProgressStartedAt: number | null;
  sessionNowMs: number;
  totalQuranMinutesLifetime: number;
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
  startLiveProgress: (nowMs?: number) => void;
  pauseLiveProgress: (nowMs?: number) => void;
  setSessionNowMs: (nowMs: number) => void;
  getAccumulatedMinutesSnapshot: (nowMs?: number) => number;
  getRequiredMinutes: () => number;
  flushLifetimeProgress: () => void;
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

const createInitialBlockingState = (): BlockingState => ({
  requiredQuranMinutes: 0,
  accumulatedQuranMinutesForCurrentBlock: 0,
  liveProgressStartedAt: null,
  sessionNowMs: Date.now(),
  totalQuranMinutesLifetime: 0,
  lastBlockedAt: null,
  quranMinutesToUnblock: 30,
  activeScheduleId: null,
  activeScheduleDate: null,
  completedScheduleDate: null,
  completedScheduleIds: [],
});

const LIFETIME_FLUSH_THRESHOLD_MINUTES = 10 / 60;
let bufferedLifetimeMinutes = 0;
const PERSIST_WRITE_THROTTLE_MS = 10_000;

const consumeBufferedLifetimeMinutes = () => {
  const value = bufferedLifetimeMinutes;
  bufferedLifetimeMinutes = 0;
  return value;
};

const applyBufferedLifetimeMinutes = (baseLifetime: number) => {
  const delta = consumeBufferedLifetimeMinutes();
  if (delta <= 0) return baseLifetime;
  return Math.max(0, baseLifetime + delta);
};

const lastPersistedByKey = new Map<string, string>();
const lastPersistedAtByKey = new Map<string, number>();
const pendingValueByKey = new Map<string, string>();
const pendingTimerByKey = new Map<string, ReturnType<typeof setTimeout>>();

const persistNow = (name: string, value: string) => {
  lastPersistedByKey.set(name, value);
  lastPersistedAtByKey.set(name, Date.now());
  zustandStorage.setItem(name, value);
};

const blockingPersistStorage: StateStorage = {
  getItem: (name: string) => {
    const value = zustandStorage.getItem(name);
    if (typeof value === "string") {
      lastPersistedByKey.set(name, value);
      lastPersistedAtByKey.set(name, Date.now());
    }
    return value;
  },
  setItem: (name: string, value: string) => {
    if (lastPersistedByKey.get(name) === value) return;

    const lastPersistedAt = lastPersistedAtByKey.get(name) ?? 0;
    const elapsed = Date.now() - lastPersistedAt;

    if (elapsed >= PERSIST_WRITE_THROTTLE_MS) {
      const existingTimer = pendingTimerByKey.get(name);
      if (existingTimer) {
        clearTimeout(existingTimer);
        pendingTimerByKey.delete(name);
      }
      pendingValueByKey.delete(name);
      persistNow(name, value);
      return;
    }

    pendingValueByKey.set(name, value);
    if (pendingTimerByKey.has(name)) return;

    const delay = Math.max(0, PERSIST_WRITE_THROTTLE_MS - elapsed);
    const timer = setTimeout(() => {
      pendingTimerByKey.delete(name);
      const pendingValue = pendingValueByKey.get(name);
      pendingValueByKey.delete(name);
      if (!pendingValue) return;
      if (lastPersistedByKey.get(name) === pendingValue) return;
      persistNow(name, pendingValue);
    }, delay);
    pendingTimerByKey.set(name, timer);
  },
  removeItem: (name: string) => {
    const existingTimer = pendingTimerByKey.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingTimerByKey.delete(name);
    }
    pendingValueByKey.delete(name);
    lastPersistedByKey.delete(name);
    lastPersistedAtByKey.delete(name);
    zustandStorage.removeItem(name);
  },
};

export const useBlockingStore = create<BlockingState & BlockingActions>()(
  persist(
    (set, get) => ({
      ...createInitialBlockingState(),

      startBlockSession: (requiredMinutes: number) => {
        set((state) => ({
          requiredQuranMinutes: requiredMinutes,
          accumulatedQuranMinutesForCurrentBlock: 0,
          liveProgressStartedAt: null,
          totalQuranMinutesLifetime: applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          ),
          lastBlockedAt: Date.now(),
        }));
      },

      addQuranMinutes: (minutes: number) => {
        const state = get();
        const newAccumulated =
          state.accumulatedQuranMinutesForCurrentBlock + minutes;
        bufferedLifetimeMinutes += Math.max(0, minutes);
        const shouldFlushLifetime =
          bufferedLifetimeMinutes >= LIFETIME_FLUSH_THRESHOLD_MINUTES;
        const nextLifetime = shouldFlushLifetime
          ? applyBufferedLifetimeMinutes(state.totalQuranMinutesLifetime)
          : state.totalQuranMinutesLifetime;
        set({
          accumulatedQuranMinutesForCurrentBlock: newAccumulated,
          liveProgressStartedAt: null,
          totalQuranMinutesLifetime: nextLifetime,
        });
        const required =
          state.requiredQuranMinutes || state.quranMinutesToUnblock;
        return required > 0 && newAccumulated >= required;
      },

      startLiveProgress: (nowMs = Date.now()) => {
        set((state) => {
          if (state.liveProgressStartedAt != null) return {};
          const required =
            state.requiredQuranMinutes ||
            (state.lastBlockedAt != null ? state.quranMinutesToUnblock : 0);
          if (required <= 0) return {};
          return { liveProgressStartedAt: nowMs };
        });
      },

      pauseLiveProgress: (nowMs = Date.now()) => {
        set((state) => {
          const startedAt = state.liveProgressStartedAt;
          if (startedAt == null) return {};
          const deltaMinutes = Math.max(0, (nowMs - startedAt) / 60000);
          const nextLifetime = applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          );
          if (deltaMinutes <= 0) {
            return {
              liveProgressStartedAt: null,
              totalQuranMinutesLifetime: nextLifetime,
            };
          }
          return {
            accumulatedQuranMinutesForCurrentBlock:
              state.accumulatedQuranMinutesForCurrentBlock + deltaMinutes,
            liveProgressStartedAt: null,
            totalQuranMinutesLifetime: nextLifetime + deltaMinutes,
          };
        });
      },

      setSessionNowMs: (nowMs) => {
        set((state) =>
          state.sessionNowMs === nowMs ? {} : { sessionNowMs: nowMs },
        );
      },

      getAccumulatedMinutesSnapshot: (nowMs = Date.now()) => {
        const state = get();
        const startedAt = state.liveProgressStartedAt;
        if (startedAt == null) {
          return state.accumulatedQuranMinutesForCurrentBlock;
        }
        return (
          state.accumulatedQuranMinutesForCurrentBlock +
          Math.max(0, (nowMs - startedAt) / 60000)
        );
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

      flushLifetimeProgress: () => {
        set((state) => {
          const startedAt = state.liveProgressStartedAt;
          const nextLifetime = applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          );
          const deltaMinutes =
            startedAt == null ? 0 : Math.max(0, (Date.now() - startedAt) / 60000);
          const committedLifetime = nextLifetime + deltaMinutes;
          const hasLifetimeChange =
            committedLifetime !== state.totalQuranMinutesLifetime;
          const hasAccumulatedChange = deltaMinutes > 0;
          if (!hasLifetimeChange && !hasAccumulatedChange && startedAt == null) {
            return {};
          }
          return {
            accumulatedQuranMinutesForCurrentBlock:
              state.accumulatedQuranMinutesForCurrentBlock + deltaMinutes,
            totalQuranMinutesLifetime: committedLifetime,
            liveProgressStartedAt: null,
          };
        });
      },

      resetAfterUnblock: () => {
        set((state) => ({
          accumulatedQuranMinutesForCurrentBlock: 0,
          liveProgressStartedAt: null,
          lastBlockedAt: null,
          requiredQuranMinutes: 0,
          totalQuranMinutesLifetime: applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          ),
        }));
      },

      setQuranMinutesToUnblock: (minutes: number) => {
        set({ quranMinutesToUnblock: minutes });
      },

      setActiveSchedule: (scheduleId, requiredMinutes, dateKey) => {
        set((state) => {
          const totalQuranMinutesLifetime = applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          );
          const isSameSchedule =
            state.activeScheduleId === scheduleId &&
            state.activeScheduleDate === dateKey;
          if (isSameSchedule) {
            return {
              totalQuranMinutesLifetime,
              requiredQuranMinutes:
                scheduleId ? requiredMinutes : state.requiredQuranMinutes,
            };
          }
          return {
            activeScheduleId: scheduleId,
            activeScheduleDate: scheduleId ? dateKey : null,
            requiredQuranMinutes: scheduleId ? requiredMinutes : 0,
            accumulatedQuranMinutesForCurrentBlock: 0,
            liveProgressStartedAt: null,
            totalQuranMinutesLifetime,
            lastBlockedAt: scheduleId ? Date.now() : null,
          };
        });
      },

      ensureCompletionDate: (dateKey) => {
        set((state) => {
          if (state.completedScheduleDate === dateKey) return {};
          const totalQuranMinutesLifetime = applyBufferedLifetimeMinutes(
            state.totalQuranMinutesLifetime,
          );
          return {
            completedScheduleDate: dateKey,
            completedScheduleIds: [],
            activeScheduleId: null,
            activeScheduleDate: null,
            requiredQuranMinutes: 0,
            accumulatedQuranMinutesForCurrentBlock: 0,
            liveProgressStartedAt: null,
            totalQuranMinutesLifetime,
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
      storage: createJSONStorage(() => blockingPersistStorage),
      partialize: (state) => ({
        requiredQuranMinutes: state.requiredQuranMinutes,
        accumulatedQuranMinutesForCurrentBlock:
          state.accumulatedQuranMinutesForCurrentBlock,
        totalQuranMinutesLifetime: state.totalQuranMinutesLifetime,
        lastBlockedAt: state.lastBlockedAt,
        quranMinutesToUnblock: state.quranMinutesToUnblock,
        activeScheduleId: state.activeScheduleId,
        activeScheduleDate: state.activeScheduleDate,
        completedScheduleDate: state.completedScheduleDate,
        completedScheduleIds: state.completedScheduleIds,
      }),
    },
  ),
);

const clearBlockingPersistBuffers = () => {
  bufferedLifetimeMinutes = 0;
  for (const timer of pendingTimerByKey.values()) {
    clearTimeout(timer);
  }
  pendingTimerByKey.clear();
  pendingValueByKey.clear();
  lastPersistedByKey.clear();
  lastPersistedAtByKey.clear();
};

export const resetBlockingStore = () => {
  clearBlockingPersistBuffers();
  useBlockingStore.setState(createInitialBlockingState());
  void useBlockingStore.persist.clearStorage();
};
