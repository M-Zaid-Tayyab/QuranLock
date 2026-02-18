import { FUNNEL_TEXT_BY_VARIANT } from "@/constants/funnelText";
import { useAppConfigStore } from "@/store/appConfig";

export const useFunnelText = () => {
  const funnelVariant = useAppConfigStore((s) => s.funnelVariant);
  return FUNNEL_TEXT_BY_VARIANT[funnelVariant] ?? FUNNEL_TEXT_BY_VARIANT.REGULAR;
};
