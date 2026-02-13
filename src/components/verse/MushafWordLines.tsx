import clsx from "clsx";
import { Pressable, Text, View } from "react-native";
import type { QuranWord } from "@/services/quranPack";
import { getArabicTextStyle } from "@/utils/arabicTypography";

interface MushafWordLinesProps {
  groupedLines: [number, QuranWord[]][];
  selectedVerseKey: string | null;
  arabicFontSize: number;
  arabicLineHeight: number;
  onSelectVerse: (verseKey: string) => void;
  onVerseLayout?: (verseKey: string, y: number, height: number) => void;
}

export function MushafWordLines({
  groupedLines,
  selectedVerseKey,
  arabicFontSize,
  arabicLineHeight,
  onSelectVerse,
  onVerseLayout,
}: MushafWordLinesProps) {
  return (
    <View className="gap-4">
      {groupedLines.map(([lineNumber, words]) => (
        <View
          key={`line-${lineNumber}`}
          onLayout={(event) => {
            const y = event.nativeEvent.layout.y;
            const height = event.nativeEvent.layout.height;
            const verseKeys = [...new Set(words.map((word) => word.verseKey))];
            verseKeys.forEach((verseKey) => onVerseLayout?.(verseKey, y, height));
          }}
          className="flex-row flex-wrap"
          style={{
            flexDirection: "row-reverse",
            justifyContent: "flex-start",
          }}
        >
          {words.map((word) => {
            const isSelected = word.verseKey === selectedVerseKey;
            return (
              <Pressable
                key={`${word.id}-${word.verseKey}`}
                onPress={() => onSelectVerse(word.verseKey)}
                className={clsx(
                  "items-center rounded-lg px-1 py-1",
                  isSelected ? "bg-accent/10" : "",
                )}
              >
                <Text
                  allowFontScaling={false}
                  className={clsx(isSelected ? "text-accent" : "text-foreground")}
                  style={getArabicTextStyle(arabicFontSize, arabicLineHeight)}
                >
                  {word.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
