export const PAYWALL_COMPACT_VIEWPORT_HEIGHT = 950;

export const PAYWALL_SPACING = {
  regular: {
    hero: "mt-10",
    features: "mt-10 gap-4",
    planSection: "mt-6",
    planCards: "mt-7 gap-3",
    checkout: "mt-5 gap-3",
    cta: "mt-4 w-full",
    footer: "gap-5 mt-4",
    restore:
      "my-2 self-center rounded-full border border-outline bg-surface px-4 py-2",
  },
  compact: {
    hero: "mt-10",
    features: "mt-7 gap-4",
    planSection: "mt-6",
    planCards: "mt-5 gap-3",
    checkout: "mt-5 gap-2",
    cta: "mt-3 w-full",
    footer: "gap-4 mt-3",
    restore:
      "self-center rounded-full border border-outline bg-surface px-4 py-2",
  },
} as const;
