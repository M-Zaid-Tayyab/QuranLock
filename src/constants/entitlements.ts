export const FREE_ENTITLEMENT_LIMITS = {
  MAX_FOCUS_SCHEDULES: 5,
  MAX_UNLOCK_SESSIONS: 5,
} as const;

export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const;

export type SubscriptionTier =
  (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export const ENTITLEMENT_FEATURES = {
  FOCUS_SCHEDULE: "focus_schedule",
  QURAN_READ: "quran_read",
} as const;

export type EntitlementFeature =
  (typeof ENTITLEMENT_FEATURES)[keyof typeof ENTITLEMENT_FEATURES];

export const ENTITLEMENT_REASONS = {
  FREE_FOCUS_SCHEDULE_LIMIT_REACHED: "free_focus_schedule_limit_reached",
  FREE_UNLOCK_SESSION_LIMIT_REACHED: "free_unlock_session_limit_reached",
} as const;

export type EntitlementReason =
  (typeof ENTITLEMENT_REASONS)[keyof typeof ENTITLEMENT_REASONS];

export const PAYWALL_SOURCES = {
  HOME_READ_QURAN: "home_read_quran",
  HOME_SET_FOCUS_TIMES: "home_set_focus_times",
  DEEP_LINK_VERSE: "deep_link_verse",
  VERSE_GUARD: "verse_guard",
  FOCUS_TIMES_ADD_PRAYER: "focus_times_add_prayer",
  FOCUS_TIMES_ADD_CUSTOM: "focus_times_add_custom",
} as const;

export type PaywallSource =
  (typeof PAYWALL_SOURCES)[keyof typeof PAYWALL_SOURCES];
