# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// convex/myFunctions.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// convex/myFunctions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get("messages", id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

## Quran Foundation integration

The project now includes `convex/quranFoundation.ts` with an authenticated
proxy action and in-memory token caching.

Required Convex env vars:

- `QF_CLIENT_ID`
- `QF_CLIENT_SECRET`
- `QF_OAUTH_TOKEN_URL` (or `QF_OAUTH_BASE_URL` + optional `QF_OAUTH_TOKEN_PATH`)
- `QF_CONTENT_API_BASE_URL` (or `QF_API_BASE_URL`)
- `QF_SEARCH_API_BASE_URL` (or `QF_API_BASE_URL`)
- Optional: `QF_SEARCH_SCOPE_FALLBACK_TO_CONTENT=true` (default). If `search`
  scope is not enabled for your client, token requests for `search` will
  transparently fall back to `content`.

Alternatively, set `QF_ENV` and the integration will use official defaults:

- `QF_ENV=prelive`
  - OAuth base: `https://prelive-oauth2.quran.foundation`
  - API base: `https://apis-prelive.quran.foundation`
- `QF_ENV=production`
  - OAuth base: `https://oauth2.quran.foundation`
  - API base: `https://apis.quran.foundation`

Client usage example:

```ts
await convexClient.action("quranFoundation:proxyGet", {
  scope: "search",
  path: "/v1/search",
  query: { q: "sabr", size: "10", page: "1" },
});
```
