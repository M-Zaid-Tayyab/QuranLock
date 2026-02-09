import type {
  Action,
  CallbackName,
  DeviceActivitySchedule,
  ShieldActions,
  ShieldConfiguration,
} from "react-native-device-activity";
import {
  configureActions,
  getAuthorizationStatus,
  requestAuthorization as libRequestAuthorization,
  setFamilyActivitySelectionId,
  startMonitoring as libStartMonitoring,
  stopMonitoring as libStopMonitoring,
  unblockSelection as libUnblockSelection,
  updateShieldWithId,
} from "react-native-device-activity";
import { SCREEN_TIME } from "@/constants/screenTime";

const AuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  approved: 2,
} as const;
export type AuthorizationStatusType = (typeof AuthorizationStatus)[keyof typeof AuthorizationStatus];

export async function requestAuthorization(): Promise<void> {
  await libRequestAuthorization("individual");
}

export function getAuthStatus(): AuthorizationStatusType {
  return getAuthorizationStatus();
}

export function isAuthorized(): boolean {
  return getAuthorizationStatus() === AuthorizationStatus.approved;
}

export function setSelection(familyActivitySelection: string): void {
  setFamilyActivitySelectionId({
    id: SCREEN_TIME.SELECTION_ID,
    familyActivitySelection,
  });
}

export function configureBlockOnly(
  activityName: string,
  selectionId: string,
  shieldId: string
): void {
  const blockActions: Action[] = [
    {
      type: "blockSelection",
      familyActivitySelectionId: selectionId,
      shieldId,
    },
  ];
  configureActions({
    activityName,
    callbackName: "intervalDidStart" as CallbackName,
    actions: blockActions,
  });
}

export function configureBlockUnblock(
  activityName: string,
  selectionId: string,
  shieldId: string
): void {
  const blockActions: Action[] = [
    {
      type: "blockSelection",
      familyActivitySelectionId: selectionId,
      shieldId,
    },
  ];
  const unblockActions: Action[] = [
    {
      type: "unblockSelection",
      familyActivitySelectionId: selectionId,
    },
  ];

  configureActions({
    activityName,
    callbackName: "intervalDidStart" as CallbackName,
    actions: blockActions,
  });
  configureActions({
    activityName,
    callbackName: "intervalDidEnd" as CallbackName,
    actions: unblockActions,
  });
}

export function unblockSelection(): void {
  libUnblockSelection({ activitySelectionId: SCREEN_TIME.SELECTION_ID });
}

export function updateShield(
  config: ShieldConfiguration,
  actions: ShieldActions,
  shieldId: string = SCREEN_TIME.SHIELD_ID
): void {
  updateShieldWithId(config, actions, shieldId);
}

function nowPlusMinutes(minutes: number): { hour: number; minute: number; second: number } {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

function nowComponents(): { hour: number; minute: number; second: number } {
  const d = new Date();
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

export async function startFocusSession(durationMinutes: number): Promise<void> {
  const schedule: DeviceActivitySchedule = {
    intervalStart: nowComponents(),
    intervalEnd: nowPlusMinutes(durationMinutes),
    repeats: false,
  };
  await libStartMonitoring(SCREEN_TIME.ACTIVITY_NAME, schedule, []);
}

export function stopFocusSession(): void {
  libStopMonitoring([SCREEN_TIME.ACTIVITY_NAME]);
}

export function stopMonitoring(activityNames: string[]): void {
  if (activityNames.length === 0) return;
  libStopMonitoring(activityNames);
}

export async function startDailyBlockSchedule(hour: number, minute: number): Promise<void> {
  await startDailyBlockScheduleFor(SCREEN_TIME.ACTIVITY_NAME, hour, minute);
}

export async function startDailyBlockScheduleFor(
  activityName: string,
  hour: number,
  minute: number
): Promise<void> {
  const schedule: DeviceActivitySchedule = {
    intervalStart: { hour, minute, second: 0 },
    intervalEnd: { hour: 23, minute: 59, second: 59 },
    repeats: true,
  };
  await libStartMonitoring(activityName, schedule, []);
}

export const DEFAULT_SHIELD_CONFIG: ShieldConfiguration = {
  title: "Focus time with Quran",
  subtitle: "Tap OK to get a notification — then tap it to open a Quran verse.",
  iconSystemName: "book.closed.fill",
  primaryButtonLabel: "OK",
  backgroundBlurStyle: 18,
};

export const DEFAULT_SHIELD_ACTIONS: ShieldActions = {
  primary: {
    type: "sendNotification",
    payload: {
      title: "QuranLock",
      body: "Tap to open a Quran verse",
      userInfo: { url: "quranlock://verse" },
    },
    behavior: "close",
  },
};

export { SCREEN_TIME };
