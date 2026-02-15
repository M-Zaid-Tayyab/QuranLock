import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface VerseRecitationControlsProps {
  selectedVerseKey: string | null;
  playbackRate: number;
  isLoadingAudio: boolean;
  isPlaying: boolean;
  error: string | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  positionLabel: string;
  durationLabel: string;
  onTogglePlayback: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onCycleRate: () => void;
}

export function VerseRecitationControls({
  selectedVerseKey,
  playbackRate,
  isLoadingAudio,
  isPlaying,
  error,
  canGoNext,
  canGoPrevious,
  positionLabel,
  durationLabel,
  onTogglePlayback,
  onPlayNext,
  onPlayPrevious,
  onCycleRate,
}: VerseRecitationControlsProps) {
  const hasSelection = Boolean(selectedVerseKey);

  return (
    <View className="rounded-2xl border border-outline bg-surface px-4 py-4 mx-6 mb-6 mt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sfPro-semibold text-foreground">
          Verse Recitation
        </Text>
        <Text className="text-xs font-sfPro text-muted">
          {selectedVerseKey ?? "Select a verse"}
        </Text>
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-6">
        <Pressable
          onPress={onPlayPrevious}
          disabled={!hasSelection || !canGoPrevious}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            hasSelection && canGoPrevious
              ? "bg-primary/20"
              : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name="play-skip-back"
            size={16}
            color={
              hasSelection && canGoPrevious ? colors.primary : colors.muted
            }
          />
        </Pressable>

        <Pressable
          onPress={onTogglePlayback}
          disabled={!hasSelection || isLoadingAudio}
          className={`h-14 w-14 items-center justify-center rounded-full ${
            hasSelection ? "bg-primary" : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={hasSelection ? colors.primaryForeground : colors.muted}
          />
        </Pressable>

        <Pressable
          onPress={onPlayNext}
          disabled={!hasSelection || !canGoNext}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            hasSelection && canGoNext
              ? "bg-primary/20"
              : "bg-backgroundElevated"
          }`}
        >
          <Ionicons
            name="play-skip-forward"
            size={16}
            color={hasSelection && canGoNext ? colors.primary : colors.muted}
          />
        </Pressable>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs font-sfPro text-muted">
          {isLoadingAudio
            ? "Loading audio..."
            : `${positionLabel} / ${durationLabel}`}
        </Text>
        <Pressable
          onPress={onCycleRate}
          className="rounded-full border border-outline bg-backgroundElevated px-3 py-1"
        >
          <Text className="text-xs font-sfPro-semibold text-foreground">
            {playbackRate.toFixed(1)}x
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text className="mt-3 text-xs font-sfPro text-error">{error}</Text>
      ) : null}
    </View>
  );
}
