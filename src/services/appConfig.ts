import { convexClient } from "@/services/convexClient";
import {
  FUNNEL_VARIANTS,
  type FunnelVariant,
} from "@/constants/funnelText";
import type { RemoteAppConfigPayload } from "@/store/appConfig";

type AppConfigResponse = {
  isRamadan?: unknown;
  funnelVariant?: unknown;
  experienceKey?: unknown;
} | null;

const normalizeVariant = (value: unknown): FunnelVariant | undefined => {
  if (value === FUNNEL_VARIANTS.REGULAR) return FUNNEL_VARIANTS.REGULAR;
  if (value === FUNNEL_VARIANTS.RAMADAN) return FUNNEL_VARIANTS.RAMADAN;
  return undefined;
};

export const fetchRemoteAppConfig = async (): Promise<RemoteAppConfigPayload> => {
  if (!convexClient) {
    throw new Error("Convex client not configured");
  }

  const response = (await convexClient.query(
    "appConfig:getFlags" as any,
    {},
  )) as AppConfigResponse;

  if (typeof response?.isRamadan !== "boolean") {
    throw new Error("Invalid app config response");
  }

  const funnelVariant =
    normalizeVariant(response.funnelVariant) ??
    normalizeVariant(response.experienceKey);

  return {
    isRamadan: response.isRamadan,
    funnelVariant,
  };
};
