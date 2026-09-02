import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const focusDurationMode = v.union(v.literal("manual"), v.literal("goal"));

const acquisitionSource = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("app_store_search"),
  v.literal("referral"),
  v.literal("other"),
);

const focusSchedule = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(v.literal("prayer"), v.literal("custom")),
  hour: v.number(),
  minute: v.number(),
  durationMinutes: v.number(),
});

const notificationPermissionStatus = v.union(
  v.literal("granted"),
  v.literal("denied"),
  v.literal("undetermined"),
);

const appSelection = v.object({
  mode: v.union(v.literal("recommended"), v.literal("manual")),
  applicationCount: v.number(),
  categoryCount: v.number(),
  includesEntireCategory: v.boolean(),
});

const focusLockSession = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(v.literal("prayer"), v.literal("custom")),
  hour: v.number(),
  minute: v.number(),
  durationMinutes: v.number(),
});

const focusLockStatus = v.object({
  dateKey: v.string(),
  isAppsLocked: v.boolean(),
  activeSession: v.optional(focusLockSession),
  pendingSessions: v.array(focusLockSession),
  updatedAt: v.number(),
});

export default defineSchema({
  users: defineTable({
    appUserId: v.string(),
    name: v.string(),
    age: v.optional(v.number()),
    quranFrequency: v.optional(v.string()),
    reasonsDisconnect: v.array(v.string()),
    acquisitionSource: v.optional(acquisitionSource),
    focusSchedules: v.array(focusSchedule),
    focusDurationMode: v.optional(focusDurationMode),
    focusCompletionDays: v.optional(v.number()),
    focusMinutesPerPage: v.optional(v.number()),
    appSelection: v.optional(appSelection),
    isBlockingPaused: v.optional(v.boolean()),
    focusLockStatus: v.optional(focusLockStatus),
    lastReadPage: v.number(),
    translationEnabled: v.boolean(),
    quranFontScale: v.optional(v.number()),
    isPremium: v.boolean(),
    completedUnlockSessions: v.number(),
    streakCompletedDates: v.array(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationPermissionStatus: v.optional(notificationPermissionStatus),
    subscriptionFeedbackNudgeSentAt: v.optional(v.number()),
    freeWeekTrialGrantedAt: v.optional(v.number()),
    feedbackSupportCode: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_appUserId", ["appUserId"])
    .index("by_feedbackSupportCode", ["feedbackSupportCode"])
    .index("by_subscription_feedback_nudge", [
      "isPremium",
      "notificationPermissionStatus",
      "subscriptionFeedbackNudgeSentAt",
    ]),
});
