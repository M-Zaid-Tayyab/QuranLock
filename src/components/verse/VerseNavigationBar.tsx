import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import clsx from "clsx";
import { Pressable, Text, View } from "react-native";

interface VerseNavigationBarProps {
  currentPage: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  isBlockSessionActive: boolean;
  requiredMinutes: number;
  remainingMinutes: number;
  remainingSeconds: number;
  pendingSchedulesCount: number;
  onMeasuredHeight?: (height: number) => void;
}

export function VerseNavigationBar({
  currentPage,
  totalPages,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  isBlockSessionActive,
  requiredMinutes,
  remainingMinutes,
  remainingSeconds,
  pendingSchedulesCount,
  onMeasuredHeight,
}: VerseNavigationBarProps) {
  return (
    <View
      className="absolute bottom-6 left-6 right-6"
      onLayout={(event) => {
        onMeasuredHeight?.(event.nativeEvent.layout.height);
      }}
    >
      <View className="flex-row items-center justify-between rounded-full border border-outline bg-surface px-4 py-3">
        <Pressable
          onPress={onNext}
          disabled={!canGoNext}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            canGoNext ? "bg-primary/20" : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoNext ? colors.primary : colors.muted}
          />
        </Pressable>
        <Text className="text-sm font-sfPro-semibold text-foreground">
          {currentPage} / {totalPages}
        </Text>
        <Pressable
          onPress={onPrevious}
          disabled={!canGoPrevious}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            canGoPrevious ? "bg-primary/20" : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={canGoPrevious ? colors.primary : colors.muted}
          />
        </Pressable>
      </View>

      {isBlockSessionActive && requiredMinutes > 0 && (
        <View
          className={clsx(
            "mt-2 mb-1 self-center rounded-full border border-outline bg-backgroundElevated px-4 py-3",
            pendingSchedulesCount > 1 ? "w-[70%]" : "w-[48%]",
          )}
        >
          <Text className="mt-1 text-center text-lg font-sfPro-bold text-foreground">
            {remainingMinutes}:{remainingSeconds.toString().padStart(2, "0")}{" "}
            remaining
          </Text>
          {pendingSchedulesCount > 1 && (
            <Text className="mt-1 text-center text-xs font-sfPro text-muted">
              {pendingSchedulesCount} focus sessions remaining today
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
