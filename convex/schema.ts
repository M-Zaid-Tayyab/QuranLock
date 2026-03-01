import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const focusDurationMode = v.union(v.literal("manual"), v.literal("goal"));

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

export default defineSchema({
  users: defineTable({
    appUserId: v.string(),
    name: v.string(),
    age: v.optional(v.number()),
    quranFrequency: v.optional(v.string()),
    reasonsDisconnect: v.array(v.string()),
    focusSchedules: v.array(focusSchedule),
    deferredFocusSchedules: v.optional(v.array(focusSchedule)),
    focusDurationMode: v.optional(focusDurationMode),
    focusCompletionDays: v.optional(v.number()),
    focusMinutesPerPage: v.optional(v.number()),
    onboardingComplete: v.boolean(),
    hasSelectedApps: v.boolean(),
    familyActivitySelection: v.optional(v.string()),
    lastReadPage: v.number(),
    translationEnabled: v.boolean(),
    quranFontScale: v.optional(v.number()),
    isPremium: v.boolean(),
    subscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("pro")),
    ),
    completedUnlockSessions: v.number(),
    streakCompletedDates: v.array(v.string()),
    expoPushToken: v.optional(v.string()),
    notificationPermissionStatus: v.optional(notificationPermissionStatus),
    pushTokenUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_appUserId", ["appUserId"]),
});
