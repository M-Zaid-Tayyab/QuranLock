import { getNextDuration } from "@/configs/onboarding";
import { SCREEN_TIME } from "@/constants/screenTime";
import {
  DEFAULT_SHIELD_ACTIONS,
  DEFAULT_SHIELD_CONFIG,
  configureBlockOnly,
  startDailyBlockScheduleFor,
  stopMonitoring,
  updateShield,
} from "@/services/deviceActivity";
import type { FocusSchedule } from "@/store/user";
import { Platform } from "react-native";

interface ApplyFocusSchedulesToDeviceArgs {
  previousSchedules: FocusSchedule[];
  nextSchedules: FocusSchedule[];
  setQuranMinutesToUnblock: (minutes: number) => void;
}

export const applyFocusSchedulesToDevice = async ({
  previousSchedules,
  nextSchedules,
  setQuranMinutesToUnblock,
}: ApplyFocusSchedulesToDeviceArgs) => {
  setQuranMinutesToUnblock(getNextDuration(nextSchedules));
  if (Platform.OS !== "ios") return;

  const previousNames = previousSchedules.map(
    (schedule) => `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`,
  );
  const activityNames = nextSchedules.map(
    (schedule) => `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`,
  );
  stopMonitoring(Array.from(new Set([...previousNames, ...activityNames])));

  if (!nextSchedules.length) return;
  updateShield(DEFAULT_SHIELD_CONFIG, DEFAULT_SHIELD_ACTIONS, SCREEN_TIME.SHIELD_ID);

  for (const schedule of nextSchedules) {
    const activityName = `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`;
    configureBlockOnly(activityName, SCREEN_TIME.SELECTION_ID, SCREEN_TIME.SHIELD_ID);
    await startDailyBlockScheduleFor(activityName, schedule.hour, schedule.minute);
  }
};
