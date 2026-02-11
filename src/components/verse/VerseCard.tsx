import clsx from "clsx";
import { Pressable, Text } from "react-native";
import type { DisplayVerse } from "./types";

interface VerseCardProps {
  verse: DisplayVerse;
  isSelected: boolean;
  translationEnabled: boolean;
  arabicFontSize: number;
  arabicLineHeight: number;
  translationFontSize: number;
  onSelect: () => void;
}

export function VerseCard({
  verse,
  isSelected,
  translationEnabled,
  arabicFontSize,
  arabicLineHeight,
  translationFontSize,
  onSelect,
}: VerseCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      className={clsx(
        "rounded-2xl border px-4 py-4",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-outline bg-backgroundElevated",
      )}
    >
      <Text className="text-xs font-sfPro-semibold text-accent">{verse.key}</Text>
      <Text
        className="mt-3 text-right text-foreground"
        style={{
          fontSize: Math.round(arabicFontSize * 0.92),
          lineHeight: Math.round(arabicLineHeight * 0.9),
          writingDirection: "rtl",
        }}
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
