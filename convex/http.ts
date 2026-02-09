import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/quran-pack",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const storageId = "kg2frehxf9889fcz00c8c91cxd80vwzd";
    const url = await ctx.storage.getUrl(storageId);
    return new Response(JSON.stringify({ url }), {
      headers: { "content-type": "application/json" },
    });
  }),
});

export default http;
