import { Pressable, Text, View } from "react-native";
import type { DisplayVerse } from "./types";
import { getArabicTextStyle } from "@/utils/arabicTypography";

interface MushafVerseFlowProps {
  verses: DisplayVerse[];
  selectedVerseKey: string | null;
  arabicFontSize: number;
  arabicLineHeight: number;
  onSelectVerse: (verseKey: string) => void;
}

const toArabicIndicDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit);

const getAyahNumber = (verseKey: string, index: number) => {
  const parts = verseKey.split(":");
  if (parts.length >= 2) {
    const ayah = Number(parts[1]);
    if (Number.isFinite(ayah) && ayah > 0) {
      return ayah;
    }
  }
  return index + 1;
};

export function MushafVerseFlow({
  verses,
  selectedVerseKey,
  arabicFontSize,
  arabicLineHeight,
  onSelectVerse,
}: MushafVerseFlowProps) {
  return (
    <View className="rounded-2xl border border-outline bg-backgroundElevated/50 px-3 py-3">
      {verses.map((verse, index) => {
        const isSelected = selectedVerseKey === verse.key;
        const ayahNumber = getAyahNumber(verse.key, index);

        return (
          <Pressable
            key={verse.key}
            onPress={() => onSelectVerse(verse.key)}
            className={`rounded-xl px-2 py-3 ${isSelected ? "bg-accent/10" : ""}`}
          >
            <Text
              allowFontScaling={false}
              className={isSelected ? "text-accent" : "text-foreground"}
              style={getArabicTextStyle(arabicFontSize, arabicLineHeight)}
            >
              {verse.arabic}{" "}
              <Text
                allowFontScaling={false}
                className={isSelected ? "text-accent" : "text-muted"}
                style={{
                  fontSize: Math.round(arabicFontSize * 0.62),
                  lineHeight: Math.round(arabicLineHeight * 0.78),
                }}
              >
                ۝{toArabicIndicDigits(ayahNumber)}
              </Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
