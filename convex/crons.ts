import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "send subscription feedback nudges",
  { hours: 6 },
  internal.subscriptionFeedbackNudgeActions.sendDueSubscriptionFeedbackNudges,
  {},
);

export default crons;
