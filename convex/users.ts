import { mutation } from "./_generated/server";
import { v } from "convex/values";

const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const;

export const upsertUser = mutation({
  args: {
    appUserId: v.string(),
    name: v.string(),
    age: v.optional(v.number()),
    quranFrequency: v.optional(v.string()),
    reasonsDisconnect: v.array(v.string()),
    focusSchedules: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        kind: v.union(v.literal("prayer"), v.literal("custom")),
        hour: v.number(),
        minute: v.number(),
        durationMinutes: v.number(),
      }),
    ),
    deferredFocusSchedules: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          kind: v.union(v.literal("prayer"), v.literal("custom")),
          hour: v.number(),
          minute: v.number(),
          durationMinutes: v.number(),
        }),
      ),
    ),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .first();

    const payload = {
      ...args,
      deferredFocusSchedules: args.deferredFocusSchedules ?? [],
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return ctx.db.insert("users", payload);
  },
});
