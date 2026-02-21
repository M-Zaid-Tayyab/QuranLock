import { convexClient } from "@/services/convexClient";
import { fetchRemoteAppConfig } from "@/services/appConfig";
import { useAppConfigStore } from "@/store/appConfig";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const useRemoteAppConfig = () => {
  const applyRemoteConfig = useAppConfigStore((s) => s.applyRemoteConfig);
  const query = useQuery({
    queryKey: ["appConfig", "flags"],
    queryFn: fetchRemoteAppConfig,
    enabled: Boolean(convexClient),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!query.data) return;
    applyRemoteConfig(query.data);
  }, [query.data]);
};
