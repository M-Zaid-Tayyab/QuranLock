import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { createFeedbackSupportCode } from "./feedbackSupportCode";

const focusDurationMode = v.union(v.literal("manual"), v.literal("goal"));
const DEFAULT_FOCUS_COMPLETION_DAYS = 90;

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

type AppSelection = {
  mode: "recommended" | "manual";
  applicationCount: number;
  categoryCount: number;
  includesEntireCategory: boolean;
};

type AcquisitionSource =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "app_store_search"
  | "referral"
  | "other";

const normalizeToken = (token: string | undefined) => {
  const trimmed = token?.trim();
  return trimmed?.length ? trimmed : undefined;
};

export const upsertUser = mutation({
  args: {
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
    lastReadPage: v.number(),
    translationEnabled: v.boolean(),
    quranFontScale: v.optional(v.number()),
    isPremium: v.boolean(),
    completedUnlockSessions: v.number(),
    streakCompletedDates: v.array(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .collect();

    const [primary, ...duplicates] = existingUsers.sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );

    const normalizeUserFields = (input: {
      appUserId: string;
      name: string;
      age?: number;
      quranFrequency?: string;
      reasonsDisconnect: string[];
      acquisitionSource?: AcquisitionSource;
      focusSchedules: typeof args.focusSchedules;
      focusDurationMode?: "manual" | "goal";
      focusCompletionDays?: number;
      focusMinutesPerPage?: number;
      appSelection?: AppSelection;
      isBlockingPaused?: boolean;
      lastReadPage: number;
      translationEnabled: boolean;
      quranFontScale?: number;
      isPremium: boolean;
      completedUnlockSessions: number;
      streakCompletedDates: string[];
    }) => {
      const normalizedMode = input.focusDurationMode ?? "goal";
      const normalized = {
        appUserId: input.appUserId,
        name: input.name,
        age: input.age,
        quranFrequency: input.quranFrequency,
        reasonsDisconnect: input.reasonsDisconnect,
        acquisitionSource: input.acquisitionSource,
        focusSchedules: input.focusSchedules,
        appSelection: input.appSelection,
        isBlockingPaused: input.isBlockingPaused,
        lastReadPage: input.lastReadPage,
        translationEnabled: input.translationEnabled,
        quranFontScale: input.quranFontScale ?? 1,
        isPremium: input.isPremium,
        completedUnlockSessions: input.completedUnlockSessions,
        streakCompletedDates: input.streakCompletedDates,
        focusDurationMode: normalizedMode,
      } as {
        appUserId: string;
        name: string;
        age?: number;
        quranFrequency?: string;
        reasonsDisconnect: string[];
        acquisitionSource?: AcquisitionSource;
        focusSchedules: typeof args.focusSchedules;
        focusDurationMode: "manual" | "goal";
        focusCompletionDays?: number;
        focusMinutesPerPage?: number;
        appSelection?: AppSelection;
        isBlockingPaused?: boolean;
        lastReadPage: number;
        translationEnabled: boolean;
        quranFontScale: number;
        isPremium: boolean;
        completedUnlockSessions: number;
        streakCompletedDates: string[];
      };

      if (normalizedMode === "goal") {
        normalized.focusCompletionDays =
          input.focusCompletionDays ?? DEFAULT_FOCUS_COMPLETION_DAYS;
        normalized.focusMinutesPerPage = input.focusMinutesPerPage ?? 3;
      }

      return normalized;
    };

    const normalizedPayload = normalizeUserFields({
      ...args,
      acquisitionSource:
        args.acquisitionSource ?? primary?.acquisitionSource,
      appSelection: args.appSelection ?? primary?.appSelection,
      isBlockingPaused:
        args.isBlockingPaused ?? primary?.isBlockingPaused ?? false,
      focusDurationMode: args.focusDurationMode ?? primary?.focusDurationMode,
      focusCompletionDays:
        args.focusCompletionDays ?? primary?.focusCompletionDays,
      focusMinutesPerPage:
        args.focusMinutesPerPage ?? primary?.focusMinutesPerPage,
      quranFontScale: args.quranFontScale ?? primary?.quranFontScale,
    });

    if (!primary) {
      return ctx.db.insert("users", {
        ...normalizedPayload,
        feedbackSupportCode: createFeedbackSupportCode(args.appUserId),
        updatedAt: Date.now(),
      });
    }

    const normalizedCurrent = normalizeUserFields({
      appUserId: primary.appUserId,
      name: primary.name,
      age: primary.age,
      quranFrequency: primary.quranFrequency,
      reasonsDisconnect: primary.reasonsDisconnect,
      acquisitionSource: primary.acquisitionSource,
      focusSchedules: primary.focusSchedules,
      focusDurationMode: primary.focusDurationMode,
      focusCompletionDays: primary.focusCompletionDays,
      focusMinutesPerPage: primary.focusMinutesPerPage,
      appSelection: primary.appSelection,
      isBlockingPaused: primary.isBlockingPaused,
      lastReadPage: primary.lastReadPage,
      translationEnabled: primary.translationEnabled,
      quranFontScale: primary.quranFontScale,
      isPremium: primary.isPremium,
      completedUnlockSessions: primary.completedUnlockSessions,
      streakCompletedDates: primary.streakCompletedDates,
    });

    const hasChanges =
      JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedPayload);

    if (hasChanges || duplicates.length) {
      await ctx.db.replace(primary._id, {
        ...normalizedPayload,
        focusLockStatus: primary.focusLockStatus,
        expoPushToken: primary.expoPushToken,
        notificationPermissionStatus: primary.notificationPermissionStatus,
        subscriptionFeedbackNudgeSentAt:
          primary.subscriptionFeedbackNudgeSentAt,
        freeWeekTrialGrantedAt: primary.freeWeekTrialGrantedAt,
        feedbackSupportCode:
          primary.feedbackSupportCode ??
          createFeedbackSupportCode(primary.appUserId),
        updatedAt: Date.now(),
      });
    }

    if (duplicates.length) {
      await Promise.all(duplicates.map((doc) => ctx.db.delete(doc._id)));
    }

    return primary._id;
  },
});

