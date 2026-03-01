import { mutation } from "./_generated/server";
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
  },
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
      focusSchedules: typeof args.focusSchedules;
      deferredFocusSchedules?: typeof args.focusSchedules;
      focusDurationMode?: "manual" | "goal";
      focusCompletionDays?: number;
      focusMinutesPerPage?: number;
      onboardingComplete: boolean;
      hasSelectedApps: boolean;
      familyActivitySelection?: string;
      lastReadPage: number;
      translationEnabled: boolean;
      quranFontScale?: number;
      isPremium: boolean;
      subscriptionTier?: "free" | "pro";
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
        focusSchedules: input.focusSchedules,
        onboardingComplete: input.onboardingComplete,
        hasSelectedApps: input.hasSelectedApps,
        familyActivitySelection: input.familyActivitySelection,
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
        focusSchedules: typeof args.focusSchedules;
        deferredFocusSchedules?: typeof args.focusSchedules;
        focusDurationMode: "manual" | "goal";
        focusCompletionDays?: number;
        focusMinutesPerPage?: number;
        onboardingComplete: boolean;
        hasSelectedApps: boolean;
        familyActivitySelection?: string;
        lastReadPage: number;
        translationEnabled: boolean;
        quranFontScale: number;
        isPremium: boolean;
        completedUnlockSessions: number;
        streakCompletedDates: string[];
      };

      if (input.deferredFocusSchedules?.length) {
        normalized.deferredFocusSchedules = input.deferredFocusSchedules;
      }

      if (normalizedMode === "goal") {
        normalized.focusCompletionDays = input.focusCompletionDays ?? 30;
        normalized.focusMinutesPerPage = input.focusMinutesPerPage ?? 3;
      }

      return normalized;
    };

    const normalizedPayload = normalizeUserFields({
      ...args,
      deferredFocusSchedules:
        args.deferredFocusSchedules ??
        (primary?.deferredFocusSchedules ?? undefined),
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
        updatedAt: Date.now(),
      });
    }

    const normalizedCurrent = normalizeUserFields({
      appUserId: primary.appUserId,
      name: primary.name,
      age: primary.age,
      quranFrequency: primary.quranFrequency,
      reasonsDisconnect: primary.reasonsDisconnect,
      focusSchedules: primary.focusSchedules,
      deferredFocusSchedules: primary.deferredFocusSchedules,
      focusDurationMode: primary.focusDurationMode,
      focusCompletionDays: primary.focusCompletionDays,
      focusMinutesPerPage: primary.focusMinutesPerPage,
      onboardingComplete: primary.onboardingComplete,
      hasSelectedApps: primary.hasSelectedApps,
      familyActivitySelection: primary.familyActivitySelection,
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
        expoPushToken: primary.expoPushToken,
        notificationPermissionStatus: primary.notificationPermissionStatus,
        pushTokenUpdatedAt: primary.pushTokenUpdatedAt,
        updatedAt: Date.now(),
      });
    }

    if (duplicates.length) {
      await Promise.all(duplicates.map((doc) => ctx.db.delete(doc._id)));
    }

    return primary._id;
  },
});

export const upsertPushToken = mutation({
  args: {
    appUserId: v.string(),
    expoPushToken: v.optional(v.string()),
    clearExpoPushToken: v.optional(v.boolean()),
    notificationPermissionStatus,
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_appUserId", (q) => q.eq("appUserId", args.appUserId))
      .collect();

    if (!existingUsers.length) {
      return {
        updated: false,
        reason: "user_not_found",
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
        pushTokenUpdatedAt: Date.now(),
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
