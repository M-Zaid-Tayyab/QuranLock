import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useFunnelText } from "@/hooks/app";
import { useHomePermissionStatus } from "@/hooks/home/useHomePermissionStatus";
import { useHomeScheduleStatus } from "@/hooks/home/useHomeScheduleStatus";
import {
  canOpenQuran,
  ensureCanEditFocusTimes,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { getDateKey, type ScheduleStatus } from "@/utils/scheduleEngine";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useShallow } from "zustand/react/shallow";

const QURAN_TOTAL_PAGES = 604;

export interface HomeTimelineItem {
  id: string;
  label: string;
  timeLabel: string;
  durationMinutes: number;
  status: ScheduleStatus | "paused";
}

export interface HomeStreakDay {
  date: string;
  dayLabel: string;
  completed: boolean;
}

const formatTime = (hour: number, minute: number) => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
};

const toTimelineItem = (
  id: string,
  label: string,
  hour: number,
  minute: number,
  durationMinutes: number,
  status: HomeTimelineItem["status"],
): HomeTimelineItem => ({
  id,
  label,
  timeLabel: formatTime(hour, minute),
  durationMinutes,
  status,
});

const getTodayDateKey = () => getDateKey(new Date());

const buildStreakDays = (
  streakCompletedDates: string[],
  hasCompletedAllGoalsToday: boolean,
): HomeStreakDay[] => {
  const completedSet = new Set(streakCompletedDates);
  if (hasCompletedAllGoalsToday) {
    completedSet.add(getTodayDateKey());
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + index);
    const dateKey = getDateKey(d);
    return {
      date: dateKey,
      dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      completed: completedSet.has(dateKey),
    };
  });
};

