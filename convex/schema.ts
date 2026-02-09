import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    onboardingComplete: v.boolean(),
    hasSelectedApps: v.boolean(),
    lastReadPage: v.number(),
    wordByWordEnabled: v.boolean(),
    translationEnabled: v.boolean(),
    isPremium: v.boolean(),
    updatedAt: v.number(),
  }).index("by_appUserId", ["appUserId"]),
});
