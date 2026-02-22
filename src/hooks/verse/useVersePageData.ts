import type { DisplayVerse } from "@/components/verse/types";
import {
  QURAN_TOTAL_PAGES,
  getQuranPage,
  type QuranPageData,
  type QuranWord,
} from "@/services/quranPack";
import { useVerseStore } from "@/store/verse";
import { getArabicLineHeight } from "@/utils/arabicTypography";
import { useCallback, useEffect, useMemo } from "react";

const FONT_SCALE_BASE = {
  arabic: 28,
  translation: 14,
};

const deriveVersesFromWords = (words: QuranWord[]) => {
  const byKey = new Map<string, string[]>();
  words.forEach((word) => {
    const existing = byKey.get(word.verseKey) ?? [];
    existing.push(word.text);
    byKey.set(word.verseKey, existing);
  });
  return [...byKey.entries()].map(([key, parts]) => ({
    key,
    arabic: parts.join(" "),
  }));
};

const getFirstVerseKeyFromPageData = (data: QuranPageData | null) => {
  const firstVerseKey = data?.verses?.[0]?.key;
  if (firstVerseKey) return firstVerseKey;
  if (data?.words?.length) {
    return deriveVersesFromWords(data.words)[0]?.key ?? null;
  }
  return null;
};

interface UseVersePageDataArgs {
  pageData: QuranPageData | null;
  quranFontScale: number;
  setSelectedVerseKey: (value: string | null) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  setPageDirection: (direction: 1 | -1) => void;
}

export const useVersePageData = ({
  pageData,
  quranFontScale,
  setSelectedVerseKey,
  currentPage,
  setCurrentPage,
  setPageDirection,
}: UseVersePageDataArgs) => {
  const groupedLines = useMemo(() => {
    if (!pageData?.words?.length) return [] as [number, QuranWord[]][];
    const map = new Map<number, QuranWord[]>();
    pageData.words.forEach((word) => {
      const line = word.line ?? 1;
      if (!map.has(line)) map.set(line, []);
      map.get(line)?.push(word);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [pageData]);

  const verseTextByKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!pageData?.words?.length) return map;
    pageData.words.forEach((word) => {
      const existing = map.get(word.verseKey) ?? "";
      map.set(word.verseKey, existing ? `${existing} ${word.text}` : word.text);
    });
    return map;
  }, [pageData]);

  const displayVerses = useMemo(() => {
    if (pageData?.verses?.length) {
      return pageData.verses.map((verse) => ({
        key: verse.key,
        arabic: verse.arabic ?? verseTextByKey.get(verse.key) ?? "",
        translation: verse.translation ?? verse.text,
      })) satisfies DisplayVerse[];
    }
    if (pageData?.words?.length) {
      return deriveVersesFromWords(pageData.words).map((verse) => ({
        ...verse,
        translation: undefined,
      })) satisfies DisplayVerse[];
    }
    return [] as DisplayVerse[];
  }, [pageData, verseTextByKey]);

  useEffect(() => {
    if (!displayVerses.length) return;
    const selectedVerseKey = useVerseStore.getState().selectedVerseKey;
    const exists = selectedVerseKey
      ? displayVerses.some((verse) => verse.key === selectedVerseKey)
      : false;
    if (!exists) {
      setSelectedVerseKey(displayVerses[0].key);
    }
  }, [displayVerses, setSelectedVerseKey]);

  const verseKeys = useMemo(
    () => displayVerses.map((verse) => verse.key),
    [displayVerses],
  );

  const requestNextPageVerse = useCallback(async () => {
    if (currentPage >= QURAN_TOTAL_PAGES) {
      return null;
    }

    const nextPage = currentPage + 1;
    setPageDirection(1);
    setCurrentPage(nextPage);

    try {
      const nextPageData = await getQuranPage(nextPage, { priority: "high" });
      const nextVerseKey = getFirstVerseKeyFromPageData(nextPageData);
      if (!nextVerseKey) return null;
      setSelectedVerseKey(nextVerseKey);
      return nextVerseKey;
    } catch {
      return null;
    }
  }, [currentPage, setCurrentPage, setPageDirection, setSelectedVerseKey]);

  const hasWordData = Boolean(pageData?.words?.length);
  const arabicFontSize = Math.round(FONT_SCALE_BASE.arabic * quranFontScale);
  const arabicLineHeight = getArabicLineHeight(arabicFontSize);
  const translationFontSize = Math.round(
    FONT_SCALE_BASE.translation * Math.min(1.1, quranFontScale),
  );

  return {
    hasWordData,
    groupedLines,
    displayVerses,
    verseKeys,
    requestNextPageVerse,
    arabicFontSize,
    arabicLineHeight,
    translationFontSize,
  };
};
