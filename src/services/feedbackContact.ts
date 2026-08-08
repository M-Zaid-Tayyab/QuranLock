import { convexClient } from "@/services/convexClient";
import { api } from "../../convex/_generated/api";

export type FeedbackContactSource = "home" | "onboarding" | "paywall";
export type FeedbackContactChannel =
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "twitter";

const WHATSAPP_BASE_URL = "https://wa.me";

const normalizeExternalUrl = (value: string | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const getFeedbackInstagramUrl = () =>
  normalizeExternalUrl(
    process.env.EXPO_PUBLIC_INSTAGRAM_DM_URL ??
      process.env.EXPO_PUBLIC_INSTAGRAM_URL,
  );

export const getFeedbackTikTokUrl = () =>
  normalizeExternalUrl(process.env.EXPO_PUBLIC_TIKTOK_URL);

export const getFeedbackXUrl = () =>
  normalizeExternalUrl(process.env.EXPO_PUBLIC_X_URL);

export const getFeedbackWhatsAppNumber = () =>
  (process.env.EXPO_PUBLIC_WHATSAPP_URL ?? "")
    .replace(/^https?:\/\/wa\.me\//i, "")
    .split(/[?#]/)[0]
    ?.replace(/\D/g, "") ?? "";

export const getFeedbackSupportCode = async (
  appUserId: string,
): Promise<string | null> => {
  if (!convexClient || !appUserId.trim()) return null;

  try {
    return await convexClient.mutation(api.feedback.getOrCreateSupportCode, {
      appUserId,
    });
  } catch {
    return null;
  }
};

export const buildFeedbackMessage = (
  source: FeedbackContactSource,
  supportCode?: string,
) => {
  const context =
    source === "paywall"
      ? "I’d like to claim a free week of QuranLock."
      : source === "home"
        ? "I have an idea, criticism, or something I’d like changed in QuranLock."
        : "I have an idea or some honest feedback about QuranLock.";
  const code = supportCode ? ` Support code: ${supportCode}` : "";
  return `Assalamu alaikum Zaid. ${context}${code}`;
};

export const buildFeedbackWhatsAppUrl = (
  phoneNumber: string,
  message: string,
) => `${WHATSAPP_BASE_URL}/${phoneNumber}?text=${encodeURIComponent(message)}`;
