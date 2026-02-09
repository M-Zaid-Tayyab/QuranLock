export const SCREEN_TIME = {
  ACTIVITY_NAME: "quranlock_focus",
  SELECTION_ID: "quranlock_blocked_apps",
  SHIELD_ID: "quranlock_shield",
} as const;

export type ScreenTimeKeys = keyof typeof SCREEN_TIME;
