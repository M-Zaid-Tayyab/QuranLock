import "../../global.css";
import { colors } from "@/constants/colors";
import { ensureQuranPack } from "@/services/quranPack";
import { configureRevenueCat } from "@/services/revenueCat";
import { useUserSync } from "@/hooks/useUserSync";
import { useUserStore } from "@/store/user";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import { identifyDevice, vexo } from "vexo-analytics";

const vexoApiKey = process.env.EXPO_PUBLIC_VEXO_API_KEY;
if (vexoApiKey) {
  vexo(vexoApiKey);
}

function useDeepLinkToVerse() {
  const router = useRouter();

  useEffect(() => {
    ensureQuranPack().catch(() => undefined);
    const handleUrl = (url: string | null) => {
      if (url && (url === "quranlock://verse" || url.startsWith("quranlock://verse"))) {
        router.replace("/verse");
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const linkSub = Linking.addEventListener("url", (e) => handleUrl(e.url));

    const notificationSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content;
      const url = (content.data?.url ?? (content as { userInfo?: { url?: string } }).userInfo?.url) as string | undefined;
      if (url && (url === "quranlock://verse" || url.startsWith("quranlock://verse"))) {
        router.replace("/verse");
      }
    });

    return () => {
      linkSub.remove();
      notificationSub.remove();
    };
  }, [router]);
}

export default function RootLayout() {
  useDeepLinkToVerse();
  useUserSync();

  const appUserId = useUserStore((s) => s.appUserId);
  const setAppUserId = useUserStore((s) => s.setAppUserId);
  const setIsPremium = useUserStore((s) => s.setIsPremium);

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
  }, [appUserId, setAppUserId, setIsPremium]);

  useEffect(() => {
    if (!appUserId) return;
    identifyDevice(appUserId).catch(() => undefined);
  }, [appUserId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
