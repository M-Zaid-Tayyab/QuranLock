/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appConfig from "../appConfig.js";
import type * as crons from "../crons.js";
import type * as feedback from "../feedback.js";
import type * as feedbackSupportCode from "../feedbackSupportCode.js";
import type * as http from "../http.js";
import type * as quranFoundation from "../quranFoundation.js";
import type * as quranPack from "../quranPack.js";
import type * as subscriptionFeedbackNudge from "../subscriptionFeedbackNudge.js";
import type * as subscriptionFeedbackNudgeActions from "../subscriptionFeedbackNudgeActions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appConfig: typeof appConfig;
  crons: typeof crons;
  feedback: typeof feedback;
  feedbackSupportCode: typeof feedbackSupportCode;
  http: typeof http;
  quranFoundation: typeof quranFoundation;
  quranPack: typeof quranPack;
  subscriptionFeedbackNudge: typeof subscriptionFeedbackNudge;
  subscriptionFeedbackNudgeActions: typeof subscriptionFeedbackNudgeActions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
