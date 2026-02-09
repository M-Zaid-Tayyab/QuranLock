import { StreakRow } from "@/components/home";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { colors } from "@/constants/colors";
import { getAuthStatus, requestAuthorization } from "@/services/deviceActivity";
import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

const AuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  approved: 2,
} as const;

export default function HomeScreen() {
  const router = useRouter();
  const [screenTimeStatus, setScreenTimeStatus] = useState<number | null>(null);
  const [notificationGranted, setNotificationGranted] = useState<
    boolean | null
  >(null);
  const [requestingScreenTime, setRequestingScreenTime] = useState(false);

  const name = useUserStore((s) => s.name);
  const hasSelectedApps = useUserStore((s) => s.hasSelectedApps);
  const { statuses } = useFocusScheduleStatus();

  const accumulatedMinutes = useBlockingStore(
    (s) => s.accumulatedQuranMinutesForCurrentBlock,
  );
  const getRequiredMinutes = useBlockingStore((s) => s.getRequiredMinutes);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    setScreenTimeStatus(getAuthStatus());
  }, []);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationGranted(status === "granted");
    });
  }, []);

  const handleRequestScreenTime = useCallback(() => {
    setRequestingScreenTime(true);
    requestAuthorization()
      .then(() => setScreenTimeStatus(getAuthStatus()))
      .finally(() => setRequestingScreenTime(false));
  }, []);

  const handleRequestNotifications = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationGranted(status === "granted");
  }, []);

  const needsScreenTime =
    Platform.OS === "ios" && screenTimeStatus !== AuthorizationStatus.approved;
  const needsNotifications = notificationGranted === false;

  const requiredMinutes = getRequiredMinutes();
  const hasPendingSchedules = statuses.some(
    (entry) => entry.status === "pending",
  );
  const isBlockingActive =
    hasPendingSchedules && requiredMinutes > 0 && accumulatedMinutes < requiredMinutes;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((requiredMinutes - accumulatedMinutes) * 60),
  );
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecondsPart = remainingSeconds % 60;
  const progress =
    requiredMinutes > 0 ? Math.min(accumulatedMinutes / requiredMinutes, 1) : 0;
  const streakCount = 0;

  const orderedSchedules = statuses;

  const formatTime = (hour: number, minute: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };

  return (
    <View className="flex-1 bg-background py-safe">
      <ScrollView
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-base font-sfPro text-muted">
              Assalamu alaykum warahmatullah
            </Text>
            <Text className="mt-1 text-4xl font-sfPro-bold text-foreground">
              {name.trim() ? name : "Friend"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            className="h-12 w-12 items-center justify-center rounded-full border border-outline bg-surface"
          >
            <Ionicons name="settings-outline" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <View
          className="mb-6 rounded-3xl border border-outline px-6 py-6"
          style={{ backgroundColor: colors.surface }}
        >
          <View className="items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.accent + "22" }}
            >
              <Ionicons name="alarm-outline" size={26} color={colors.accent} />
            </View>
            <Text className="mt-4 text-2xl font-sfPro-bold text-foreground">
              Time to Read
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              {isBlockingActive
                ? "Apps are paused until you complete Quran time"
                : "0/1 steps on your Qur’an journey today"}
            </Text>
          </View>

          <PrimaryButton
            title="Bismillah, Let's Read"
            onPress={() => router.push("/verse")}
            className="mt-5"
          />

          {isBlockingActive && (
            <View className="mt-5">
              <View className="h-2 rounded-full bg-backgroundElevated">
                <View
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </View>
              <Text className="mt-2 text-center text-xs font-sfPro text-muted">
                {Math.floor(accumulatedMinutes)} min done ·{" "}
                {remainingMinutes}:{remainingSecondsPart
                  .toString()
                  .padStart(2, "0")} left
              </Text>
            </View>
          )}
        </View>

        {(needsScreenTime || needsNotifications) && (
          <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
            <Text className="font-sfPro-semibold text-foreground">
              Permissions
            </Text>
            <View className="mt-4 gap-3">
              {needsScreenTime && (
                <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text className="font-sfPro text-sm text-foreground">
                      Screen Time access
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleRequestScreenTime}
                    className="rounded-full bg-primary/20 px-3 py-1.5"
                  >
                    <Text className="text-xs font-sfPro-semibold text-foreground">
                      {requestingScreenTime ? "…" : "Allow"}
                    </Text>
                  </Pressable>
                </View>
              )}
              {needsNotifications && (
                <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="notifications-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text className="font-sfPro text-sm text-foreground">
                      Notifications
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleRequestNotifications}
                    className="rounded-full bg-primary/20 px-3 py-1.5"
                  >
                    <Text className="text-xs font-sfPro-semibold text-foreground">
                      Enable
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {!hasSelectedApps && (
          <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.warning + "22" }}
              >
                <Ionicons
                  name="apps-outline"
                  size={22}
                  color={colors.warning}
                />
              </View>
              <View className="flex-1">
                <Text className="font-sfPro-semibold text-foreground">
                  Select apps to block
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  Choose the apps you want paused during focus time.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/settings")}
              className="mt-4 rounded-full bg-primary px-4 py-2"
            >
              <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
                Open settings
              </Text>
            </Pressable>
          </View>
        )}

        {hasSelectedApps && orderedSchedules.length === 0 && (
          <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.secondary + "22" }}
              >
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={colors.secondary}
                />
              </View>
              <View className="flex-1">
                <Text className="font-sfPro-semibold text-foreground">
                  Add focus times
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  Set prayer or custom times for the shield.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/onboarding",
                  params: { mode: "edit-times", from: "home" },
                })
              }
              className="mt-4 rounded-full bg-primary px-4 py-2"
            >
              <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
                Set times
              </Text>
            </Pressable>
          </View>
        )}

        {hasSelectedApps && orderedSchedules.length > 0 && !isBlockingActive && (
          <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
            <Text className="font-sfPro-semibold text-foreground">
              Focus times
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {orderedSchedules.map((entry) => (
                <View
                  key={entry.schedule.id}
                  className="rounded-full border border-outline bg-backgroundElevated px-3 py-2"
                >
                  <Text className="text-xs font-sfPro text-foreground">
                    {entry.schedule.label} ·{" "}
                    {formatTime(entry.schedule.hour, entry.schedule.minute)} ·{" "}
                    {entry.schedule.durationMinutes}m
                  </Text>
                  <Text
                    className={`mt-1 text-[10px] font-sfPro-semibold ${
                      entry.status === "pending"
                        ? "text-warning"
                        : entry.status === "completed"
                          ? "text-success"
                          : "text-muted"
                    }`}
                  >
                    {entry.status === "pending"
                      ? "Blocked now"
                      : entry.status === "completed"
                        ? "Completed"
                        : "Upcoming"}
                  </Text>
                </View>
              ))}
            </View>
            <View className="mt-4 flex-row items-center gap-3">
              <Ionicons name="apps-outline" size={18} color={colors.primary} />
              <Text className="text-sm font-sfPro text-foreground">
                Apps selected for blocking
              </Text>
            </View>
            <View className="mt-2 flex-row items-center gap-3">
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} />
              <Text className="text-sm font-sfPro text-foreground">
                Shield activates at your chosen times
              </Text>
            </View>
            <View className="mt-2 flex-row items-center gap-3">
              <Ionicons name="book-outline" size={18} color={colors.accent} />
              <Text className="text-sm font-sfPro text-foreground">
                Quran unlocks your apps
              </Text>
            </View>
          </View>
        )}

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-sfPro-semibold text-foreground">
            Connection With Allah
          </Text>
          <Text className="text-sm font-sfPro text-muted">0/30 days</Text>
        </View>
        <StreakRow />
      </ScrollView>
    </View>
  );
}
