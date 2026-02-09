import { query } from "./_generated/server";

const QURAN_PACK_STORAGE_ID =
  "kg2frehxf9889fcz00c8c91cxd80vwzd";

export const getQuranPackUrl = query({
  args: {},
  handler: async (ctx) => {
    const url = await ctx.storage.getUrl(QURAN_PACK_STORAGE_ID);
    return { url };
  },
});