const calculateCurrentStreakCount = (
  streakCompletedDates: string[],
  hasCompletedAllGoalsToday: boolean,
) => {
  const completedSet = new Set(streakCompletedDates);
  if (hasCompletedAllGoalsToday) {
    completedSet.add(getTodayDateKey());
  }

  let count = 0;
  const cursor = new Date();
  while (true) {
    const key = getDateKey(cursor);
    if (!completedSet.has(key)) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

export const useHomeScreen = () => {
  const funnelText = useFunnelText();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);

  const {
    name,
    completedUnlockSessions,
    isPremium,
    isBlockingPaused,
    lastReadPage,
    hasSelectedApps,
    streakCompletedDates,
    hasRequestedFirstStreakReview,
    setIsBlockingPaused,
    setHasRequestedFirstStreakReview,
  } = useUserStore(
    useShallow((s) => ({
      name: s.name,
      completedUnlockSessions: s.completedUnlockSessions,
      isPremium: s.isPremium,
      isBlockingPaused: s.isBlockingPaused,
      lastReadPage: s.lastReadPage,
      hasSelectedApps: s.hasSelectedApps,
      streakCompletedDates: s.streakCompletedDates,
      hasRequestedFirstStreakReview: s.hasRequestedFirstStreakReview,
      setIsBlockingPaused: s.setIsBlockingPaused,
      setHasRequestedFirstStreakReview: s.setHasRequestedFirstStreakReview,
    })),
  );

  const {
    statuses,
    activeSchedule,
    refresh: refreshScheduleStatus,
  } = useHomeScheduleStatus({
    autoRefreshOnAppActive: false,
    autoTickMinutes: false,
  });

  const {
    getAccumulatedMinutesSnapshot,
    totalQuranMinutesLifetime,
    getRequiredMinutes,
  } = useBlockingStore(
    useShallow((s) => ({
      getAccumulatedMinutesSnapshot: s.getAccumulatedMinutesSnapshot,
      totalQuranMinutesLifetime: s.totalQuranMinutesLifetime,
      getRequiredMinutes: s.getRequiredMinutes,
    })),
  );

  const {
    needsScreenTime,
    needsNotifications,
    requestingScreenTime,
    refreshPermissionStatus,
    requestScreenTimePermission,
    requestNotificationPermission,
  } = useHomePermissionStatus();

  const accumulatedMinutes = getAccumulatedMinutesSnapshot(Date.now());

  const refreshHome = useCallback(async () => {
    refreshScheduleStatus();
    await refreshPermissionStatus();
  }, [refreshPermissionStatus, refreshScheduleStatus]);

  useEffect(() => {
    if (!isFocused) return;
    void refreshHome();
  }, [isFocused, refreshHome]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isFocused) {
        void refreshHome();
      }
    });
    return () => subscription.remove();
  }, [isFocused, refreshHome]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshHome();
    } finally {
      setRefreshing(false);
    }
  }, [refreshHome]);

  const requiredMinutes = getRequiredMinutes();
  const progressRatio =
    requiredMinutes > 0 ? Math.min(accumulatedMinutes / requiredMinutes, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const hasPendingSchedules = statuses.some((entry) => entry.status === "pending");
  const isBlockingActive =
    !isBlockingPaused &&
    hasPendingSchedules &&
    requiredMinutes > 0 &&
    accumulatedMinutes < requiredMinutes;

  const remainingSeconds = Math.max(
    0,
    Math.ceil((requiredMinutes - accumulatedMinutes) * 60),
  );
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecondsPart = remainingSeconds % 60;

  const completedSchedulesCount = statuses.filter(
    (entry) => entry.status === "completed",
  ).length;
  const totalSchedules = statuses.length;
  const scheduleCompletionPercent =
    totalSchedules > 0
      ? Math.round((completedSchedulesCount / totalSchedules) * 100)
      : 0;

  const journeyProgressPercent =
    requiredMinutes > 0 ? progressPercent : scheduleCompletionPercent;

  const pagesRead = Math.min(
    QURAN_TOTAL_PAGES,
    Math.max(1, Math.trunc(lastReadPage || 1)),
  );

  const activeTimelineItems = useMemo(
    () =>
      statuses.map((entry) =>
        toTimelineItem(
          entry.schedule.id,
          entry.schedule.label,
          entry.schedule.hour,
          entry.schedule.minute,
          entry.schedule.durationMinutes,
          isBlockingPaused && entry.status === "pending"
            ? "paused"
            : entry.status,
        ),
      ) satisfies HomeTimelineItem[],
    [isBlockingPaused, statuses],
  );

  const nextUpcoming = activeTimelineItems.find(
    (item) => item.status === "upcoming",
  );
  const nextFocusLabel = isBlockingPaused
    ? "Blocking is paused until you resume"
    : nextUpcoming
      ? `${nextUpcoming.label} • ${nextUpcoming.timeLabel}`
      : "All focus windows for today are done";

  const showSetupApps = !hasSelectedApps;
  const showSetupTimes = hasSelectedApps && activeTimelineItems.length === 0;
  const showTimeline = hasSelectedApps && activeTimelineItems.length > 0;

  const frozenMinutes = Math.max(0, Math.floor(accumulatedMinutes));
  const pausedLabel = activeSchedule?.schedule.label ?? "current focus window";
  const journeyTitle = isBlockingPaused
    ? "Blocking is paused"
    : isBlockingActive
      ? funnelText.home.journeyTitleActive
      : funnelText.home.journeyTitleIdle;
  const journeySubtitle = isBlockingPaused
    ? requiredMinutes > 0
      ? `${frozenMinutes}/${requiredMinutes} min saved for ${pausedLabel}`
      : "Resume anytime to re-enable your focus windows"
    : isBlockingActive
      ? `${remainingMinutes}:${remainingSecondsPart.toString().padStart(2, "0")} left to unlock apps`
      : `${completedSchedulesCount}/${Math.max(
          1,
          totalSchedules,
        )} focus windows completed`;

  const hasCompletedAllGoalsToday =
    totalSchedules > 0 && completedSchedulesCount === totalSchedules;

  const streakDays = useMemo(
    () => buildStreakDays(streakCompletedDates, hasCompletedAllGoalsToday),
    [hasCompletedAllGoalsToday, streakCompletedDates],
  );

  const currentStreakCount = useMemo(
    () =>
      calculateCurrentStreakCount(
        streakCompletedDates,
        hasCompletedAllGoalsToday,
      ),
    [hasCompletedAllGoalsToday, streakCompletedDates],
  );

  useEffect(() => {
    if (
      !isFocused ||
      hasRequestedFirstStreakReview ||
      (completedUnlockSessions < 1 &&
        streakCompletedDates.length < 1 &&
        !hasCompletedAllGoalsToday)
    ) {
      return;
    }

    setHasRequestedFirstStreakReview(true);

    const requestFirstStreakReview = async () => {
      try {
        const isReviewAvailable = await StoreReview.isAvailableAsync();
        if (isReviewAvailable) {
          await StoreReview.requestReview();
        }
      } catch {}
    };

    requestFirstStreakReview();
  }, [
    completedUnlockSessions,
    hasRequestedFirstStreakReview,
    hasCompletedAllGoalsToday,
    isFocused,
    setHasRequestedFirstStreakReview,
    streakCompletedDates.length,
  ]);

  const handleOpenSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);

  const handleOpenQuran = useCallback(() => {
    const gate = canOpenQuran({ isPremium });
    if (gate.allowed) {
      router.push("/verse");
      return;
    }
    openPaywallForBlockedDecision(
      router,
      gate,
      PAYWALL_SOURCES.HOME_READ_QURAN,
    );
  }, [isPremium, router]);

  const handleOpenFocusTimes = useCallback(() => {
    if (!ensureCanEditFocusTimes(router, { isPremium })) {
      return;
    }
    router.push({
      pathname: "/onboarding",
      params: { mode: "edit-times", from: "home" },
    });
  }, [isPremium, router]);

  const handleToggleBlockingPause = useCallback(() => {
    setIsBlockingPaused(!isBlockingPaused);
  }, [isBlockingPaused, setIsBlockingPaused]);

  return {
    header: {
      greeting: "Assalamu alaykum warahmatullah",
      displayName: name.trim() ? name : "Friend",
    },
    journey: {
      title: journeyTitle,
      subtitle: journeySubtitle,
      progressPercent: journeyProgressPercent,
      pagesRead,
      pagesTotal: QURAN_TOTAL_PAGES,
      accumulatedMinutes: Math.max(0, Math.floor(accumulatedMinutes)),
      requiredMinutes,
      isBlockingActive,
      remainingMinutes,
      remainingSecondsPart,
      completedSchedulesCount,
      totalSchedules,
      activeLabel: activeSchedule?.schedule.label ?? null,
    },
    streak: {
      days: streakDays,
      completedThisWeek: streakDays.filter((day) => day.completed).length,
      currentStreakCount,
    },
    timeline: {
      items: activeTimelineItems,
      isBlockingPaused,
      nextFocusLabel,
      pauseButtonLabel: isBlockingPaused
        ? "Resume blocking"
        : "Pause blocking",
    },
    snapshot: {
      unlockSessions: completedUnlockSessions,
      totalMinutesWithAllah: Math.max(0, Math.floor(totalQuranMinutesLifetime)),
    },
    flags: {
      needsScreenTime,
      needsNotifications,
      requestingScreenTime,
      refreshing,
      showSetupApps,
      showSetupTimes,
      showTimeline,
    },
    actions: {
      openSettings: handleOpenSettings,
      openQuran: handleOpenQuran,
      openFocusTimes: handleOpenFocusTimes,
      openSettingsForApps: handleOpenSettings,
      toggleBlockingPause: handleToggleBlockingPause,
      requestScreenTime: requestScreenTimePermission,
      requestNotifications: requestNotificationPermission,
      refreshHome: handleRefresh,
    },
  };
};
