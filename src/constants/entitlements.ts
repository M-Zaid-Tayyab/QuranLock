export const ENTITLEMENT_FEATURES = {
  FOCUS_SCHEDULE: "focus_schedule",
  QURAN_READ: "quran_read",
} as const;

export type EntitlementFeature =
  (typeof ENTITLEMENT_FEATURES)[keyof typeof ENTITLEMENT_FEATURES];

export const ENTITLEMENT_REASONS = {
  PREMIUM_REQUIRED: "premium_required",
} as const;

export type EntitlementReason =
  (typeof ENTITLEMENT_REASONS)[keyof typeof ENTITLEMENT_REASONS];

export const PAYWALL_SOURCES = {
  HOME_READ_QURAN: "home_read_quran",
  FOCUS_TIMES_EDIT: "focus_times_edit",
  DEEP_LINK_VERSE: "deep_link_verse",
  VERSE_GUARD: "verse_guard",
  FOCUS_TIMES_ADD_PRAYER: "focus_times_add_prayer",
  FOCUS_TIMES_ADD_CUSTOM: "focus_times_add_custom",
} as const;

export type PaywallSource =
  (typeof PAYWALL_SOURCES)[keyof typeof PAYWALL_SOURCES];
