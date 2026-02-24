import { colors } from "@/constants/colors";
import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useRemoteAppConfig } from "@/hooks/app";
import {
  useFocusScheduleEntitlementReconciliation,
  useUserSync,
} from "@/hooks/user";
import { QueryProvider } from "@/providers/QueryProvider";
import {
  canOpenQuran,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { ensureQuranPack } from "@/services/quranPack";
import { startGlobalRecitationOfflineDownload } from "@/services/recitationPack";
import { configureRevenueCat } from "@/services/revenueCat";
import { useUserStore } from "@/store/user";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import { identifyDevice, vexo } from "vexo-analytics";
import { useShallow } from "zustand/react/shallow";
import "../../global.css";

const vexoApiKey = process.env.EXPO_PUBLIC_VEXO_API_KEY;
if (vexoApiKey) {
  vexo(vexoApiKey);
}

function useDeepLinkToVerse() {
  const router = useRouter();
  const { isPremium, completedUnlockSessions } = useUserStore(
    useShallow((s) => ({
      isPremium: s.isPremium,
      completedUnlockSessions: s.completedUnlockSessions,
    })),
  );

  useEffect(() => {
    ensureQuranPack().catch(() => undefined);
    startGlobalRecitationOfflineDownload().catch(() => undefined);
    const handleUrl = (url: string | null) => {
      if (
        url &&
        (url === "quranlock://verse" || url.startsWith("quranlock://verse"))
      ) {
        const gate = canOpenQuran({ isPremium, completedUnlockSessions });
        if (gate.allowed) {
          router.replace("/verse");
          return;
        }
        openPaywallForBlockedDecision(
          router,
          gate,
          PAYWALL_SOURCES.DEEP_LINK_VERSE,
          {
            replace: true,
          },
        );
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const linkSub = Linking.addEventListener("url", (e) => handleUrl(e.url));

    const notificationSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const content = response.notification.request.content;
        const url = (content.data?.url ??
          (content as { userInfo?: { url?: string } }).userInfo?.url) as
          | string
          | undefined;
        handleUrl(url ?? null);
      });

    return () => {
      linkSub.remove();
      notificationSub.remove();
    };
  }, [completedUnlockSessions, isPremium, router]);
}

function RootLayoutContent() {
  useDeepLinkToVerse();
  useRemoteAppConfig();
  useUserSync();
  useFocusScheduleEntitlementReconciliation();

  const { appUserId, setAppUserId, setIsPremium } = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      setAppUserId: s.setAppUserId,
      setIsPremium: s.setIsPremium,
    })),
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    let isMounted = true;
    let listener: ((info: CustomerInfo) => void) | null = null;
    configureRevenueCat(appUserId || undefined).then(async (configured) => {
      if (!configured) return;
      if (!appUserId) {
        const rcId = await Purchases.getAppUserID();
        if (rcId && isMounted) {
          setAppUserId(rcId);
        }
      }
      const entitlementId =
        process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";
      Purchases.getCustomerInfo()
        .then((info) => {
          if (!isMounted) return;
          setIsPremium(Boolean(info.entitlements.active[entitlementId]));
        })
        .catch(() => {});
      listener = (info) => {
        setIsPremium(Boolean(info.entitlements.active[entitlementId]));
      };
      Purchases.addCustomerInfoUpdateListener(listener);
    });
    return () => {
      isMounted = false;
      if (listener) {
        Purchases.removeCustomerInfoUpdateListener(listener);
      }
    };
  }, [appUserId]);

  useEffect(() => {
    if (!appUserId) return;
    identifyDevice(appUserId).catch(() => undefined);
  }, [appUserId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "slide_from_right",
            }}
          />
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <RootLayoutContent />
    </QueryProvider>
  );
}
