import { colors } from "@/constants/colors";
import { getAuthStatus, requestAuthorization } from "@/services/deviceActivity";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";

const AuthorizationStatus = { notDetermined: 0, denied: 1, approved: 2 } as const;

export function ScreenTimeStep() {
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [requesting, setRequesting] = useState(false);
  const hasRequested = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    setAuthStatus(getAuthStatus());
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (authStatus !== AuthorizationStatus.notDetermined) return;
    if (hasRequested.current) return;
    hasRequested.current = true;
    setRequesting(true);
    requestAuthorization()
      .then(() => setAuthStatus(getAuthStatus()))
      .catch(() => setAuthStatus(getAuthStatus()))
      .finally(() => setRequesting(false));
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

  const statusLabel =
    authStatus === AuthorizationStatus.approved
      ? "Allowed"
      : authStatus === AuthorizationStatus.denied
        ? "Denied"
        : requesting
          ? "Requesting…"
          : "Not determined";

  const statusColor =
    authStatus === AuthorizationStatus.approved
      ? colors.success
      : authStatus === AuthorizationStatus.denied
        ? colors.error
        : colors.warning;

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
              Screen Time powers a gentle shield. When it appears, open
              QuranLock and read to unlock your apps.
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
          "Shield appears only in your scheduled focus times",
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

      <Animated.View
        entering={FadeInDown.delay(200)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className="mt-5 rounded-2xl border border-outline bg-surface px-4 py-4"
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-sfPro text-sm text-muted">Permission</Text>
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: statusColor + "22" }}
          >
            <Text
              className="text-xs font-sfPro-semibold"
              style={{ color: statusColor }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
        {authStatus === AuthorizationStatus.denied && (
          <Text className="mt-3 text-sm font-sfPro text-muted">
            Enable Screen Time in Settings → Screen Time to continue.
          </Text>
        )}
        {requesting && (
          <View className="mt-3 flex-row items-center gap-2">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm font-sfPro text-muted">
              Waiting for permission prompt…
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

export function canProceedScreenTime(): boolean {
  if (Platform.OS !== "ios") return true;
  return getAuthStatus() === AuthorizationStatus.approved;
}
