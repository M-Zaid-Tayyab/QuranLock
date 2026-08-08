import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getEligibleUsers = internalQuery({
  args: {
    now: v.number(),
    minimumUserAgeMs: v.number(),
    repeatIntervalMs: v.number(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      expoPushToken: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("users")
      .withIndex("by_subscription_feedback_nudge", (q) =>
        q
          .eq("isPremium", false)
          .eq("notificationPermissionStatus", "granted")
          .lte(
            "subscriptionFeedbackNudgeSentAt",
            args.now - args.repeatIntervalMs,
          ),
      )
      .take(Math.min(args.limit * 4, 400));

    return candidates
      .filter(
        (user) =>
          user.onboardingComplete &&
          Boolean(user.expoPushToken) &&
          user._creationTime <= args.now - args.minimumUserAgeMs,
      )
      .slice(0, args.limit)
      .map((user) => ({
        userId: user._id,
        name: user.name,
        expoPushToken: user.expoPushToken ?? "",
      }));
  },
});

export const recordSendResults = internalMutation({
  args: {
    now: v.number(),
    sentUserIds: v.array(v.id("users")),
    invalidTokenUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const userId of args.sentUserIds) {
      await ctx.db.patch(userId, {
        subscriptionFeedbackNudgeSentAt: args.now,
        updatedAt: args.now,
      });
    }

    for (const userId of args.invalidTokenUserIds) {
      await ctx.db.patch(userId, {
        expoPushToken: undefined,
        pushTokenUpdatedAt: args.now,
        updatedAt: args.now,
      });
    }
    return null;
  },
});
