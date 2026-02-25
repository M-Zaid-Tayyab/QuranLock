import { mutation } from "./_generated/server";
import { v } from "convex/values";

const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const;

const focusDurationMode = v.union(v.literal("manual"), v.literal("goal"));

const focusSchedule = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(v.literal("prayer"), v.literal("custom")),
  hour: v.number(),
  minute: v.number(),
  durationMinutes: v.number(),
});

export const upsertUser = mutation({
  args: {
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
    subscriptionTier: v.union(
      v.literal(SUBSCRIPTION_TIERS.FREE),
      v.literal(SUBSCRIPTION_TIERS.PRO),
    ),
    completedUnlockSessions: v.number(),
    streakCompletedDates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .collect();

    const normalizedPayload = {
      ...args,
      deferredFocusSchedules: args.deferredFocusSchedules ?? [],
      focusDurationMode: args.focusDurationMode ?? "goal",
      focusCompletionDays: args.focusCompletionDays ?? 30,
      focusMinutesPerPage: args.focusMinutesPerPage ?? 3,
      quranFontScale: args.quranFontScale ?? 1,
    };

    const payload = {
      ...normalizedPayload,
      updatedAt: Date.now(),
    };

    if (!existingUsers.length) {
      return ctx.db.insert("users", payload);
    }

    const [primary, ...duplicates] = existingUsers.sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );

    const normalizedCurrent = {
      appUserId: primary.appUserId,
      name: primary.name,
      age: primary.age,
      quranFrequency: primary.quranFrequency,
      reasonsDisconnect: primary.reasonsDisconnect,
      focusSchedules: primary.focusSchedules,
      deferredFocusSchedules: primary.deferredFocusSchedules ?? [],
      focusDurationMode: primary.focusDurationMode ?? "goal",
      focusCompletionDays: primary.focusCompletionDays ?? 30,
      focusMinutesPerPage: primary.focusMinutesPerPage ?? 3,
      onboardingComplete: primary.onboardingComplete,
      hasSelectedApps: primary.hasSelectedApps,
      familyActivitySelection: primary.familyActivitySelection,
      lastReadPage: primary.lastReadPage,
      translationEnabled: primary.translationEnabled,
      quranFontScale: primary.quranFontScale ?? 1,
      isPremium: primary.isPremium,
      subscriptionTier: primary.subscriptionTier,
      completedUnlockSessions: primary.completedUnlockSessions,
      streakCompletedDates: primary.streakCompletedDates,
    };

    const hasChanges =
      JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedPayload);

    if (hasChanges || duplicates.length) {
      await ctx.db.patch(primary._id, payload);
    }

    if (duplicates.length) {
      await Promise.all(duplicates.map((doc) => ctx.db.delete(doc._id)));
    }

    return primary._id;
  },
});
