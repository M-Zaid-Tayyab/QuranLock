import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import {
  getStableAuthStatus,
  requestAuthorization,
} from "@/services/deviceActivity";
import {
  canAddFocusSchedule,
  canOpenQuran,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import type { ScheduleStatus } from "@/utils/scheduleEngine";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";

const AuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  approved: 2,
} as const;
const QURAN_TOTAL_PAGES = 604;

export interface HomeTimelineItem {
  id: string;
  label: string;
  timeLabel: string;
  durationMinutes: number;
  status: ScheduleStatus;
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

export const useHomeScreen = () => {
  const router = useRouter();
  const [screenTimeStatus, setScreenTimeStatus] = useState<number | null>(null);
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(
    null,
  );
  const [requestingScreenTime, setRequestingScreenTime] = useState(false);

  const name = useUserStore((s) => s.name);
  const isPremium = useUserStore((s) => s.isPremium);
  const completedUnlockSessions = useUserStore(
    (s) => s.completedUnlockSessions,
  );
  const lastReadPage = useUserStore((s) => s.lastReadPage);
  const focusScheduleCount = useUserStore((s) => s.focusSchedules.length);
  const hasSelectedApps = useUserStore((s) => s.hasSelectedApps);
  const { statuses, activeSchedule } = useFocusScheduleStatus();

  const accumulatedMinutes = useBlockingStore(
    (s) => s.accumulatedQuranMinutesForCurrentBlock,
  );
  const totalQuranMinutesLifetime = useBlockingStore(
    (s) => s.totalQuranMinutesLifetime,
  );
  const getRequiredMinutes = useBlockingStore((s) => s.getRequiredMinutes);

  const refreshScreenTimeStatus = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      const status = await getStableAuthStatus();
      setScreenTimeStatus(status);
    } catch {
      setScreenTimeStatus(AuthorizationStatus.notDetermined);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;

    const syncStatus = async () => {
      try {
        const status = await getStableAuthStatus();
        if (!cancelled) setScreenTimeStatus(status);
      } catch {
        if (!cancelled) {
          setScreenTimeStatus(AuthorizationStatus.notDetermined);
        }
      }
    };

    void syncStatus();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncStatus();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationGranted(status === "granted");
    });
  }, []);

  const handleRequestScreenTime = useCallback(() => {
    setRequestingScreenTime(true);
    requestAuthorization()
      .then(() => refreshScreenTimeStatus())
      .finally(() => setRequestingScreenTime(false));
  }, [refreshScreenTimeStatus]);

  const handleRequestNotifications = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationGranted(status === "granted");
  }, []);

  const requiredMinutes = getRequiredMinutes();
  const progressRatio =
    requiredMinutes > 0 ? Math.min(accumulatedMinutes / requiredMinutes, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const hasPendingSchedules = statuses.some((entry) => entry.status === "pending");
  const isBlockingActive =
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
  const journeyCompletionPercent =
    journeyProgressPercent;
  const pagesRead = Math.min(
    QURAN_TOTAL_PAGES,
    Math.max(1, Math.trunc(lastReadPage || 1)),
  );

  const timelineItems = useMemo(
    () =>
      statuses.map((entry) => ({
        id: entry.schedule.id,
        label: entry.schedule.label,
        timeLabel: formatTime(entry.schedule.hour, entry.schedule.minute),
        durationMinutes: entry.schedule.durationMinutes,
        status: entry.status,
      })) satisfies HomeTimelineItem[],
    [statuses],
  );

  const nextUpcoming = timelineItems.find((item) => item.status === "upcoming");
  const nextFocusLabel = nextUpcoming
    ? `${nextUpcoming.label} • ${nextUpcoming.timeLabel}`
    : "All focus windows for today are done";

  const needsScreenTime =
    Platform.OS === "ios" &&
    screenTimeStatus != null &&
    screenTimeStatus !== AuthorizationStatus.approved;
  const needsNotifications = notificationGranted === false;

  const showSetupApps = !hasSelectedApps;
  const showSetupTimes = hasSelectedApps && timelineItems.length === 0;
  const showTimeline = hasSelectedApps && timelineItems.length > 0;

  const journeyTitle = isBlockingActive ? "Unlock in progress" : "Today's journey";
  const journeySubtitle = isBlockingActive
    ? `${remainingMinutes}:${remainingSecondsPart.toString().padStart(2, "0")} left to unlock apps`
    : `${completedSchedulesCount}/${Math.max(
        1,
        totalSchedules,
      )} focus windows completed`;

  const streakDays = useMemo(() => {
    const now = new Date();
    const days: HomeStreakDay[] = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - index));
      return {
        date: d.toISOString().slice(0, 10),
        dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
        completed: false,
      };
    });

    const hasAnyProgressToday =
      completedSchedulesCount > 0 ||
      accumulatedMinutes > 0 ||
      journeyCompletionPercent >= 100;
    if (hasAnyProgressToday) {
      days[days.length - 1] = {
        ...days[days.length - 1],
        completed: true,
      };
    }
    return days;
  }, [accumulatedMinutes, completedSchedulesCount, journeyCompletionPercent]);

  const handleOpenSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);

  const handleOpenQuran = useCallback(() => {
    const gate = canOpenQuran({ isPremium, completedUnlockSessions });
    if (gate.allowed) {
      router.push("/verse");
      return;
    }
    openPaywallForBlockedDecision(
      router,
      gate,
      PAYWALL_SOURCES.HOME_READ_QURAN,
    );
  }, [completedUnlockSessions, isPremium, router]);

  const handleOpenFocusTimes = useCallback(() => {
    const gate = canAddFocusSchedule({ isPremium, focusScheduleCount });
    if (gate.allowed) {
      router.push({
        pathname: "/onboarding",
        params: { mode: "edit-times", from: "home" },
      });
      return;
    }
    openPaywallForBlockedDecision(
      router,
      gate,
      PAYWALL_SOURCES.HOME_SET_FOCUS_TIMES,
    );
  }, [focusScheduleCount, isPremium, router]);

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
    },
    timeline: {
      items: timelineItems,
      nextFocusLabel,
    },
    snapshot: {
      unlockSessions: completedUnlockSessions,
      totalMinutesWithAllah: Math.max(0, Math.floor(totalQuranMinutesLifetime)),
    },
    flags: {
      needsScreenTime,
      needsNotifications,
      requestingScreenTime,
      showSetupApps,
      showSetupTimes,
      showTimeline,
    },
    actions: {
      openSettings: handleOpenSettings,
      openQuran: handleOpenQuran,
      openFocusTimes: handleOpenFocusTimes,
      openSettingsForApps: handleOpenSettings,
      requestScreenTime: handleRequestScreenTime,
      requestNotifications: handleRequestNotifications,
    },
  };
};
