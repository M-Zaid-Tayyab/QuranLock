import {
  AnimatedTypingText,
  getTypingAnimationDuration,
} from "@/components/common";
import {
  ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS,
  ONBOARDING_CONTACT_BUTTON_STAGGER_MS,
  ONBOARDING_CONTACT_HIGHLIGHTED_WORDS,
  ONBOARDING_CONTACT_MESSAGE,
  ONBOARDING_CONTACT_TYPING_OPTIONS,
} from "@/configs/onboarding";
import { colors, rgba } from "@/constants/colors";
import {
  buildFeedbackMessage,
  buildFeedbackWhatsAppUrl,
  getFeedbackInstagramUrl,
  getFeedbackSupportCode,
  getFeedbackTikTokUrl,
  getFeedbackWhatsAppNumber,
  getFeedbackXUrl,
  type FeedbackContactChannel,
  type FeedbackContactSource,
} from "@/services";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";

interface FeedbackContactCardProps {
  source: FeedbackContactSource;
}

interface ContactChannelButtonProps {
  activeChannel: FeedbackContactChannel | null;
  channel: FeedbackContactChannel;
  color: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => Promise<void>;
  variant: "compact" | "onboarding";
}

interface ContactChoicesProps {
  activeChannel: FeedbackContactChannel | null;
  onInstagram: () => Promise<void>;
  onTikTok: () => Promise<void>;
  onTwitter: () => Promise<void>;
  onWhatsApp: () => Promise<void>;
  variant: "compact" | "onboarding";
}

const WHATSAPP_COLOR = "#25D366";
const INSTAGRAM_COLOR = "#E1306C";
const TIKTOK_COLOR = "#69C9D0";
const TWITTER_COLOR = "#1D9BF0";

const contactTypingDurationMs = getTypingAnimationDuration(
  ONBOARDING_CONTACT_MESSAGE,
  ONBOARDING_CONTACT_TYPING_OPTIONS,
);

const ContactChannelButton = ({
  activeChannel,
  channel,
  color,
  icon,
  label,
  onPress,
  variant,
}: ContactChannelButtonProps) => {
  const isActive = activeChannel === channel;
  const isDisabled = activeChannel !== null;
  const isOnboarding = variant === "onboarding";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={isOnboarding ? undefined : `Message on ${label}`}
      className={
        isOnboarding
          ? "min-h-16 w-full flex-row items-center justify-center rounded-2xl border px-4 py-3"
          : "h-10 w-10 items-center justify-center rounded-full border"
      }
      style={({ pressed }) => ({
        borderColor: rgba(color, pressed ? 0.72 : 0.42),
        backgroundColor: rgba(color, pressed ? 0.2 : 0.1),
        opacity: isDisabled && !isActive ? 0.48 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        className={
          isOnboarding
            ? "h-10 w-10 items-center justify-center rounded-full"
            : "items-center justify-center"
        }
        style={
          isOnboarding ? { backgroundColor: rgba(color, 0.16) } : undefined
        }
      >
        {isActive ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon} size={isOnboarding ? 22 : 20} color={color} />
        )}
      </View>
      {isOnboarding ? (
        <>
          <View className="ml-3 flex-1">
            <Text
              className="font-sfPro-semibold text-base text-foreground"
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text className="mt-0.5 font-sfPro text-xs text-muted">
              Tap to share feedback
            </Text>
          </View>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={23}
            color={color}
          />
        </>
      ) : null}
    </Pressable>
  );
};

const ContactChoices = ({
  activeChannel,
  onInstagram,
  onTikTok,
  onTwitter,
  onWhatsApp,
  variant,
}: ContactChoicesProps) => {
  const isOnboarding = variant === "onboarding";
  const animatedButton = (button: ReactNode, index: number) => {
    if (!isOnboarding) return button;

    return (
      <Animated.View
        entering={FadeInDown.delay(
          contactTypingDurationMs +
            index * ONBOARDING_CONTACT_BUTTON_STAGGER_MS,
        )
          .duration(ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS)
          .easing(Easing.out(Easing.cubic))}
        className="w-full"
      >
        {button}
      </Animated.View>
    );
  };

  return (
    <View className={isOnboarding ? "mt-8 gap-3" : "flex-row gap-2"}>
      {animatedButton(
        <ContactChannelButton
          activeChannel={activeChannel}
          channel="whatsapp"
          color={WHATSAPP_COLOR}
          icon="logo-whatsapp"
          label="WhatsApp"
          onPress={onWhatsApp}
          variant={variant}
        />,
        0,
      )}
      {animatedButton(
        <ContactChannelButton
          activeChannel={activeChannel}
          channel="instagram"
          color={INSTAGRAM_COLOR}
          icon="logo-instagram"
          label="Instagram"
          onPress={onInstagram}
          variant={variant}
        />,
        1,
      )}
      {animatedButton(
        <ContactChannelButton
          activeChannel={activeChannel}
          channel="tiktok"
          color={TIKTOK_COLOR}
          icon="logo-tiktok"
          label="TikTok"
          onPress={onTikTok}
          variant={variant}
        />,
        2,
      )}
      {isOnboarding &&
        animatedButton(
          <ContactChannelButton
            activeChannel={activeChannel}
            channel="twitter"
            color={TWITTER_COLOR}
            icon="logo-twitter"
            label="X (Twitter)"
            onPress={onTwitter}
            variant={variant}
          />,
          3,
        )}
    </View>
  );
};

