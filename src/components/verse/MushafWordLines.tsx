import clsx from "clsx";
import { Pressable, Text, View } from "react-native";
import type { QuranWord } from "@/services/quranPack";

interface MushafWordLinesProps {
  groupedLines: [number, QuranWord[]][];
  selectedVerseKey: string | null;
  arabicFontSize: number;
  arabicLineHeight: number;
  onSelectVerse: (verseKey: string) => void;
}

export function MushafWordLines({
  groupedLines,
  selectedVerseKey,
  arabicFontSize,
  arabicLineHeight,
  onSelectVerse,
}: MushafWordLinesProps) {
  return (
    <View className="gap-4">
      {groupedLines.map(([lineNumber, words]) => (
        <View
          key={`line-${lineNumber}`}
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
                  className={clsx(isSelected ? "text-accent" : "text-foreground")}
                  style={{
                    fontSize: arabicFontSize,
                    lineHeight: arabicLineHeight,
                    writingDirection: "rtl",
                  }}
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
