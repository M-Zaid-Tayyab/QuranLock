import { BottomSheetModal, PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { NativeSyntheticEvent } from "react-native";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { DeviceActivitySelectionEvent } from "react-native-device-activity";
import { DeviceActivitySelectionView } from "react-native-device-activity";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";

const AUTO_OPEN_DELAY_MS = 450;
const CARD_ENTER_DELAY_MS = 60;
const CARD_ENTER_STAGGER_MS = 90;
const CARD_ENTER_DURATION_MS = 260;
const PRESSED_SCALE = 0.985;
const PRESSED_OPACITY = 0.9;
const PICKER_HEIGHT = 420;
const DETAIL_ENTER_DELAY_MS = 240;
const DETAIL_ROW_STAGGER_MS = 70;

const RECOMMENDED_BADGE = "RECOMMENDED";
const QUIET_MODE_TITLE = "A calm phone";
const QUIET_MODE_DESCRIPTION = "Every app rests while you read.";
const CUSTOM_MODE_TITLE = "Pick specific apps";
const CUSTOM_MODE_DESCRIPTION = "Choose only the apps that pull you away.";

interface SelectAppsStepProps {
  blockAllApps: boolean;
  familyActivitySelection: string | null;
  onBlockAllAppsChange: (blockAllApps: boolean) => void;
  onSelectionChange: (selection: string | null) => void;
  onSelectionDone?: () => void | Promise<void>;
  autoOpen?: boolean;
}

interface SettingsSelectAppsStepProps {
  blockAllApps: boolean;
  familyActivitySelection: string | null;
  selectionSummary?: string;
  onBlockAllAppsChange: (blockAllApps: boolean) => void;
  onSelectionChange: (selection: string | null) => void;
  onSelectionDone?: () => void | Promise<void>;
  onDismiss?: () => void;
  onOpenPicker?: () => void;
}

interface ChoiceCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
  selected: boolean;
  nested?: boolean;
  enterDelayMs: number;
  onPress: () => void;
  children?: ReactNode;
}

interface AppScopeChoicesProps {
  blockAllApps: boolean;
  nested?: boolean;
  familyActivitySelection: string | null;
  selectionSummary?: string;
  onSelectQuiet: () => void;
  onSelectCustom: () => void;
  onOpenPicker: () => void;
}