export const FeedbackContactCard = ({ source }: FeedbackContactCardProps) => {
  const appUserId = useUserStore((state) => state.appUserId);
  const [activeChannel, setActiveChannel] =
    useState<FeedbackContactChannel | null>(null);

  const prepareMessage = async () => {
    const supportCode = await getFeedbackSupportCode(appUserId);
    return buildFeedbackMessage(source, supportCode ?? undefined);
  };

  const handleWhatsApp = async () => {
    const phoneNumber = getFeedbackWhatsAppNumber();
    if (!phoneNumber) {
      Alert.alert(
        "WhatsApp unavailable",
        "The WhatsApp contact number is not configured yet.",
      );
      return;
    }

    setActiveChannel("whatsapp");
    const message = await prepareMessage();
    const url = buildFeedbackWhatsAppUrl(phoneNumber, message);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open WhatsApp", "Please try again in a moment.");
    } finally {
      setActiveChannel(null);
    }
  };

  const handleCopiedMessageChannel = async (
    channel: "instagram" | "tiktok" | "twitter",
    platformName: "Instagram" | "TikTok" | "X",
    url: string,
  ) => {
    if (!url) {
      Alert.alert(
        `${platformName} unavailable`,
        `The ${platformName} contact link is not configured yet.`,
      );
      return;
    }

    setActiveChannel(channel);
    const message = await prepareMessage();
    try {
      await Clipboard.setStringAsync(message);
      Alert.alert(
        "Message copied",
        `${platformName} will open next. Paste the message into the chat so I can connect it to your QuranLock account.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Open ${platformName}`,
            onPress: async () => {
              try {
                await Linking.openURL(url);
              } catch {
                Alert.alert(
                  `Unable to open ${platformName}`,
                  "Please try again in a moment.",
                );
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert("Unable to copy message", "Please try again in a moment.");
    } finally {
      setActiveChannel(null);
    }
  };

  const handleInstagram = async () => {
    await handleCopiedMessageChannel(
      "instagram",
      "Instagram",
      getFeedbackInstagramUrl(),
    );
  };

  const handleTikTok = async () => {
    await handleCopiedMessageChannel(
      "tiktok",
      "TikTok",
      getFeedbackTikTokUrl(),
    );
  };

  const handleTwitter = async () => {
    await handleCopiedMessageChannel("twitter", "X", getFeedbackXUrl());
  };

  const choices = (
    <ContactChoices
      activeChannel={activeChannel}
      onInstagram={handleInstagram}
      onTikTok={handleTikTok}
      onTwitter={handleTwitter}
      onWhatsApp={handleWhatsApp}
      variant={source === "onboarding" ? "onboarding" : "compact"}
    />
  );

  if (source === "onboarding") {
    return (
      <View className="flex-1 justify-center pb-2 pt-12">
        <View
          pointerEvents="none"
          className="absolute -right-20 top-4 h-48 w-48 rounded-full"
          style={{ backgroundColor: rgba(colors.primaryVariant, 0.055) }}
        />

        <View className="mb-5 flex-row items-center gap-2 self-start rounded-full border border-outline px-3 py-1.5">
          <View
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: rgba(colors.accent, 0.16) }}
          >
            <Ionicons name="heart-outline" size={14} color={colors.accent} />
          </View>
          <Text className="font-sfPro-semibold text-xs tracking-[1.6px] text-accent">
            A NOTE FROM ZAID
          </Text>
        </View>

        <AnimatedTypingText
          text={ONBOARDING_CONTACT_MESSAGE}
          highlightedWords={ONBOARDING_CONTACT_HIGHLIGHTED_WORDS}
          defaultColor={colors.foreground}
          highlightColor={colors.primaryVariant}
          textClassName="text-[26px] font-sfPro-bold leading-[34px]"
          textStyle={{ letterSpacing: 0.15 }}
          enableWordHaptics
          keyPrefix="onboarding-contact"
          {...ONBOARDING_CONTACT_TYPING_OPTIONS}
        />

        <Animated.View
          entering={FadeInDown.delay(contactTypingDurationMs - 80)
            .duration(ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS)
            .easing(Easing.out(Easing.cubic))}
          className="mb-3 mt-6 flex-row items-center justify-between"
        >
          <Text className="font-sfPro-semibold text-sm tracking-[1.4px] text-muted">
            MESSAGE ME ON
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full bg-primary" />
            <Text className="font-sfPro text-sm text-muted">
              I personally reply
            </Text>
          </View>
        </Animated.View>

        {choices}
      </View>
    );
  }

  return (
    <View
      className={`rounded-2xl border px-4 py-3 ${source === "home" ? "mb-6" : ""}`}
      style={{
        borderColor: rgba(colors.primaryVariant, 0.34),
        backgroundColor: rgba(colors.surface, 0.96),
      }}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-sfPro-semibold text-sm text-foreground">
            {source === "home" ? "Something feel off?" : "Not sure yet?"}
          </Text>
          <Text className="mt-0.5 font-sfPro text-xs text-muted">
            {source === "home"
              ? "Tell me what you’d change"
              : "Shoot a DM to claim a free week"}
          </Text>
        </View>
        {choices}
      </View>
    </View>
  );
};
