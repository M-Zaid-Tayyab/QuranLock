import {
  DEFAULT_FUNNEL_VARIANT,
  FUNNEL_VARIANTS,
  type FunnelVariant,
} from "@/constants/funnelText";
import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RemoteAppConfigPayload {
  isRamadan: boolean;
  funnelVariant?: string;
  experienceKey?: string;
}

interface AppConfigState {
  isRamadan: boolean;
  funnelVariant: FunnelVariant;
  lastSyncedAt: number | null;
}

interface AppConfigActions {
  applyRemoteConfig: (value: RemoteAppConfigPayload) => void;
}

const resolveFunnelVariant = (input: {
  isRamadan: boolean;
  funnelVariant?: string;
  experienceKey?: string;
}): FunnelVariant => {
  const variantKey = input.funnelVariant ?? input.experienceKey;
  if (variantKey === FUNNEL_VARIANTS.RAMADAN) {
    return FUNNEL_VARIANTS.RAMADAN;
  }
  if (variantKey === FUNNEL_VARIANTS.REGULAR) {
    return FUNNEL_VARIANTS.REGULAR;
  }
  return input.isRamadan ? FUNNEL_VARIANTS.RAMADAN : FUNNEL_VARIANTS.REGULAR;
};

export const useAppConfigStore = create<AppConfigState & AppConfigActions>()(
  persist(
    (set) => ({
      isRamadan: false,
      funnelVariant: DEFAULT_FUNNEL_VARIANT,
      lastSyncedAt: null,
      applyRemoteConfig: (value) => {
        set({
          isRamadan: value.isRamadan,
          funnelVariant: resolveFunnelVariant(value),
          lastSyncedAt: Date.now(),
        });
      },
    }),
    {
      name: STORE_KEYS.APP_CONFIG_STORE,
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      migrate: (persistedState) => {
        if (persistedState == null || typeof persistedState !== "object") {
          return {
            isRamadan: false,
            funnelVariant: DEFAULT_FUNNEL_VARIANT,
            lastSyncedAt: null,
          };
        }

        const legacy = persistedState as {
          isRamadan?: unknown;
          funnelVariant?: unknown;
          experienceKey?: unknown;
          lastSyncedAt?: unknown;
        };

        return {
          isRamadan: Boolean(legacy.isRamadan),
          funnelVariant: resolveFunnelVariant({
            isRamadan: Boolean(legacy.isRamadan),
            funnelVariant:
              typeof legacy.funnelVariant === "string"
                ? legacy.funnelVariant
                : undefined,
            experienceKey:
              typeof legacy.experienceKey === "string"
                ? legacy.experienceKey
                : undefined,
          }),
          lastSyncedAt:
            typeof legacy.lastSyncedAt === "number" ? legacy.lastSyncedAt : null,
        };
      },
    },
  ),
);
