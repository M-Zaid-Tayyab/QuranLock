import { getArabicTextStyle } from "@/utils/arabicTypography";
import clsx from "clsx";
import { useCallback } from "react";
import { Pressable, Text } from "react-native";
import type { DisplayVerse } from "./types";

interface VerseCardProps {
  verse: DisplayVerse;
  isSelected: boolean;
  translationEnabled: boolean;
  arabicFontSize: number;
  arabicLineHeight: number;
  translationFontSize: number;
  onSelectVerse: (verseKey: string) => void;
}

export function VerseCard({
  verse,
  isSelected,
  translationEnabled,
  arabicFontSize,
  arabicLineHeight,
  translationFontSize,
  onSelectVerse,
}: VerseCardProps) {
  const handleSelect = useCallback(() => {
    onSelectVerse(verse.key);
  }, [onSelectVerse, verse.key]);

  return (
    <Pressable
      onPress={handleSelect}
      className={clsx(
        "rounded-2xl border px-4 py-4",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-outline bg-backgroundElevated",
      )}
    >
      <Text className="text-xs font-sfPro-semibold text-accent">
        {verse.key}
      </Text>
      <Text
        allowFontScaling={false}
        className="mt-3 text-right text-foreground"
        style={getArabicTextStyle(arabicFontSize, arabicLineHeight)}
      >
        {verse.arabic}
      </Text>
      {translationEnabled && verse.translation ? (
        <Text
          className="mt-3 font-sfPro text-muted"
          style={{ fontSize: translationFontSize }}
        >
          {verse.translation}
        </Text>
      ) : null}
    </Pressable>
  );
}
