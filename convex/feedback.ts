import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { createFeedbackSupportCode } from "./feedbackSupportCode";

const MAX_APP_USER_ID_LENGTH = 200;

export const getOrCreateSupportCode = mutation({
  args: {
    appUserId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const appUserId = args.appUserId.trim();
    if (!appUserId || appUserId.length > MAX_APP_USER_ID_LENGTH) {
      throw new Error("Invalid app user ID");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", appUserId))
      .first();
    if (user?.feedbackSupportCode) return user.feedbackSupportCode;

    const supportCode = createFeedbackSupportCode(appUserId);
    if (user) {
      await ctx.db.patch(user._id, { feedbackSupportCode: supportCode });
    }
    return supportCode;
  },
});

export const getUserBySupportCode = internalQuery({
  args: {
    supportCode: v.string(),
  },
  returns: v.union(
    v.object({
      appUserId: v.string(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_feedbackSupportCode", (q) =>
        q.eq("feedbackSupportCode", args.supportCode.trim().toUpperCase()),
      )
      .first();

    if (!user) return null;
    return {
      appUserId: user.appUserId,
      name: user.name,
    };
  },
});
