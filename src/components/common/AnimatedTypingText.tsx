import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";

interface TypingDurationOptions {
  initialDelayMs?: number;
  charDelayMs?: number;
  durationMs?: number;
  endDelayMs?: number;
}

export interface AnimatedTypingTextProps extends TypingDurationOptions {
  text: string;
  highlightedWords?: string[];
  defaultColor?: string;
  highlightColor?: string;
  containerClassName?: string;
  lineClassName?: string;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
  enableWordHaptics?: boolean;
  keyPrefix?: string;
}

const normalizeWord = (word: string) =>
  word.replace(/[^a-z0-9']/gi, "").toLowerCase();

export const getTypingAnimationDuration = (
  text: string,
  {
    initialDelayMs = 0,
    charDelayMs = 36,
    durationMs = 0,
    endDelayMs = 0,
  }: TypingDurationOptions = {},
) =>
  initialDelayMs +
  Math.max(0, text.length) * Math.max(0, charDelayMs) +
  Math.max(0, durationMs) +
  Math.max(0, endDelayMs);

export function AnimatedTypingText({
  text,
  highlightedWords = [],
  defaultColor,
  highlightColor,
  containerClassName,
  lineClassName: _lineClassName,
  textClassName,
  textStyle,
  initialDelayMs = 0,
  charDelayMs = 36,
  enableWordHaptics = false,
  keyPrefix,
}: AnimatedTypingTextProps) {
  const [visibleLength, setVisibleLength] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticsRef = useRef(0);

  useEffect(() => {
    setVisibleLength(0);

    if (!text.length) return;

    const tick = (nextIndex: number) => {
      setVisibleLength(nextIndex);

      if (enableWordHaptics) {
        const typedChar = text[nextIndex - 1] ?? "";
        const previousChar = text[nextIndex - 2] ?? " ";
        const isWordStart = /\S/.test(typedChar) && /\s/.test(previousChar);
        const now = Date.now();

        if (isWordStart && now - hapticsRef.current > 45) {
          hapticsRef.current = now;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
      }

      if (nextIndex >= text.length) return;

      timeoutRef.current = setTimeout(() => {
        tick(nextIndex + 1);
      }, charDelayMs);
    };

    timeoutRef.current = setTimeout(() => {
      tick(1);
    }, initialDelayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [charDelayMs, enableWordHaptics, initialDelayMs, keyPrefix, text]);

  const highlightSet = useMemo(
    () => new Set(highlightedWords.map(normalizeWord).filter(Boolean)),
    [highlightedWords],
  );

  const tokens = text.split(/(\s+)/);
  const baseTextColor = defaultColor ?? "transparent";
  let characterIndex = 0;

  return (
    <View className={containerClassName}>
      <Text
        className={textClassName}
        style={[defaultColor ? { color: defaultColor } : null, textStyle]}
      >
        {tokens.map((token, index) => {
          const normalizedToken = normalizeWord(token);
          const isHighlighted =
            normalizedToken.length > 0 && highlightSet.has(normalizedToken);
          const tokenColor =
            isHighlighted && highlightColor ? highlightColor : baseTextColor;

          return (
            <Text key={`${keyPrefix ?? "typing"}-${index}-${token}`}>
              {Array.from(token).map((character, characterOffset) => {
                const isVisible = characterIndex < visibleLength;
                const node = (
                  <Text
                    key={`${keyPrefix ?? "typing"}-${index}-${characterOffset}`}
                    style={{
                      color: isVisible ? tokenColor : "transparent",
                    }}
                  >
                    {character}
                  </Text>
                );

                characterIndex += 1;
                return node;
              })}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}
