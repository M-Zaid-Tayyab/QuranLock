import { SettingsSelectAppsStep } from "@/components/onboarding";
import { colors, rgba } from "@/constants/colors";
import {
  canOpenStoreReviewPage,
  canShareApp,
  openStoreReviewPage,
  shareApp,
} from "@/services/appFeedback";
import {
  clearSelection,
  SCREEN_TIME,
  stopMonitoring,
  unblockApps,
} from "@/services/deviceActivity";
import { ensureCanEditFocusTimes } from "@/services/entitlements";
import {
  buildFeedbackMessage,
  buildFeedbackWhatsAppUrl,
  getFeedbackSupportCode,
  getFeedbackWhatsAppNumber,
} from "@/services/feedbackContact";
import { resetAllStores } from "@/store";
import { useUserStore } from "@/store/user";
import { DEFAULT_GOAL_DAYS, sanitizeGoalDays } from "@/utils/focusPlan";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useShallow } from "zustand/react/shallow";

const CONTACT_COLORS = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  tiktok: "#69C9D0",
  linkedin: "#0A66C2",
  twitter: "#1D9BF0",
} as const;

interface ContactIconButtonProps {
  color: string;
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  loading: boolean;
  onPress: () => void;
}

const ContactIconButton = ({
  color,
  disabled,
  icon,
  loading,
  onPress,
}: ContactIconButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    className="h-11 w-11 items-center justify-center rounded-full border"
    style={({ pressed }) => ({
      borderColor: rgba(color, 0.42),
      backgroundColor: rgba(color, pressed ? 0.2 : 0.1),
      opacity: disabled ? 0.5 : 1,
      transform: [{ scale: pressed ? 0.97 : 1 }],
    })}
  >
    {loading ? (
      <ActivityIndicator size="small" color={color} />
    ) : (
      <Ionicons name={icon} size={20} color={color} />
    )}
  </Pressable>
);

type SettingsContactChannel =
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "twitter";

