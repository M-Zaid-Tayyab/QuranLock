import { query } from "./_generated/server";

const FUNNEL_VARIANTS = {
  REGULAR: "REGULAR",
  RAMADAN: "RAMADAN",
} as const;

const APP_FLAGS = {
  isRamadan: false,
} as const;

export const getFlags = query({
  args: {},
  handler: async () => {
    const funnelVariant = APP_FLAGS.isRamadan
      ? FUNNEL_VARIANTS.RAMADAN
      : FUNNEL_VARIANTS.REGULAR;

    return {
      ...APP_FLAGS,
      funnelVariant,
    };
  },
});
