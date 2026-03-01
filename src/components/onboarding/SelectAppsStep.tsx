import { BottomSheetModal, PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, type RefObject } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import type { DeviceActivitySelectionEvent } from "react-native-device-activity";
import { DeviceActivitySelectionView } from "react-native-device-activity";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";

interface SelectAppsStepProps {
  familyActivitySelection: string | null;
  onSelectionChange: (selection: string | null) => void;
  onSelectionDone?: () => void | Promise<void>;
  autoOpen?: boolean;
}

interface SettingsSelectAppsStepProps {
  familyActivitySelection: string | null;
  onSelectionChange: (selection: string | null) => void;
}

interface AppsPickerPanelProps {
  familyActivitySelection: string | null;
  onOpenPicker: () => void;
  animated: boolean;
  withTopMargin?: boolean;
}

interface AppsPickerSheetProps {
  familyActivitySelection: string | null;
  onSelectionChange: (selection: string | null) => void;
  onSelectionDone?: () => void | Promise<void>;
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
    }, 450);
    return () => clearTimeout(timer);
  }, [autoOpen, sheetRef]);
};

function AppsPickerPanel({
  familyActivitySelection,
  onOpenPicker,
  animated,
  withTopMargin = false,
}: AppsPickerPanelProps) {
  const className = `${withTopMargin ? "mt-5 " : ""}rounded-2xl border border-outline bg-backgroundElevated px-4 py-4`;

  if (animated) {
    return (
      <Animated.View
        entering={FadeInDown.delay(140)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className={className}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-sfPro-semibold text-foreground">
              App picker
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              {familyActivitySelection
                ? "Selection saved"
                : "No apps selected yet"}
            </Text>
          </View>
          <Pressable
            onPress={onOpenPicker}
            className="rounded-full bg-primary/20 px-4 py-2"
          >
            <Text className="font-sfPro-semibold text-foreground">Open</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <View className={className}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-sfPro-semibold text-foreground">App picker</Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            {familyActivitySelection ? "Selection saved" : "No apps selected yet"}
          </Text>
        </View>
        <Pressable
          onPress={onOpenPicker}
          className="rounded-full bg-primary/20 px-4 py-2"
        >
          <Text className="font-sfPro-semibold text-foreground">Open</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AppsPickerSheet({
  familyActivitySelection,
  onSelectionChange,
  onSelectionDone,
  sheetRef,
}: AppsPickerSheetProps) {
  const handleChange = (
    e: NativeSyntheticEvent<DeviceActivitySelectionEvent>,
  ) => {
    onSelectionChange(e.nativeEvent.familyActivitySelection ?? null);
  };

  return (
    <BottomSheetModal sheetRef={sheetRef} showHandle scrollView>
      <View className="px-6 pt-4 pb-8">
        <Text className="text-lg font-sfPro-semibold text-foreground">
          Select apps to block
        </Text>
        <Text className="mt-1 text-sm font-sfPro text-muted">
          Your selection can be changed anytime in settings.
        </Text>
        <View className="mt-4 h-[420px] overflow-hidden rounded-2xl border border-outline bg-surface">
          <DeviceActivitySelectionView
            familyActivitySelection={familyActivitySelection}
            onSelectionChange={handleChange}
            style={{ flex: 1 }}
          />
        </View>
        <PrimaryButton
          title={onSelectionDone ? "Continue" : "Done"}
          onPress={() => {
            if (onSelectionDone) {
              void onSelectionDone();
              return;
            }
            sheetRef.current?.dismiss();
          }}
          className="mt-4"
        />
      </View>
    </BottomSheetModal>
  );
}

export function SelectAppsStep({
  familyActivitySelection,
  onSelectionChange,
  onSelectionDone,
  autoOpen = true,
}: SelectAppsStepProps) {
  const funnelText = useFunnelText();
  const sheetRef = useRef<GorhomBottomSheetModal | null>(null);
  useAppsPickerAutoOpen(sheetRef, autoOpen);

  if (Platform.OS !== "ios") {
    return (
      <Text className="font-sfPro text-textSecondary">
        App selection is only available on iOS.
      </Text>
    );
  }

  return (
    <View className="w-full">
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
            <Ionicons name="apps-outline" size={22} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-sfPro-semibold text-foreground">
              Choose what to pause
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              {funnelText.onboarding.selectAppsDescription}
            </Text>
          </View>
        </View>
      </Animated.View>

      <AppsPickerPanel
        familyActivitySelection={familyActivitySelection}
        onOpenPicker={() => sheetRef.current?.present()}
        animated
        withTopMargin
      />

      <AppsPickerSheet
        familyActivitySelection={familyActivitySelection}
        onSelectionChange={onSelectionChange}
        onSelectionDone={onSelectionDone}
        sheetRef={sheetRef}
      />
    </View>
  );
}

export function SettingsSelectAppsStep({
  familyActivitySelection,
  onSelectionChange,
}: SettingsSelectAppsStepProps) {
  const sheetRef = useRef<GorhomBottomSheetModal | null>(null);

  if (Platform.OS !== "ios") {
    return (
      <Text className="font-sfPro text-textSecondary">
        App selection is only available on iOS.
      </Text>
    );
  }

  return (
    <View className="w-full">
      <AppsPickerPanel
        familyActivitySelection={familyActivitySelection}
        onOpenPicker={() => sheetRef.current?.present()}
        animated={false}
      />
      <AppsPickerSheet
        familyActivitySelection={familyActivitySelection}
        onSelectionChange={onSelectionChange}
        sheetRef={sheetRef}
      />
    </View>
  );
}

export function commitSelectApps(selection: string | null): boolean {
  if (!selection) {
    Alert.alert("Select apps", "Please select at least one app to block.");
    return false;
  }
  const store = useUserStore.getState();
  store.setHasSelectedApps(true);
  store.setFamilyActivitySelection(selection);
  return true;
}