export default function SettingsScreen() {
  const router = useRouter();

  const {
    focusSchedules,
    appUserId,
    focusDurationMode,
    focusCompletionDays,
    blockAllApps,
    familyActivitySelection,
    setHasSelectedApps,
    setBlockAllApps,
    setFamilyActivitySelection,
    isPremium,
  } = useUserStore(
    useShallow((s) => ({
      focusSchedules: s.focusSchedules,
      appUserId: s.appUserId,
      focusDurationMode: s.focusDurationMode,
      focusCompletionDays: s.focusCompletionDays,
      blockAllApps: s.blockAllApps,
      familyActivitySelection: s.familyActivitySelection,
      setHasSelectedApps: s.setHasSelectedApps,
      setBlockAllApps: s.setBlockAllApps,
      setFamilyActivitySelection: s.setFamilyActivitySelection,
      isPremium: s.isPremium,
    })),
  );

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
  const linkedInUrl = normalizeExternalUrl(
    process.env.EXPO_PUBLIC_LINKEDIN_URL,
  );
  const instagramUrl = normalizeExternalUrl(
    process.env.EXPO_PUBLIC_INSTAGRAM_URL,
  );
  const whatsappUrl = normalizeExternalUrl(
    process.env.EXPO_PUBLIC_WHATSAPP_URL,
  );
  const tiktokUrl = normalizeExternalUrl(
    process.env.EXPO_PUBLIC_TIKTOK_URL,
  );
  const xUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_X_URL);
  const reviewEnabled = canOpenStoreReviewPage();
  const shareEnabled = canShareApp();
  const [activeContactChannel, setActiveContactChannel] =
    useState<SettingsContactChannel | null>(null);
  const {
    data: supportCode = null,
    isLoading: supportCodeLoading,
    refetch: refetchSupportCode,
  } = useQuery({
    queryKey: ["feedbackSupportCode", appUserId],
    queryFn: async () => {
      const code = await getFeedbackSupportCode(appUserId);
      if (!code) {
        throw new Error("Unable to load support code");
      }
      return code;
    },
    enabled: Boolean(appUserId),
    retry: 2,
    staleTime: Infinity,
  });

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

  const prepareSettingsFeedbackMessage = async () => {
    const refreshedCode = supportCode
      ? supportCode
      : (await refetchSupportCode()).data;
    const code = refreshedCode ?? null;
    if (!code) {
      Alert.alert(
        "Support code unavailable",
        "Please check your connection and try again.",
      );
      return null;
    }
    return buildFeedbackMessage("settings", code);
  };

  const handleCopySupportCode = async () => {
    if (!supportCode) return;
    try {
      await Clipboard.setStringAsync(supportCode);
      Alert.alert("Support code copied", supportCode);
    } catch {
      Alert.alert("Unable to copy", "Please try again in a moment.");
    }
  };

  const handleWhatsAppContact = async () => {
    const phoneNumber = getFeedbackWhatsAppNumber();
    if (!phoneNumber) {
      Alert.alert(
        "WhatsApp unavailable",
        "The WhatsApp contact number is not configured yet.",
      );
      return;
    }

    setActiveContactChannel("whatsapp");
    try {
      const message = await prepareSettingsFeedbackMessage();
      if (!message) return;
      await Linking.openURL(buildFeedbackWhatsAppUrl(phoneNumber, message));
    } catch {
      Alert.alert("Unable to open WhatsApp", "Please try again in a moment.");
    } finally {
      setActiveContactChannel(null);
    }
  };

  const handleCopiedContact = async (
    channel: Exclude<SettingsContactChannel, "whatsapp">,
    platformName: string,
    url: string,
  ) => {
    if (!url) {
      Alert.alert(
        `${platformName} unavailable`,
        `The ${platformName} contact link is not configured yet.`,
      );
      return;
    }

    setActiveContactChannel(channel);
    try {
      const message = await prepareSettingsFeedbackMessage();
      if (!message) return;
      await Clipboard.setStringAsync(message);
      Alert.alert(
        "Message copied",
        `${platformName} will open next. Paste the message into the chat so I can connect it to your QuranLock account.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Open ${platformName}`,
            onPress: () => openLink(url),
          },
        ],
      );
    } catch {
      Alert.alert("Unable to copy message", "Please try again in a moment.");
    } finally {
      setActiveContactChannel(null);
    }
  };

  const handleOpenReview = useCallback(() => {
    void openStoreReviewPage();
  }, []);

  const handleShareApp = useCallback(() => {
    void shareApp();
  }, []);

  const [familyActivitySelectionDraft, setFamilyActivitySelectionDraft] =
    useState<string | null>(() => familyActivitySelection);

  useEffect(() => {
    setFamilyActivitySelectionDraft(familyActivitySelection);
  }, [familyActivitySelection]);

  const handleSelectionChange = useCallback((selection: string | null) => {
    setFamilyActivitySelectionDraft(selection);
  }, []);

  const handleSelectionOpen = useCallback(() => {
    setFamilyActivitySelectionDraft(familyActivitySelection);
  }, [familyActivitySelection]);

  const handleSelectionDismiss = useCallback(() => {
    const savedSelection = useUserStore.getState().familyActivitySelection;
    setFamilyActivitySelectionDraft(savedSelection);
    if (savedSelection == null) {
      setBlockAllApps(true);
      setHasSelectedApps(true);
    }
  }, [setBlockAllApps, setHasSelectedApps]);

  const handleBlockAllAppsChange = useCallback(
    (nextBlockAllApps: boolean) => {
      setBlockAllApps(nextBlockAllApps);
      setHasSelectedApps(
        nextBlockAllApps || familyActivitySelection != null,
      );
    },
    [familyActivitySelection, setBlockAllApps, setHasSelectedApps],
  );

  const handleSelectionDone = useCallback(() => {
    setFamilyActivitySelection(familyActivitySelectionDraft);
    setHasSelectedApps(true);
    setBlockAllApps(familyActivitySelectionDraft == null);
  }, [
    familyActivitySelectionDraft,
    setFamilyActivitySelection,
    setHasSelectedApps,
    setBlockAllApps,
  ]);

  const orderedSchedules = useMemo(
    () =>
      [...focusSchedules].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      ),
    [focusSchedules],
  );
  const goalCompletionTarget = useMemo(
    () => sanitizeGoalDays(focusCompletionDays ?? DEFAULT_GOAL_DAYS),
    [focusCompletionDays],
  );

  const handleEditFocusTimes = useCallback(() => {
    if (!ensureCanEditFocusTimes(router, { isPremium })) {
      return;
    }
    router.push({
      pathname: "/onboarding",
      params: { mode: "edit-times", from: "settings" },
    });
  }, [isPremium, router]);

  const handleLogout = useCallback(() => {
    if (Platform.OS === "ios") {
      const activityNames = [
        SCREEN_TIME.ACTIVITY_NAME,
        ...focusSchedules.map(
          (schedule) => `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`,
        ),
      ];
      stopMonitoring(Array.from(new Set(activityNames)));
      unblockApps(blockAllApps);
      clearSelection();
    }

    resetAllStores();
    router.replace("/welcome");
  }, [blockAllApps, focusSchedules, router]);

  const formatTime = (hour: number, minute: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };

  const appSelectionSummary = useMemo(() => {
    if (familyActivitySelectionDraft !== familyActivitySelection) {
      return "Unsaved changes";
    }
    return familyActivitySelectionDraft == null
      ? "No apps selected yet"
      : "Your apps are selected";
  }, [familyActivitySelection, familyActivitySelectionDraft]);

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
                  : "Upgrade to Premium and unlock deeper focus tools."}
              </Text>
            </View>
            {isPremium ? (
              <View className="self-start rounded-full bg-accent/15 px-4 py-2">
                <Text className="text-sm font-sfPro-semibold text-accent">
                  Active
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => router.push("/paywall")}
                className="self-start rounded-full bg-accent px-4 py-2"
              >
                <Text className="text-sm font-sfPro-semibold text-black">
                  Upgrade
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Focus times
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Prayer and custom times that trigger the shield.
          </Text>
          <View className="mt-3 rounded-xl border border-outline bg-backgroundElevated px-3 py-2">
            <Text className="text-xs font-sfPro text-muted">
              Mode:{" "}
              <Text className="font-sfPro-semibold text-foreground">
                {focusDurationMode === "goal" ? "Goal mode" : "Manual mode"}
              </Text>
            </Text>
            {focusDurationMode === "goal" ? (
              <Text className="mt-1 text-xs font-sfPro text-muted">
                Completion target:{" "}
                <Text className="font-sfPro-semibold text-foreground">
                  {goalCompletionTarget} days
                </Text>
              </Text>
            ) : null}
          </View>
          {orderedSchedules.length > 0 ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {orderedSchedules.map((schedule) => (
                <View
                  key={schedule.id}
                  className="rounded-full border border-outline bg-backgroundElevated px-3 py-2"
                >
                  <Text className="text-xs font-sfPro text-foreground">
                    {schedule.label} ·{" "}
                    {formatTime(schedule.hour, schedule.minute)} ·{" "}
                    {schedule.durationMinutes}m
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
            onPress={handleEditFocusTimes}
            className="mt-4 rounded-full bg-primary px-4 py-3"
          >
            <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
              Edit focus times
            </Text>
          </Pressable>
        </View>

        <View className="mb-6 rounded-2xl border border-outline bg-surface px-4 py-4">
          <Text className="text-sm font-sfPro-semibold text-foreground">
            Blocked apps
          </Text>
          <Text className="mt-0.5 text-xs font-sfPro text-muted">
            Choose what pauses during focus time.
          </Text>
          <View className="mt-3">
            <SettingsSelectAppsStep
              blockAllApps={blockAllApps}
              onBlockAllAppsChange={handleBlockAllAppsChange}
              familyActivitySelection={familyActivitySelectionDraft}
              selectionSummary={appSelectionSummary}
              onSelectionChange={handleSelectionChange}
              onSelectionDone={handleSelectionDone}
              onDismiss={handleSelectionDismiss}
              onOpenPicker={handleSelectionOpen}
            />
          </View>
        </View>

        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Contact us
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Want to talk to us directly? Reach out anytime.
          </Text>
          <View className="mt-4 flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-3 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-[10px] font-sfPro-semibold tracking-widest text-muted">
                YOUR SUPPORT CODE
              </Text>
              {supportCodeLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  className="mt-1 self-start"
                />
              ) : (
                <Text className="mt-1 text-base font-sfPro-bold tracking-widest text-foreground">
                  {supportCode ?? "Unavailable"}
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleCopySupportCode}
              disabled={!supportCode}
              className="flex-row items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-2"
              style={!supportCode ? { opacity: 0.5 } : undefined}
            >
              <Ionicons name="copy-outline" size={15} color={colors.primary} />
              <Text className="text-xs font-sfPro-semibold text-primary">
                Copy
              </Text>
            </Pressable>
          </View>
          <View className="mt-4 flex-row items-center justify-between">
            <ContactIconButton
              color={CONTACT_COLORS.whatsapp}
              disabled={!whatsappUrl || activeContactChannel !== null}
              icon="logo-whatsapp"
              loading={activeContactChannel === "whatsapp"}
              onPress={handleWhatsAppContact}
            />
            <ContactIconButton
              color={CONTACT_COLORS.instagram}
              disabled={!instagramUrl || activeContactChannel !== null}
              icon="logo-instagram"
              loading={activeContactChannel === "instagram"}
              onPress={() =>
                handleCopiedContact("instagram", "Instagram", instagramUrl)
              }
            />
            <ContactIconButton
              color={CONTACT_COLORS.tiktok}
              disabled={!tiktokUrl || activeContactChannel !== null}
              icon="logo-tiktok"
              loading={activeContactChannel === "tiktok"}
              onPress={() =>
                handleCopiedContact("tiktok", "TikTok", tiktokUrl)
              }
            />
            <ContactIconButton
              color={CONTACT_COLORS.linkedin}
              disabled={!linkedInUrl || activeContactChannel !== null}
              icon="logo-linkedin"
              loading={activeContactChannel === "linkedin"}
              onPress={() =>
                handleCopiedContact("linkedin", "LinkedIn", linkedInUrl)
              }
            />
            <ContactIconButton
              color={CONTACT_COLORS.twitter}
              disabled={!xUrl || activeContactChannel !== null}
              icon="logo-twitter"
              loading={activeContactChannel === "twitter"}
              onPress={() => handleCopiedContact("twitter", "X", xUrl)}
            />
          </View>
        </View>

        <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
          <Text className="font-sfPro-semibold text-foreground">
            Support QuranLock
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Enjoying the app? You can leave a review or share it with someone
            else.
          </Text>
          <View className="mt-4 gap-3">
            <Pressable
              onPress={handleOpenReview}
              disabled={!reviewEnabled}
              className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
              style={!reviewEnabled ? { opacity: 0.5 } : undefined}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: rgba(colors.accent, 0.14) }}
                >
                  <Ionicons
                    name="star-outline"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <Text className="font-sfPro text-sm text-foreground">
                  Give a review
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={handleShareApp}
              disabled={!shareEnabled}
              className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
              style={!shareEnabled ? { opacity: 0.5 } : undefined}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: rgba(colors.primary, 0.14) }}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text className="font-sfPro text-sm text-foreground">
                  Share the app
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
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
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#94a3b8"
                />
                <Text className="font-sfPro text-sm text-foreground">
                  Terms of service
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#94a3b8"
                />
                <Text className="font-sfPro text-sm text-foreground">
                  App version
                </Text>
              </View>
              <Text className="text-xs font-sfPro text-muted">
                {versionLabel}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleLogout}
          className="mt-6 mb-4 rounded-full border border-error bg-backgroundElevated px-4 py-3"
        >
          <Text className="text-center text-sm font-sfPro-semibold text-error">
            Logout
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
