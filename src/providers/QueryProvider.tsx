import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