interface FocusPreviewRow {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface FocusPreviewProps {
  blockAllApps: boolean;
}

interface AppsPickerSheetProps {
  familyActivitySelection: string | null;
  onSelectionChange: (selection: string | null) => void;
  onSelectionDone?: () => void | Promise<void>;
  onDismiss?: () => void;
  doneLabel: string;
  sheetRef: RefObject<GorhomBottomSheetModal | null>;
}

const useAppsPickerAutoOpen = (
  sheetRef: RefObject<GorhomBottomSheetModal | null>,
  autoOpen: boolean,
) => {
  const openedOnce = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios" || !autoOpen || openedOnce.current) return;
    openedOnce.current = true;
    const timer = setTimeout(() => {
      sheetRef.current?.present();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoOpen, sheetRef]);
};

const ChoiceCard = ({
  icon,
  title,
  description,
  badge,
  selected,
  nested = false,
  enterDelayMs,
  onPress,
  children,
}: ChoiceCardProps) => (
  <Animated.View
    entering={FadeInDown.delay(enterDelayMs)
      .duration(CARD_ENTER_DURATION_MS)
      .easing(Easing.out(Easing.cubic))}
  >
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? PRESSED_SCALE : 1 }],
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}
      className={`${nested ? "rounded-xl border px-3 py-3" : "rounded-2xl border-2 px-4 py-5"} ${
        selected
          ? "border-primary bg-primaryContainer"
          : `border-outline ${nested ? "bg-backgroundElevated" : "bg-surface"}`
      }`}
    >
      <View className="flex-row items-center">
        <View
          className={`${nested ? "h-9 w-9 rounded-xl" : "h-12 w-12 rounded-2xl"} items-center justify-center ${
            selected
              ? "bg-primary"
              : nested
                ? "bg-surface"
                : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name={icon}
            size={nested ? 18 : 24}
            color={selected ? colors.white : colors.primary}
          />
        </View>

        <View className={`${nested ? "ml-2" : "ml-3"} flex-1`}>
          <Text
            className={`${nested ? "text-sm" : "text-lg"} font-sfPro-semibold text-foreground`}
          >
            {title}
          </Text>
          <Text
            className={`${nested ? "mt-0.5 text-xs" : "mt-1 text-sm"} font-sfPro ${
              selected ? "text-foreground/70" : "text-muted"
            }`}
          >
            {description}
          </Text>
        </View>

        <View
          className={`${nested ? "ml-2 h-5 w-5 border" : "ml-3 h-6 w-6 border-2"} items-center justify-center rounded-full ${
            selected ? "border-primary bg-primary" : "border-outline"
          }`}
        >
          {selected ? (
            <Ionicons name="checkmark" size={nested ? 11 : 14} color={colors.white} />
          ) : null}
        </View>
      </View>

      {children}
    </Pressable>

    {badge ? (
      <View
        className="absolute -top-2 left-4 rounded-full px-2.5 py-0.5"
        style={{ backgroundColor: colors.accent }}
      >
        <Text
          className="text-[10px] font-sfPro-semibold tracking-widest"
          style={{ color: colors.background }}
        >
          {badge}
        </Text>
      </View>
    ) : null}
  </Animated.View>
);

const AppScopeChoices = ({
  blockAllApps,
  nested = false,
  familyActivitySelection,
  selectionSummary,
  onSelectQuiet,
  onSelectCustom,
  onOpenPicker,
}: AppScopeChoicesProps) => (
  <View className={nested ? "gap-2" : "gap-3"}>
    <ChoiceCard
      icon={blockAllApps ? "shield-checkmark" : "shield-checkmark-outline"}
      title={QUIET_MODE_TITLE}
      description={QUIET_MODE_DESCRIPTION}
      badge={nested ? undefined : RECOMMENDED_BADGE}
      selected={blockAllApps}
      nested={nested}
      enterDelayMs={CARD_ENTER_DELAY_MS}
      onPress={onSelectQuiet}
    />

    <ChoiceCard
      icon="apps-outline"
      title={CUSTOM_MODE_TITLE}
      description={CUSTOM_MODE_DESCRIPTION}
      selected={!blockAllApps}
      nested={nested}
      enterDelayMs={CARD_ENTER_DELAY_MS + CARD_ENTER_STAGGER_MS}
      onPress={onSelectCustom}
    >
      {!blockAllApps ? (
        <Animated.View
          entering={FadeIn.duration(CARD_ENTER_DURATION_MS)}
          className={`${nested ? "mt-3 pt-2" : "mt-4 pt-3"} border-t border-primary/30`}
        >
          <Pressable
            onPress={onOpenPicker}
            className="flex-row items-center justify-between"
            style={({ pressed }) => ({
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}
          >
            <View className="flex-1 flex-row items-center gap-2">
              <Ionicons
                name={
                  familyActivitySelection
                    ? "checkmark-circle"
                    : "add-circle-outline"
                }
                size={nested ? 15 : 18}
                color={familyActivitySelection ? colors.success : colors.primary}
              />
              <Text
                className={`flex-1 ${nested ? "text-xs" : "text-sm"} font-sfPro text-foreground`}
              >
                {selectionSummary ??
                  (familyActivitySelection
                    ? "Your apps are selected"
                    : "No apps selected yet")}
              </Text>
            </View>
            <Text
              className={`${nested ? "text-xs" : "text-sm"} font-sfPro-semibold text-primaryVariant`}
            >
              {familyActivitySelection ? "Edit" : "Select"}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ChoiceCard>
  </View>
);

const FocusPreview = ({ blockAllApps }: FocusPreviewProps) => {
  const rows: FocusPreviewRow[] = [
    {
      icon: "shield-checkmark-outline",
      text: blockAllApps
        ? "Every app is shielded while your session runs"
        : "Only the apps you pick are shielded",
    },
    {
      icon: "book-outline",
      text: "Opening one brings you back to the Quran",
    },
    {
      icon: "lock-open-outline",
      text: "Everything unlocks the moment your session ends",
    },
  ];

  return (
    <View className="mt-8">
      <Animated.Text
        entering={FadeInDown.delay(DETAIL_ENTER_DELAY_MS).duration(
          CARD_ENTER_DURATION_MS,
        )}
        className="text-xs font-sfPro-semibold tracking-widest text-muted"
      >
        WHAT HAPPENS IN FOCUS
      </Animated.Text>
      <View className="mt-3 gap-3">
        {rows.map((row, index) => (
          <Animated.View
            key={row.icon}
            entering={FadeInDown.delay(
              DETAIL_ENTER_DELAY_MS + index * DETAIL_ROW_STAGGER_MS,
            )
              .duration(CARD_ENTER_DURATION_MS)
              .easing(Easing.out(Easing.cubic))}
            className="flex-row items-center gap-3 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4"
          >
            <Ionicons name={row.icon} size={20} color={colors.primary} />
            <Text className="flex-1 font-sfPro text-sm text-foreground">
              {row.text}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const AppsPickerSheet = ({
  familyActivitySelection,
  onSelectionChange,
  onSelectionDone,
  onDismiss,
  doneLabel,
  sheetRef,
}: AppsPickerSheetProps) => {
  const handleChange = (
    e: NativeSyntheticEvent<DeviceActivitySelectionEvent>,
  ) => {
    onSelectionChange(e.nativeEvent.familyActivitySelection ?? null);
  };

  return (
    <BottomSheetModal
      sheetRef={sheetRef}
      showHandle
      scrollView
      onDismiss={onDismiss}
    >
      <View className="px-6 pt-4 pb-8">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
            <Ionicons name="apps-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-sfPro-semibold text-foreground">
              Choose specific apps
            </Text>
            <Text className="mt-0.5 text-sm font-sfPro text-muted">
              You can adjust this anytime in settings.
            </Text>
          </View>
        </View>
        <View
          className="mt-5 overflow-hidden rounded-2xl border border-outline bg-surface"
          style={{ height: PICKER_HEIGHT }}
        >
          <DeviceActivitySelectionView
            familyActivitySelection={familyActivitySelection}
            onSelectionChange={handleChange}
            style={{ flex: 1 }}
          />
        </View>
        <PrimaryButton
          title={doneLabel}
          onPress={() => {
            if (onSelectionDone) {
              onSelectionDone();
              return;
            }
            sheetRef.current?.dismiss();
          }}
          className="mt-5"
        />
      </View>
    </BottomSheetModal>
  );
};

export const SelectAppsStep = ({
  blockAllApps,
  familyActivitySelection,
  onBlockAllAppsChange,
  onSelectionChange,
  onSelectionDone,
  autoOpen = false,
}: SelectAppsStepProps) => {
  const sheetRef = useRef<GorhomBottomSheetModal | null>(null);
  useAppsPickerAutoOpen(sheetRef, autoOpen);

  const openPicker = () => {
    sheetRef.current?.present();
  };

  const selectQuiet = () => {
    Haptics.selectionAsync();
    onBlockAllAppsChange(true);
  };

  const selectCustom = () => {
    Haptics.selectionAsync();
    onBlockAllAppsChange(false);
    if (familyActivitySelection == null) {
      openPicker();
    }
  };

  if (Platform.OS !== "ios") {
    return (
      <Text className="font-sfPro text-textSecondary">
        App selection is only available on iOS.
      </Text>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
    >
      <View className="mt-2">
        <AppScopeChoices
          blockAllApps={blockAllApps}
          familyActivitySelection={familyActivitySelection}
          onSelectQuiet={selectQuiet}
          onSelectCustom={selectCustom}
          onOpenPicker={openPicker}
        />
      </View>

      <FocusPreview blockAllApps={blockAllApps} />

      <View className="mt-auto flex-row items-center justify-center gap-1.5 pt-6">
        <Ionicons name="settings-outline" size={14} color={colors.muted} />
        <Text className="text-sm font-sfPro text-muted">
          You can change this anytime in Settings.
        </Text>
      </View>

      <AppsPickerSheet
        familyActivitySelection={familyActivitySelection}
        onSelectionChange={(selection) => {
          onBlockAllAppsChange(false);
          onSelectionChange(selection);
        }}
        onSelectionDone={onSelectionDone}
        doneLabel={onSelectionDone ? "Save and continue" : "Save changes"}
        sheetRef={sheetRef}
      />
    </ScrollView>
  );
};

export const SettingsSelectAppsStep = ({
  blockAllApps,
  familyActivitySelection,
  selectionSummary,
  onBlockAllAppsChange,
  onSelectionChange,
  onSelectionDone,
  onDismiss,
  onOpenPicker,
}: SettingsSelectAppsStepProps) => {
  const sheetRef = useRef<GorhomBottomSheetModal | null>(null);

  const handleOpenPicker = () => {
    onOpenPicker?.();
    sheetRef.current?.present();
  };

  const selectQuiet = () => {
    Haptics.selectionAsync();
    onBlockAllAppsChange(true);
  };

  const selectCustom = () => {
    Haptics.selectionAsync();
    onBlockAllAppsChange(false);
    if (familyActivitySelection == null) {
      handleOpenPicker();
    }
  };

  const handleSelectionDone = async () => {
    if (onSelectionDone) {
      await onSelectionDone();
    }
    sheetRef.current?.dismiss();
  };

  if (Platform.OS !== "ios") {
    return (
      <Text className="font-sfPro text-textSecondary">
        App selection is only available on iOS.
      </Text>
    );
  }

  return (
    <View className="w-full">
      <AppScopeChoices
        blockAllApps={blockAllApps}
        nested
        familyActivitySelection={familyActivitySelection}
        selectionSummary={selectionSummary}
        onSelectQuiet={selectQuiet}
        onSelectCustom={selectCustom}
        onOpenPicker={handleOpenPicker}
      />
      <AppsPickerSheet
        familyActivitySelection={familyActivitySelection}
        onSelectionChange={onSelectionChange}
        onSelectionDone={handleSelectionDone}
        onDismiss={onDismiss}
        doneLabel="Save changes"
        sheetRef={sheetRef}
      />
    </View>
  );
};

export const commitSelectApps = (
  selection: string | null,
  blockAllApps: boolean,
): boolean => {
  if (!selection && !blockAllApps) {
    Alert.alert(
      "Choose your apps",
      `Pick the apps to pause, or switch to ${QUIET_MODE_TITLE}.`,
    );
    return false;
  }
  const store = useUserStore.getState();
  store.setHasSelectedApps(true);
  store.setBlockAllApps(blockAllApps);
  store.setFamilyActivitySelection(selection);
  return true;
};
