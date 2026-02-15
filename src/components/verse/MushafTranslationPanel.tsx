import clsx from "clsx";
import { Pressable, Text, View } from "react-native";
import type { DisplayVerse } from "./types";

interface MushafTranslationPanelProps {
  verses: DisplayVerse[];
  selectedVerseKey: string | null;
  translationFontSize: number;
  onSelectVerse: (verseKey: string) => void;
  onVerseLayout?: (verseKey: string, y: number, height: number) => void;
}

export function MushafTranslationPanel({
  verses,
  selectedVerseKey,
  translationFontSize,
  onSelectVerse,
  onVerseLayout,
}: MushafTranslationPanelProps) {
  const translatedVerses = verses.filter((verse) => Boolean(verse.translation));
  if (!translatedVerses.length) return null;

  return (
    <View className="mt-4 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
      <Text className="text-xs font-sfPro-semibold tracking-widest text-accent">
        ENGLISH MEANING
      </Text>
      <View className="mt-3 gap-2">
        {translatedVerses.map((verse) => {
          const isSelected = verse.key === selectedVerseKey;
          return (
            <Pressable
              key={verse.key}
              onPress={() => onSelectVerse(verse.key)}
              onLayout={(event) => {
                onVerseLayout?.(
                  verse.key,
                  event.nativeEvent.layout.y,
                  event.nativeEvent.layout.height,
                );
              }}
              className={clsx(
                "rounded-xl border px-3 py-3",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-outline bg-surface/60",
              )}
            >
              <Text className="text-[11px] font-sfPro-semibold text-accent">
                {verse.key}
              </Text>
              <Text
                className={clsx(
                  "mt-1 font-sfPro",
                  isSelected ? "text-foreground" : "text-muted",
                )}
                style={{ fontSize: translationFontSize }}
              >
                {verse.translation}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
