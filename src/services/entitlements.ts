import {
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_REASONS,
  PAYWALL_SOURCES,
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

export const canOpenQuran = (input: {
  isPremium: boolean;
}): EntitlementGateDecision => {
  if (input.isPremium) return { allowed: true };
  return {
    allowed: false,
    feature: ENTITLEMENT_FEATURES.QURAN_READ,
    reason: ENTITLEMENT_REASONS.PREMIUM_REQUIRED,
  };
};

export const canEditFocusTimes = (input: {
  isPremium: boolean;
}): EntitlementGateDecision => {
  if (input.isPremium) return { allowed: true };
  return {
    allowed: false,
    feature: ENTITLEMENT_FEATURES.FOCUS_SCHEDULE,
    reason: ENTITLEMENT_REASONS.PREMIUM_REQUIRED,
  };
};

export const ensureCanEditFocusTimes = (
  router: Router,
  input: { isPremium: boolean },
  options?: OpenPaywallOptions,
) => {
  const gate = canEditFocusTimes(input);
  if (gate.allowed) return true;
  openPaywallForBlockedDecision(
    router,
    gate,
    PAYWALL_SOURCES.FOCUS_TIMES_EDIT,
    options,
  );
  return false;
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
