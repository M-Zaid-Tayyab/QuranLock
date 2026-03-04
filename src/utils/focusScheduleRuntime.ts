import { getNextDuration } from "@/configs/onboarding";
import { SCREEN_TIME } from "@/constants/screenTime";
import {
  DEFAULT_SHIELD_ACTIONS,
  DEFAULT_SHIELD_CONFIG,
  configureBlockUnblock,
  startDailyBlockScheduleFor,
  stopMonitoring,
  updateShield,
} from "@/services/deviceActivity";
import type { FocusSchedule } from "@/store/user";
import {
  getFocusScheduleActivityName,
  getFocusScheduleActivityNames,
  getFocusScheduleFingerprint,
} from "@/utils/focusScheduleCoordinator";
import { Platform } from "react-native";

interface ApplyFocusSchedulesToDeviceArgs {
  schedules: FocusSchedule[];
  setQuranMinutesToUnblock: (minutes: number) => void;
  stopActivityNames?: string[];
}

export {
  getFocusScheduleActivityName,
  getFocusScheduleActivityNames,
  getFocusScheduleFingerprint,
};

export const applyFocusSchedulesToDevice = async ({
  schedules,
  setQuranMinutesToUnblock,
  stopActivityNames = [],
}: ApplyFocusSchedulesToDeviceArgs) => {
  setQuranMinutesToUnblock(getNextDuration(schedules));
  if (Platform.OS !== "ios") return;

  stopMonitoring(Array.from(new Set(stopActivityNames)));

  if (!schedules.length) return;
  updateShield(DEFAULT_SHIELD_CONFIG, DEFAULT_SHIELD_ACTIONS, SCREEN_TIME.SHIELD_ID);

  for (const schedule of schedules) {
    const activityName = getFocusScheduleActivityName(schedule.id);
    configureBlockUnblock(
      activityName,
      SCREEN_TIME.SELECTION_ID,
      SCREEN_TIME.SHIELD_ID,
    );
    await startDailyBlockScheduleFor(activityName, schedule.hour, schedule.minute);
  }
};
