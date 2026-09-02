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

Alternatively, set `QF_ENV` and the integration will use official defaults:

- `QF_ENV=prelive`
  - OAuth base: `https://prelive-oauth2.quran.foundation`
  - Content API base: `https://apis-prelive.quran.foundation`
- `QF_ENV=production`
  - OAuth base: `https://oauth2.quran.foundation`
  - Content API base: `https://apis.quran.foundation`

Client usage example:

```ts
await convexClient.action("quranFoundation:proxyGet", {
  scope: "content",
  path: "/recitations/7/by_ayah/1:1",
});
```

## Direct feedback contact

The final onboarding step includes WhatsApp, Instagram, TikTok, and X contact
buttons. The compact paywall contact includes WhatsApp, Instagram, and TikTok.
Home shows the same compact three-channel contact after any required setup cards
and before the journey timeline.
Configure these Expo public environment variables before building the app:

- `EXPO_PUBLIC_WHATSAPP_URL` — existing `wa.me` contact URL.
- `EXPO_PUBLIC_INSTAGRAM_DM_URL` — preferred direct conversation URL.
- `EXPO_PUBLIC_INSTAGRAM_URL` — profile URL fallback when no DM URL is set.
- `EXPO_PUBLIC_TIKTOK_URL` — TikTok profile URL.
- `EXPO_PUBLIC_X_URL` — X profile URL.

Each user has one indexed `feedbackSupportCode` on their existing `users` row.
The code is added to the WhatsApp draft or copied for Instagram, TikTok, and X
so an incoming message can be matched to its QuranLock app user ID. External
messaging apps still require the user to send the prepared message themselves.

Look up an incoming support code on the current deployment with:

```sh
npx convex run feedback:getUserBySupportCode '{"supportCode":"QL-XXXXXXXXXXXX"}'
```

Add `--prod` when looking up a production message.

## Subscription feedback nudge

`crons.ts` checks once every six hours for users who:

- are not premium;
- granted notification permission and have an Expo push token;
- have been users for at least 24 hours; and
- have not received this feedback request in the previous day.

The job sends at most 50 reminders per run to users who signed up at least 24
hours ago. `EXPO_ACCESS_TOKEN` is required only when enhanced Expo push security is
enabled for the project.
The cron runs automatically after the Convex functions are deployed.

Successful sends update `subscriptionFeedbackNudgeSentAt`, making the user
eligible again after one day unless they purchase Premium. Failed sends
remain eligible for a later run, and invalid Expo tokens are removed.

Set `freeWeekTrialGrantedAt` to the trial-grant timestamp when manually
granting a user a free week. Future nudges then use a general return-to-app
message instead of the free-week claim message.
