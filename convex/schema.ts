import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const;

const focusSchedule = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(v.literal("prayer"), v.literal("custom")),
  hour: v.number(),
  minute: v.number(),
  durationMinutes: v.number(),
});

export default defineSchema({
  users: defineTable({
    appUserId: v.string(),
    name: v.string(),
    age: v.optional(v.number()),
    quranFrequency: v.optional(v.string()),
    reasonsDisconnect: v.array(v.string()),
    focusSchedules: v.array(focusSchedule),
    deferredFocusSchedules: v.optional(v.array(focusSchedule)),
    onboardingComplete: v.boolean(),
    hasSelectedApps: v.boolean(),
    lastReadPage: v.number(),
    translationEnabled: v.boolean(),
    isPremium: v.boolean(),
    subscriptionTier: v.union(
      v.literal(SUBSCRIPTION_TIERS.FREE),
      v.literal(SUBSCRIPTION_TIERS.PRO),
    ),
    completedUnlockSessions: v.number(),
    streakCompletedDates: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_appUserId", ["appUserId"]),
});
