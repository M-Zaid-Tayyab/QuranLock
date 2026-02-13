import { SelectAppsStep } from "@/components/onboarding";
import { setSelection } from "@/services/deviceActivity";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const [familyActivitySelection, setFamilyActivitySelection] = useState<
    string | null
  >(null);

  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const setHasSelectedApps = useUserStore((s) => s.setHasSelectedApps);
  const isPremium = useUserStore((s) => s.isPremium);

  const normalizeExternalUrl = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const privacyUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_PRIVACY_URL);
  const termsUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_TERMS_URL);
  const linkedInUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_LINKEDIN_URL);
  const instagramUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_INSTAGRAM_URL);
  const xUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_X_URL);

  const appVersion = Application.nativeApplicationVersion ?? "";
  const buildVersion = Application.nativeBuildVersion ?? "";
  const versionLabel =
    appVersion && buildVersion
      ? `${appVersion} (${buildVersion})`
      : appVersion || buildVersion || "—";

  const openLink = useCallback((url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  }, []);

  const handleSelectionChange = useCallback(
    (selection: string | null) => {
      setFamilyActivitySelection(selection);
      if (selection) {
        setSelection(selection);
        setHasSelectedApps(true);
      } else {
        setHasSelectedApps(false);
      }
    },
    [setHasSelectedApps],
  );

  const orderedSchedules = useMemo(
    () =>
      [...focusSchedules].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      ),
    [focusSchedules],
  );

  const formatTime = (hour: number, minute: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };

  return (
    <View className="flex-1 bg-background pt-safe">
      <View className="border-b border-border px-6 py-4">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
          >
            <Ionicons name="chevron-back" size={20} color="#94a3b8" />
          </Pressable>
          <Text className="text-xl font-sfPro-semibold text-foreground">
            Settings
          </Text>
          <View className="h-10 w-10" />
        </View>
      </View>
      <ScrollView
        className="flex-1 px-6 py-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-sfPro-semibold text-foreground">
                {isPremium ? "Premium active" : "Unlock Premium"}
              </Text>
              <Text className="mt-1 text-sm font-sfPro text-muted">
                {isPremium
                  ? "Thank you for supporting your Quran journey."
                  : "Start your trial and unlock deeper focus tools."}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/paywall")}
              className="self-start rounded-full bg-accent px-4 py-2"
            >
              <Text className="text-sm font-sfPro-semibold text-black">
                {isPremium ? "Manage" : "Upgrade"}
              </Text>
            </Pressable>
          </View>
        </View>
        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Focus times
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Prayer and custom times that trigger the shield.
          </Text>
          {orderedSchedules.length > 0 ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {orderedSchedules.map((schedule) => (
                <View
                  key={schedule.id}
                  className="rounded-full border border-outline bg-backgroundElevated px-3 py-2"
                >
                  <Text className="text-xs font-sfPro text-foreground">
                    {schedule.label} · {formatTime(schedule.hour, schedule.minute)} · {schedule.durationMinutes}m
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="mt-4 rounded-xl border border-dashed border-outline bg-backgroundElevated px-4 py-4">
              <Text className="text-sm font-sfPro text-muted">
                No focus times yet. Add prayer or custom times.
              </Text>
            </View>
          )}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/onboarding",
                params: { mode: "edit-times", from: "settings" },
              })
            }
            className="mt-4 rounded-full bg-primary px-4 py-2"
          >
            <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
              Edit focus times
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Blocked apps
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Choose which apps pause during focus time.
          </Text>
          <View className="mt-4">
            <SelectAppsStep
              familyActivitySelection={familyActivitySelection}
              onSelectionChange={handleSelectionChange}
              autoOpen={false}
            />
          </View>
        </View>

        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Connect with us
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Questions or feedback? Reach out anytime.
          </Text>
          <View className="mt-4 flex-row items-center gap-3">
            <Pressable
              onPress={() => openLink(linkedInUrl)}
              disabled={!linkedInUrl}
              className="h-11 w-11 items-center justify-center rounded-full border border-outline bg-backgroundElevated"
              style={!linkedInUrl ? { opacity: 0.5 } : undefined}
            >
              <Ionicons name="logo-linkedin" size={20} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={() => openLink(instagramUrl)}
              disabled={!instagramUrl}
              className="h-11 w-11 items-center justify-center rounded-full border border-outline bg-backgroundElevated"
              style={!instagramUrl ? { opacity: 0.5 } : undefined}
            >
              <Ionicons name="logo-instagram" size={20} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={() => openLink(xUrl)}
              disabled={!xUrl}
              className="h-11 w-11 items-center justify-center rounded-full border border-outline bg-backgroundElevated"
              style={!xUrl ? { opacity: 0.5 } : undefined}
            >
              <Ionicons name="logo-twitter" size={20} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <View className="rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">About</Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            QuranLock helps you replace distractions with daily remembrance.
          </Text>
          <View className="mt-4 gap-3">
            <Pressable
              onPress={() => openLink(privacyUrl)}
              disabled={!privacyUrl}
              className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
              style={!privacyUrl ? { opacity: 0.5 } : undefined}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="shield-outline" size={18} color="#94a3b8" />
                <Text className="font-sfPro text-sm text-foreground">
                  Privacy policy
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={() => openLink(termsUrl)}
              disabled={!termsUrl}
              className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
              style={!termsUrl ? { opacity: 0.5 } : undefined}
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="document-text-outline" size={18} color="#94a3b8" />
                <Text className="font-sfPro text-sm text-foreground">
                  Terms of service
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                <Text className="font-sfPro text-sm text-foreground">
                  App version
                </Text>
              </View>
              <Text className="text-xs font-sfPro text-muted">{versionLabel}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
