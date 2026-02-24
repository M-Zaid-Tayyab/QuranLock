import { BottomSheetModal } from "@/components/common";
import { colors } from "@/constants/colors";
import {
  getRecitationOfflineDownloadStatus,
  startGlobalRecitationOfflineDownload,
  subscribeRecitationOfflineDownloadStatus,
} from "@/services/recitationPack";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import type { ReadingMode } from "./types";

interface VerseSettingsSheetProps {
  sheetRef: RefObject<GorhomBottomSheetModal | null>;
  readingMode: ReadingMode;
  recitationVisible: boolean;
  translationEnabled: boolean;
  onSetReadingMode: (mode: ReadingMode) => void;
  onToggleRecitationVisible: () => void;
  onToggleTranslation: () => void;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  onOpenSearch: () => void;
  onClose: () => void;
}

const OptionCard = ({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    className="rounded-2xl border border-outline bg-backgroundElevated px-4 py-4"
  >
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
        <Text className="text-sm font-sfPro-semibold text-foreground">
          {label}
        </Text>
      </View>
      <Text className="text-xs font-sfPro text-muted">{value}</Text>
    </View>
  </Pressable>
);

const ToggleOptionCard = ({
  label,
  icon,
  enabled,
  onToggle,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled: boolean;
  onToggle: () => void;
}) => (
  <Pressable
    onPress={onToggle}
    accessibilityRole="switch"
    accessibilityState={{ checked: enabled }}
    className="rounded-2xl border border-outline bg-backgroundElevated px-4 py-4"
  >
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
        <Text className="text-sm font-sfPro-semibold text-foreground">
          {label}
        </Text>
      </View>

      <View
        className={`h-7 w-12 flex-row items-center rounded-full border px-0.5 ${
          enabled ? "border-accent bg-accent" : "border-outline bg-surface"
        }`}
      >
        <View
          className={`h-6 w-6 rounded-full bg-white ${
            enabled ? "ml-auto" : "ml-0"
          }`}
        />
      </View>
    </View>
  </Pressable>
);

export function VerseSettingsSheet({
  sheetRef,
  readingMode,
  recitationVisible,
  translationEnabled,
  onSetReadingMode,
  onToggleRecitationVisible,
  onToggleTranslation,
  onIncreaseFont,
  onDecreaseFont,
  onOpenSearch,
  onClose,
}: VerseSettingsSheetProps) {
  const [recitationDownloadStatus, setRecitationDownloadStatus] = useState(
    getRecitationOfflineDownloadStatus,
  );

  useEffect(() => {
    return subscribeRecitationOfflineDownloadStatus((status) => {
      setRecitationDownloadStatus(status);
    });
  }, []);

  const handleResumeRecitationDownload = useCallback(() => {
    void startGlobalRecitationOfflineDownload();
  }, []);

  const recitationDownloadProgressPercent =
    recitationDownloadStatus.progressPercent;
  const recitationDownloadCompletedChapters =
    recitationDownloadStatus.completedChapters;
  const recitationDownloadTotalChapters = recitationDownloadStatus.totalChapters;
  const recitationDownloadCurrentChapter =
    recitationDownloadStatus.currentChapter;
  const recitationDownloadInProgress = recitationDownloadStatus.isDownloading;
  const isRecitationDownloadComplete = recitationDownloadProgressPercent >= 100;
  const isRecitationDownloadActionDisabled =
    isRecitationDownloadComplete || recitationDownloadInProgress;
  const downloadCtaLabel = isRecitationDownloadComplete
    ? "Completed"
    : recitationDownloadInProgress
      ? "Downloading..."
      : "Resume";
  const downloadStatusText = recitationDownloadInProgress
    ? `Downloading chapter ${recitationDownloadCurrentChapter ?? "..."}.`
    : isRecitationDownloadComplete
      ? "Offline recitation pack ready."
      : "Download is paused.";

  return (
    <BottomSheetModal
      sheetRef={sheetRef}
      showHandle
      scrollView
      enablePanDownToClose
      backdropPressBehavior="close"
    >
      <View className="px-6 pb-8 pt-2">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-sfPro-bold text-foreground">
              Reading Settings
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              Tune the verse view for your reading flow.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full border border-outline bg-surface"
          >
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>

        <View className="mt-5 gap-3">
          <OptionCard
            label="Search Quran"
            value="Open"
            icon="search"
            onPress={onOpenSearch}
          />

          <View className="rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
            <Text className="text-sm font-sfPro-semibold text-foreground">
              Reading Mode
            </Text>
            <Text className="mt-1 text-xs font-sfPro text-muted">
              Switch between mushaf layout and verse cards.
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => onSetReadingMode("mushaf")}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  readingMode === "mushaf"
                    ? "border-accent bg-accent/20"
                    : "border-outline bg-surface"
                }`}
              >
                <Text
                  className={`text-center text-sm font-sfPro-semibold ${
                    readingMode === "mushaf" ? "text-accent" : "text-foreground"
                  }`}
                >
                  Mushaf
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onSetReadingMode("study")}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  readingMode === "study"
                    ? "border-accent bg-accent/20"
                    : "border-outline bg-surface"
                }`}
              >
                <Text
                  className={`text-center text-sm font-sfPro-semibold ${
                    readingMode === "study" ? "text-accent" : "text-foreground"
                  }`}
                >
                  Verse Mode
                </Text>
              </Pressable>
            </View>
          </View>

          <ToggleOptionCard
            label="English Translation"
            icon="language-outline"
            enabled={translationEnabled}
            onToggle={onToggleTranslation}
          />

          <ToggleOptionCard
            label="Recitation Controls"
            icon="play-circle-outline"
            enabled={recitationVisible}
            onToggle={onToggleRecitationVisible}
          />

          <View className="rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-sfPro-semibold text-foreground">
                Recitation Download
              </Text>
              <Text className="text-xs font-sfPro text-muted">
                {recitationDownloadProgressPercent}%
              </Text>
            </View>

            <Text className="mt-1 text-xs font-sfPro text-muted">
              {recitationDownloadCompletedChapters}/{recitationDownloadTotalChapters} chapters
              downloaded
            </Text>

            <Text className="mt-2 text-xs font-sfPro text-muted">
              {downloadStatusText}
            </Text>

            <Pressable
              onPress={handleResumeRecitationDownload}
              disabled={isRecitationDownloadActionDisabled}
              className={`mt-3 rounded-xl border px-4 py-3 ${
                isRecitationDownloadActionDisabled
                  ? "border-outline bg-surface"
                  : "border-accent bg-accent/20"
              }`}
            >
              <Text
                className={`text-center text-sm font-sfPro-semibold ${
                  isRecitationDownloadActionDisabled
                    ? "text-muted"
                    : "text-accent"
                }`}
              >
                {downloadCtaLabel}
              </Text>
            </Pressable>
          </View>

          <View className="rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
            <Text className="text-sm font-sfPro-semibold text-foreground">
              Arabic Font Size
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Pressable
                onPress={onDecreaseFont}
                className="h-11 w-16 items-center justify-center rounded-xl border border-outline bg-surface"
              >
                <Ionicons name="remove" size={18} color={colors.muted} />
              </Pressable>
              <Text className="text-xs font-sfPro text-muted">
                Adjust readability
              </Text>
              <Pressable
                onPress={onIncreaseFont}
                className="h-11 w-16 items-center justify-center rounded-xl border border-outline bg-surface"
              >
                <Ionicons name="add" size={18} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </BottomSheetModal>
  );
}
