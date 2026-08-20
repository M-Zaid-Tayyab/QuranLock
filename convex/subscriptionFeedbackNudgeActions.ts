import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const MINIMUM_USER_AGE_MS = 24 * 60 * 60 * 1000;
const NUDGE_REPEAT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message?: string;
      details?: { error?: string };
    };

interface NudgeResult {
  selected: number;
  accepted: number;
  failed: number;
}

const getExpoHeaders = () => {
  const headers: Record<string, string> = {
    accept: "application/json",
    "accept-encoding": "gzip, deflate",
    "content-type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
};

const getFirstName = (name: string) =>
  name.trim().split(/\s+/)[0]?.slice(0, 30) ?? "";

const createNudgeMessage = (expoPushToken: string, name: string) => {
  const firstName = getFirstName(name);
  return {
    to: expoPushToken,
    sound: "default",
    title: firstName
      ? `${firstName}, what would support your Quran journey?`
      : "What would support your Quran journey?",
    body: "I’m Zaid, and I built QuranLock. If Premium doesn’t feel right yet, I’d value knowing why. Tap to message me directly.",
    data: {
      action: "open_free_week_contact",
      source: "subscription_feedback_nudge",
    },
  };
};

const sendExpoMessages = async (
  messages: ReturnType<typeof createNudgeMessage>[],
) => {
  const response = await fetch(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers: getExpoHeaders(),
    body: JSON.stringify(messages),
  });
  const payload = (await response.json()) as {
    data?: ExpoPushTicket[] | ExpoPushTicket;
  };
  if (!response.ok || !payload.data) return [];
  return Array.isArray(payload.data) ? payload.data : [payload.data];
};

export const sendDueSubscriptionFeedbackNudges = internalAction({
  args: {},
  returns: v.object({
    selected: v.number(),
    accepted: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx): Promise<NudgeResult> => {
    const now = Date.now();
    const users = await ctx.runQuery(
      internal.subscriptionFeedbackNudge.getEligibleUsers,
      {
        now,
        minimumUserAgeMs: MINIMUM_USER_AGE_MS,
        repeatIntervalMs: NUDGE_REPEAT_INTERVAL_MS,
        limit: BATCH_SIZE,
      },
    );
    if (!users.length) {
      return { selected: 0, accepted: 0, failed: 0 };
    }

    const messages = users.map((user) =>
      createNudgeMessage(user.expoPushToken, user.name),
    );

    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await sendExpoMessages(messages);
    } catch {
      return {
        selected: users.length,
        accepted: 0,
        failed: users.length,
      };
    }

    const sentUserIds = users.flatMap((user, index) =>
      tickets[index]?.status === "ok" ? [user.userId] : [],
    );
    const invalidTokenUserIds = users.flatMap((user, index) =>
      tickets[index]?.status === "error" &&
      tickets[index]?.details?.error === "DeviceNotRegistered"
        ? [user.userId]
        : [],
    );

    await ctx.runMutation(
      internal.subscriptionFeedbackNudge.recordSendResults,
      { now, sentUserIds, invalidTokenUserIds },
    );

    return {
      selected: users.length,
      accepted: sentUserIds.length,
      failed: users.length - sentUserIds.length,
    };
  },
});