export const syncFocusLockStatus = mutation({
  args: {
    appUserId: v.string(),
    focusLockStatus,
  },
  returns: v.union(
    v.object({
      updated: v.literal(true),
    }),
    v.object({
      updated: v.literal(false),
      reason: v.literal("user_not_found"),
    }),
  ),
  handler: async (ctx, args) => {
    const primary = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .order("desc")
      .first();

    if (!primary) {
      return {
        updated: false as const,
        reason: "user_not_found" as const,
      };
    }

    await ctx.db.patch(primary._id, {
      focusLockStatus: args.focusLockStatus,
      updatedAt: Date.now(),
    });

    return { updated: true as const };
  },
});

export const upsertPushToken = mutation({
  args: {
    appUserId: v.string(),
    expoPushToken: v.optional(v.string()),
    clearExpoPushToken: v.optional(v.boolean()),
    notificationPermissionStatus,
  },
  returns: v.union(
    v.object({
      updated: v.literal(false),
      reason: v.literal("user_not_found"),
    }),
    v.object({
      updated: v.boolean(),
      appUserId: v.string(),
      expoPushToken: v.optional(v.string()),
      notificationPermissionStatus,
    }),
  ),
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .collect();

    if (!existingUsers.length) {
      return {
        updated: false as const,
        reason: "user_not_found" as const,
      };
    }

    const [primary, ...duplicates] = existingUsers.sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );

    const hasExpoPushTokenInArgs = Object.prototype.hasOwnProperty.call(
      args,
      "expoPushToken",
    );
    const shouldClearExpoPushToken = args.clearExpoPushToken === true;
    const nextExpoPushToken = shouldClearExpoPushToken
      ? undefined
      : hasExpoPushTokenInArgs
        ? normalizeToken(args.expoPushToken)
        : (primary.expoPushToken ?? undefined);
    const changedToken =
      (primary.expoPushToken ?? undefined) !== nextExpoPushToken;
    const changedStatus =
      (primary.notificationPermissionStatus ?? "undetermined") !==
      args.notificationPermissionStatus;

    if (changedToken || changedStatus || duplicates.length) {
      await ctx.db.patch(primary._id, {
        ...(changedToken ? { expoPushToken: nextExpoPushToken } : {}),
        notificationPermissionStatus: args.notificationPermissionStatus,
        updatedAt: Date.now(),
      });
    }

    if (duplicates.length) {
      await Promise.all(duplicates.map((doc) => ctx.db.delete(doc._id)));
    }

    return {
      updated: changedToken || changedStatus || duplicates.length > 0,
      appUserId: primary.appUserId,
      expoPushToken: nextExpoPushToken,
      notificationPermissionStatus: args.notificationPermissionStatus,
    };
  },
});
