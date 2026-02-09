import { BottomSheetModal } from "@/components/common";
import { colors } from "@/constants/colors";
import { setSelection } from "@/services/deviceActivity";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeSyntheticEvent } from "react-native";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import type { DeviceActivitySelectionEvent } from "react-native-device-activity";
import { DeviceActivitySelectionView } from "react-native-device-activity";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";

interface SelectAppsStepProps {
  familyActivitySelection: string | null;
  onSelectionChange: (selection: string | null) => void;
  autoOpen?: boolean;
}

export function SelectAppsStep({
  familyActivitySelection,
  onSelectionChange,
  autoOpen = true,
}: SelectAppsStepProps) {
  const sheetRef = useRef<GorhomBottomSheetModal | null>(null);
  const openedOnce = useRef(false);

  const handleChange = (e: NativeSyntheticEvent<DeviceActivitySelectionEvent>) => {
    onSelectionChange(e.nativeEvent.familyActivitySelection ?? null);
  };

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!autoOpen) return;
    if (openedOnce.current) return;
    openedOnce.current = true;
    const timer = setTimeout(() => {
      sheetRef.current?.present();
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  if (Platform.OS !== "ios") {
    return (
      <Text className="font-sfPro text-textSecondary">
        App selection is only available on iOS.
      </Text>
    );
  }

  return (
    <View className="flex-1">
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
              name="apps-outline"
              size={22}
              color={colors.primary}
            />
          </View>
          <View className="flex-1">
            <Text className="font-sfPro-semibold text-foreground">
              Choose what to pause
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              We’ll only block the apps you select during focus time.
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(140)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className="mt-5 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4"
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
            onPress={() => sheetRef.current?.present()}
            className="rounded-full bg-primary/20 px-4 py-2"
          >
            <Text className="font-sfPro-semibold text-foreground">
              Open
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      <BottomSheetModal
        sheetRef={sheetRef}
        snapPoints={["85%"]}
        showHandle
        scrollView
      >
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
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            className="mt-4 rounded-xl bg-primary py-3"
          >
            <Text className="text-center font-sfPro-semibold text-primaryForeground">
              Done
            </Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    </View>
  );
}

export function commitSelectApps(selection: string | null): boolean {
  if (!selection) {
    Alert.alert("Select apps", "Please select at least one app to block.");
    return false;
  }
  setSelection(selection);
  useUserStore.getState().setHasSelectedApps(true);
  return true;
}
