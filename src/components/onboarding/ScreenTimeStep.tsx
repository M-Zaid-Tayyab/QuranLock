import { colors } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import {
  getAuthStatus,
  getStableAuthStatus,
  requestAuthorization,
} from "@/services/deviceActivity";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";

const AuthorizationStatus = { notDetermined: 0, denied: 1, approved: 2 } as const;

interface ScreenTimeStepProps {
  onAuthorizationChange?: (approved: boolean) => void;
  onAuthorizationStatusChange?: (status: number) => void;
}

export function ScreenTimeStep({
  onAuthorizationChange,
  onAuthorizationStatusChange,
}: ScreenTimeStepProps = {}) {
  const funnelText = useFunnelText();
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const hasRequested = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      const status = await getStableAuthStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus(getAuthStatus());
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshStatus();
      }
    });
    return () => subscription.remove();
  }, []);

  const effectiveStatus =
    authStatus === AuthorizationStatus.notDetermined && hasRequested.current
      ? AuthorizationStatus.denied
      : authStatus;

  useEffect(() => {
    if (!onAuthorizationChange) return;
    if (Platform.OS !== "ios") {
      onAuthorizationChange(true);
      return;
    }
    if (effectiveStatus == null) return;
    onAuthorizationChange(effectiveStatus === AuthorizationStatus.approved);
  }, [effectiveStatus]);

  useEffect(() => {
    if (!onAuthorizationStatusChange) return;
    if (Platform.OS !== "ios") {
      onAuthorizationStatusChange(AuthorizationStatus.approved);
      return;
    }
    if (effectiveStatus == null) return;
    onAuthorizationStatusChange(effectiveStatus);
  }, [effectiveStatus]);

  useEffect(() => {
    if (
      Platform.OS !== "ios" ||
      authStatus !== AuthorizationStatus.notDetermined ||
      hasRequested.current
    ) {
      return;
    }
    hasRequested.current = true;
    requestAuthorization()
      .then(() => refreshStatus())
      .catch(() => refreshStatus());
  }, [authStatus]);

  if (Platform.OS !== "ios") {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center font-sfPro text-textSecondary">
          Screen Time is only available on iOS.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center">
      <Animated.View
        entering={FadeInDown.delay(40)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className="rounded-2xl border border-outline bg-surface px-5 py-5"
      >
        <View className="flex-row items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary + "22" }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.primary}
            />
          </View>
          <View className="flex-1">
            <Text className="font-sfPro-semibold text-foreground">
              Turn on the Shield
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              {funnelText.onboarding.screenTimeShieldBody}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className="mt-5 gap-3"
      >
        {[
          funnelText.onboarding.screenTimeFirstBullet,
          "Reading on this screen unlocks your apps",
          "You stay in control — no hard lock",
        ].map((item) => (
          <View
            key={item}
            className="flex-row items-center gap-3 rounded-2xl border border-outline bg-backgroundElevated px-4 py-3"
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text className="flex-1 font-sfPro text-sm text-foreground">
              {item}
            </Text>
          </View>
        ))}
      </Animated.View>

    </View>
  );
}

export function canProceedScreenTime(): boolean {
  if (Platform.OS !== "ios") return true;
  return getAuthStatus() === AuthorizationStatus.approved;
}
