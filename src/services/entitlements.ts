import {
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_REASONS,
  FREE_ENTITLEMENT_LIMITS,
  type EntitlementFeature,
  type EntitlementReason,
  type PaywallSource,
} from "@/constants/entitlements";
import type { Router } from "expo-router";

export type EntitlementGateDecision =
  | { allowed: true }
  | {
      allowed: false;
      feature: EntitlementFeature;
      reason: EntitlementReason;
    };

interface OpenPaywallOptions {
  replace?: boolean;
}

export const canAddFocusSchedule = (input: {
  isPremium: boolean;
  focusScheduleCount: number;
}): EntitlementGateDecision => {
  if (input.isPremium) return { allowed: true };
  if (input.focusScheduleCount < FREE_ENTITLEMENT_LIMITS.MAX_FOCUS_SCHEDULES) {
    return { allowed: true };
  }
  return {
    allowed: false,
    feature: ENTITLEMENT_FEATURES.FOCUS_SCHEDULE,
    reason: ENTITLEMENT_REASONS.FREE_FOCUS_SCHEDULE_LIMIT_REACHED,
  };
};

export const canOpenQuran = (input: {
  isPremium: boolean;
  completedUnlockSessions: number;
}): EntitlementGateDecision => {
  if (input.isPremium) return { allowed: true };
  if (input.completedUnlockSessions < FREE_ENTITLEMENT_LIMITS.MAX_UNLOCK_SESSIONS) {
    return { allowed: true };
  }
  return {
    allowed: false,
    feature: ENTITLEMENT_FEATURES.QURAN_READ,
    reason: ENTITLEMENT_REASONS.FREE_UNLOCK_SESSION_LIMIT_REACHED,
  };
};

export const openPaywallForBlockedDecision = (
  router: Router,
  blockedDecision: Exclude<EntitlementGateDecision, { allowed: true }>,
  source: PaywallSource,
  options?: OpenPaywallOptions,
) => {
  const target = {
    pathname: "/paywall" as const,
    params: {
      source,
      feature: blockedDecision.feature,
      reason: blockedDecision.reason,
    },
  };
  if (options?.replace) {
    router.replace(target);
    return;
  }
  router.push(target);
};
