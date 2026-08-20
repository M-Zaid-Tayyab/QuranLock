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
import { openFeedbackContactFromNotification } from "@/services/feedbackContact";
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

const SETTINGS_FEEDBACK_NOTIFICATION_ACTION = "open_feedback_contact";
const FREE_WEEK_NOTIFICATION_ACTION = "open_free_week_contact";
const FEEDBACK_NOTIFICATION_SOURCE = "subscription_feedback_nudge";

type NotificationDestination =
  | { type: "feedback"; source: "paywall" | "settings" }
  | { type: "url"; url: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getFirstString = (records: Record<string, unknown>[], key: string) => {
  for (const record of records) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
};

const getNotificationDestination = (
  response: Notifications.NotificationResponse,
): NotificationDestination | null => {
  const content = response.notification.request.content;
  const trigger = response.notification.request.trigger;
  const contentRecord: Record<string, unknown> = isRecord(content)
    ? content
    : {};
  const triggerRecord: Record<string, unknown> = isRecord(trigger)
    ? trigger
    : {};
  const triggerPayload = triggerRecord.payload;
  const records = [
    content.data,
    contentRecord.userInfo,
    triggerPayload,
    isRecord(triggerPayload) ? triggerPayload.userInfo : undefined,
  ].filter(isRecord);
  const action = getFirstString(records, "action");
  const source = getFirstString(records, "source");

  if (action === FREE_WEEK_NOTIFICATION_ACTION) {
    return { type: "feedback", source: "paywall" };
  }

  if (
    action === SETTINGS_FEEDBACK_NOTIFICATION_ACTION ||
    source === FEEDBACK_NOTIFICATION_SOURCE
  ) {
    return { type: "feedback", source: "settings" };
  }

  const url = getFirstString(records, "url");
  return url ? { type: "url", url } : null;
};

const useNotificationResponseRouting = () => {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const isPremium = useUserStore((s) => s.isPremium);
  const handledNotificationIdRef = useRef<string | null>(null);
  const pendingDestinationRef = useRef<NotificationDestination | null>(null);

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

  const openDestination = useCallback(
    (destination: NotificationDestination) => {
      if (destination.type === "feedback") {
        openFeedbackContactFromNotification(
          useUserStore.getState().appUserId,
          destination.source,
        ).catch(() => undefined);
        return;
      }

      routeFromUrl(destination.url);
    },
    [routeFromUrl],
  );

  const queueNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const notificationId = response.notification.request.identifier;
      if (handledNotificationIdRef.current === notificationId) {
        return;
      }
      const destination = getNotificationDestination(response);
      if (!destination) {
        return;
      }
      handledNotificationIdRef.current = notificationId;
      Notifications.clearLastNotificationResponse();

      if (rootNavigationState?.key) {
        openDestination(destination);
        return;
      }

      pendingDestinationRef.current = destination;
    },
    [openDestination, rootNavigationState?.key],
  );

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }
    const pendingDestination = pendingDestinationRef.current;
    if (!pendingDestination) {
      return;
    }
    pendingDestinationRef.current = null;
    openDestination(pendingDestination);
  }, [openDestination, rootNavigationState?.key]);

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
};

function RootLayoutContent() {
  useNotificationResponseRouting();
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
