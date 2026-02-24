import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface VerseRecitationControlsProps {
  selectedVerseKey: string | null;
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
}

export function VerseRecitationControls({
  selectedVerseKey,
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
}: VerseRecitationControlsProps) {
  const hasSelection = Boolean(selectedVerseKey);

  return (
    <View className="mx-6 mt-3 rounded-2xl border border-outline bg-surface px-3 py-2.5">
      <View className="flex-row items-center">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
          <Ionicons name="musical-note" size={16} color={colors.primary} />
        </View>

        <View className="flex-1 pr-2">
          <Text
            numberOfLines={1}
            className="text-sm font-sfPro-semibold text-foreground"
          >
            {selectedVerseKey ? `Verse ${selectedVerseKey}` : "Select a verse"}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs font-sfPro text-muted"
          >
            {isLoadingAudio
              ? "Loading audio..."
              : `${positionLabel} / ${durationLabel}`}
          </Text>
        </View>

        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={onPlayPrevious}
            disabled={!hasSelection || !canGoPrevious}
            className={`h-8 w-8 items-center justify-center rounded-full ${
              hasSelection && canGoPrevious
                ? "bg-primary/20"
                : "bg-backgroundElevated"
            }`}
          >
            <Ionicons
              name="play-skip-back"
              size={14}
              color={
                hasSelection && canGoPrevious ? colors.primary : colors.muted
              }
            />
          </Pressable>

          <Pressable
            onPress={onTogglePlayback}
            disabled={!hasSelection || isLoadingAudio}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              hasSelection ? "bg-primary" : "bg-backgroundElevated"
            }`}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={18}
              color={hasSelection ? colors.primaryForeground : colors.muted}
            />
          </Pressable>

          <Pressable
            onPress={onPlayNext}
            disabled={!hasSelection || !canGoNext}
            className={`h-8 w-8 items-center justify-center rounded-full ${
              hasSelection && canGoNext
                ? "bg-primary/20"
                : "bg-backgroundElevated"
            }`}
          >
            <Ionicons
              name="play-skip-forward"
              size={14}
              color={hasSelection && canGoNext ? colors.primary : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text className="mt-2 text-xs font-sfPro text-error" numberOfLines={2}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
