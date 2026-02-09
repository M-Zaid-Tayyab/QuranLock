import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
    onboardingComplete: v.boolean(),
    hasSelectedApps: v.boolean(),
    lastReadPage: v.number(),
    wordByWordEnabled: v.boolean(),
    translationEnabled: v.boolean(),
    isPremium: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .first();

    const payload = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return ctx.db.insert("users", payload);
  },
});
