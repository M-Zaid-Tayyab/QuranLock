import { UpdateBanner } from "@/components/common";
import { colors } from "@/constants/colors";
import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useRemoteAppConfig } from "@/hooks/app";
import {
  usePremiumAccessSync,
  usePushNotificationSync,
  useUserSync,
} from "@/hooks/user";
import { QueryProvider } from "@/providers/QueryProvider";
import { convexClient } from "@/services/convexClient";
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
import {
  Stack,
  usePathname,
  useRootNavigationState,
  useRouter,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
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

SplashScreen.setOptions({
  duration: 2000,
});

function useDeepLinkToVerse() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const isPremium = useUserStore((s) => s.isPremium);
  const handledNotificationIdRef = useRef<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  const routeFromUrl = useCallback(
    (url: string | null) => {
      if (
        !url ||
        (url !== "quranlock://verse" && !url.startsWith("quranlock://verse"))
      ) {
        return;
      }

      const gate = canOpenQuran({ isPremium });
      if (gate.allowed) {
        if (pathname !== "/verse") {
          router.replace("/verse");
        }
        return;
      }

      if (pathname !== "/paywall") {
        openPaywallForBlockedDecision(
          router,
          gate,
          PAYWALL_SOURCES.DEEP_LINK_VERSE,
          {
            replace: true,
          },
        );
      }
    },
    [isPremium, pathname, router],
  );

  const queueNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const notificationId = response.notification.request.identifier;
      if (handledNotificationIdRef.current === notificationId) {
        return;
      }
      handledNotificationIdRef.current = notificationId;
      const content = response.notification.request.content;
      const triggerPayload =
        response.notification.request.trigger &&
        "payload" in response.notification.request.trigger
          ? response.notification.request.trigger.payload
          : undefined;
      const url =
        (content.data?.url as string | undefined) ??
        (content as { userInfo?: { url?: string } }).userInfo?.url ??
        (triggerPayload as { url?: string } | undefined)?.url ??
        ((triggerPayload as { userInfo?: { url?: string } } | undefined)
          ?.userInfo?.url as string | undefined);
      if (!url) {
        return;
      }
      pendingUrlRef.current = url;
      Notifications.clearLastNotificationResponse();
    },
    [],
  );

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }
    const pendingUrl = pendingUrlRef.current;
    if (!pendingUrl) {
      return;
    }
    pendingUrlRef.current = null;
    routeFromUrl(pendingUrl);
  }, [rootNavigationState?.key, routeFromUrl]);

  useEffect(() => {
    queueNotificationResponse(Notifications.getLastNotificationResponse());
    const notificationSub =
      Notifications.addNotificationResponseReceivedListener(
        queueNotificationResponse,
      );

    return () => {
      notificationSub.remove();
    };
  }, [queueNotificationResponse]);
}

function RootLayoutContent() {
  useDeepLinkToVerse();
  useRemoteAppConfig();
  useUserSync();
  usePushNotificationSync();
  usePremiumAccessSync();

  const {
    appUserId,
    onboardingComplete,
    isPremium,
    setAppUserId,
    setIsPremium,
  } = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      onboardingComplete: s.onboardingComplete,
      isPremium: s.isPremium,
      setAppUserId: s.setAppUserId,
      setIsPremium: s.setIsPremium,
    })),
  );
  const hasStartedBackgroundDownloadsRef = useRef(false);
  const initialAppUserIdRef = useRef(appUserId);

  useEffect(() => {
    // resetAllStores();
    if (Platform.OS === "web") return;
    let isMounted = true;
    let listener: ((info: CustomerInfo) => void) | null = null;
    configureRevenueCat(initialAppUserIdRef.current || undefined).then(
      async (configured) => {
        if (!configured || !isMounted) return;
        const rcId = await Purchases.getAppUserID();
        if (rcId && isMounted && rcId !== useUserStore.getState().appUserId) {
          setAppUserId(rcId);
        }
        const entitlementId =
          process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";
        Purchases.getCustomerInfo()
          .then((info) => {
            if (!isMounted) return;
            setIsPremium(Boolean(info.entitlements.active[entitlementId]));
            void Purchases.getOfferings().catch(() => undefined);
          })
          .catch(() => {});
        listener = (info) => {
          setIsPremium(Boolean(info.entitlements.active[entitlementId]));
        };
        Purchases.addCustomerInfoUpdateListener(listener);
      },
    );
    return () => {
      isMounted = false;
      if (listener) {
        Purchases.removeCustomerInfoUpdateListener(listener);
      }
    };
  }, [setAppUserId, setIsPremium]);

  useEffect(() => {
    if (!appUserId) return;
    identifyDevice(appUserId).catch(() => undefined);
  }, [appUserId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (appUserId) return;
    Purchases.getAppUserID()
      .then((rcId) => {
        if (!rcId) return;
        if (rcId === useUserStore.getState().appUserId) return;
        setAppUserId(rcId);
      })
      .catch(() => undefined);
  }, [appUserId, setAppUserId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (hasStartedBackgroundDownloadsRef.current) return;
    if (!appUserId || !convexClient) return;

    hasStartedBackgroundDownloadsRef.current = true;
    ensureQuranPack().catch(() => undefined);
    startGlobalRecitationOfflineDownload().catch(() => undefined);
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
          >
            <Stack.Screen name="index" />

            <Stack.Protected guard={!onboardingComplete}>
              <Stack.Screen name="welcome" />
            </Stack.Protected>

            <Stack.Protected guard={!onboardingComplete || isPremium}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>

            <Stack.Protected guard={onboardingComplete && !isPremium}>
              <Stack.Screen
                name="paywall"
                options={{ animation: "fade", gestureEnabled: false }}
              />
            </Stack.Protected>

            <Stack.Protected guard={onboardingComplete && isPremium}>
              <Stack.Screen name="home" />
              <Stack.Screen name="verse" />
              <Stack.Screen name="settings" />
            </Stack.Protected>
          </Stack>
          <UpdateBanner />
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
