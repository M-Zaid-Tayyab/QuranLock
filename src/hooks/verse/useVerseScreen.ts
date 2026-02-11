import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { useVerseRecitation } from "@/hooks/verse/useVerseRecitation";
import { unblockSelection } from "@/services/deviceActivity";
import {
  canOpenQuran,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import {
  searchQuranVerses,
  type QuranSearchResult,
} from "@/services/quranFoundation";
import {
  QURAN_TOTAL_PAGES,
  deleteQuranPack,
  ensureQuranPack,
  findVerseLocationByKey,
  getPackInfo,
  getQuranPage,
  prefetchQuranPages,
  pruneQuranCache,
  resetPrefetchQueue,
  type QuranPageData,
  type QuranWord,
} from "@/services/quranPack";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { getArabicLineHeight } from "@/utils/arabicTypography";
import { getScheduleStatuses } from "@/utils/scheduleEngine";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, type AppStateStatus } from "react-native";

const TICK_INTERVAL_MS = 1000;
const MINUTES_PER_TICK = 1 / 60;
const FONT_SCALES = [0.9, 1, 1.15, 1.3];

type ReadingMode = "mushaf" | "study";
type PackState = "checking" | "missing" | "downloading" | "ready" | "error";

interface DisplayVerse {
  key: string;
  arabic: string;
  translation?: string;
}

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

export const useVerseScreen = () => {
  const router = useRouter();
  const addQuranMinutes = useBlockingStore((s) => s.addQuranMinutes);
  const getRequiredMinutes = useBlockingStore((s) => s.getRequiredMinutes);
  const resetAfterUnblock = useBlockingStore((s) => s.resetAfterUnblock);
  const accumulatedQuranMinutesForCurrentBlock = useBlockingStore(
    (s) => s.accumulatedQuranMinutesForCurrentBlock,
  );
  const completedScheduleIds = useBlockingStore((s) => s.completedScheduleIds);
  const markScheduleCompleted = useBlockingStore(
    (s) => s.markScheduleCompleted,
  );
  const setActiveSchedule = useBlockingStore((s) => s.setActiveSchedule);
  const lastReadPage = useUserStore((s) => s.lastReadPage);
  const setLastReadPage = useUserStore((s) => s.setLastReadPage);
  const translationEnabled = useUserStore((s) => s.translationEnabled);
  const setTranslationEnabled = useUserStore((s) => s.setTranslationEnabled);
  const quranFontScale = useUserStore((s) => s.quranFontScale);
  const setQuranFontScale = useUserStore((s) => s.setQuranFontScale);
  const isPremium = useUserStore((s) => s.isPremium);
  const completedUnlockSessions = useUserStore(
    (s) => s.completedUnlockSessions,
  );
  const incrementCompletedUnlockSessions = useUserStore(
    (s) => s.incrementCompletedUnlockSessions,
  );
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const translationEnabledRef = useRef(translationEnabled);
  const unlockSessionCountedRef = useRef(false);
  const gateCheckedRef = useRef(false);
  const searchRequestIdRef = useRef(0);

  const { dateKey, activeSchedule, pendingSchedules } =
    useFocusScheduleStatus();

  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentPage, setCurrentPage] = useState(
    Math.min(Math.max(lastReadPage || 1, 1), QURAN_TOTAL_PAGES),
  );
  const [packState, setPackState] = useState<PackState>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [packError, setPackError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const requestIdRef = useRef(0);

  const [readingMode, setReadingMode] = useState<ReadingMode>("mushaf");
  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<QuranSearchResult[]>([]);
  const [recitationVisible, setRecitationVisible] = useState(false);

  const requiredMinutes = getRequiredMinutes();

  useEffect(() => {
    if (gateCheckedRef.current) return;
    gateCheckedRef.current = true;
    const gate = canOpenQuran({ isPremium, completedUnlockSessions });
    if (gate.allowed) return;
    openPaywallForBlockedDecision(router, gate, PAYWALL_SOURCES.VERSE_GUARD, {
      replace: true,
    });
  }, [completedUnlockSessions, isPremium, router]);

  useEffect(() => {
    if (
      requiredMinutes > 0 &&
      accumulatedQuranMinutesForCurrentBlock < requiredMinutes
    ) {
      unlockSessionCountedRef.current = false;
    }
  }, [accumulatedQuranMinutesForCurrentBlock, requiredMinutes]);

  const tick = useCallback(() => {
    const shouldUnblock = addQuranMinutes(MINUTES_PER_TICK);
    if (!shouldUnblock) return;
    if (!unlockSessionCountedRef.current) {
      incrementCompletedUnlockSessions();
      unlockSessionCountedRef.current = true;
    }
    if (activeSchedule) {
      const completedIds = completedScheduleIds.includes(
        activeSchedule.schedule.id,
      )
        ? completedScheduleIds
        : [...completedScheduleIds, activeSchedule.schedule.id];
      markScheduleCompleted(activeSchedule.schedule.id, dateKey);
      const statuses = getScheduleStatuses(
        focusSchedules,
        completedIds,
        new Date(),
      );
      const nextPending = statuses.find((entry) => entry.status === "pending");
      if (nextPending) {
        setActiveSchedule(
          nextPending.schedule.id,
          nextPending.schedule.durationMinutes,
          dateKey,
        );
      } else {
        setActiveSchedule(null, 0, dateKey);
        unblockSelection();
        resetAfterUnblock();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      return;
    }
    unblockSelection();
    resetAfterUnblock();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [
    addQuranMinutes,
    activeSchedule,
    completedScheduleIds,
    dateKey,
    focusSchedules,
    incrementCompletedUnlockSessions,
    markScheduleCompleted,
    resetAfterUnblock,
    setActiveSchedule,
  ]);

  useEffect(() => {
    if (requiredMinutes <= 0) return;

    const handleAppStateChange = (next: AppStateStatus) => {
      setAppState(next);
      if (next !== "active") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        intervalRef.current = setInterval(tick, TICK_INTERVAL_MS);
      }
    };

    if (appState === "active") {
      intervalRef.current = setInterval(tick, TICK_INTERVAL_MS);
    }

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      sub.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [requiredMinutes, appState, tick]);

  useEffect(() => {
    translationEnabledRef.current = translationEnabled;
  }, [translationEnabled]);

  const checkPack = useCallback(async () => {
    try {
      const info = await getPackInfo();
      setPackState(info.exists ? "ready" : "missing");
      if (!info.exists) {
        setPackError(null);
      }
    } catch (error) {
      setPackError(
        error instanceof Error ? error.message : "Unable to read Quran pack",
      );
      setPackState("error");
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setPackError(null);
    setPackState("downloading");
    setDownloadProgress(0);
    try {
      await ensureQuranPack((progress) => setDownloadProgress(progress));
      setPackState("ready");
    } catch (error) {
      setPackError(error instanceof Error ? error.message : "Download failed");
      setPackState("error");
    }
  }, []);

  useEffect(() => {
    checkPack();
  }, [checkPack]);

  useEffect(() => {
    if (packState === "missing" && !autoDownloadAttempted) {
      setAutoDownloadAttempted(true);
      handleDownload();
    }
  }, [autoDownloadAttempted, handleDownload, packState]);

  const loadPage = useCallback(
    async (page: number) => {
      const requestId = ++requestIdRef.current;
      resetPrefetchQueue();
      setLoadingPage(true);
      setPageError(null);
      setPageData(null);
      transition.setValue(0);
      try {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Loading timed out")), 8000);
        });
        const data = await Promise.race([
          getQuranPage(page, {
            priority: "high",
            shouldAbort: () => requestId !== requestIdRef.current,
          }),
          timeout,
        ]);
        if (requestId !== requestIdRef.current) return;
        setPageData(data);
        setLastReadPage(page);
        pruneQuranCache(page, 2);
        const prefetchRadius = translationEnabledRef.current ? 1 : 2;
        const pagesToPrefetch =
          prefetchRadius === 1
            ? [page - 1, page + 1]
            : [page - 2, page - 1, page + 1, page + 2];
        prefetchQuranPages(pagesToPrefetch);
        if (!data) {
          setPageError("Pack missing or corrupted. Please redownload.");
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setPageError(
          error instanceof Error ? error.message : "Unable to load page",
        );
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoadingPage(false);
      }
    },
    [setLastReadPage, transition],
  );

  useEffect(() => {
    if (packState === "ready") {
      loadPage(currentPage);
    }
  }, [packState, currentPage, loadPage]);

  useEffect(() => {
    if (!pageData || loadingPage) return;
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pageData, loadingPage, transition]);

  const handleRedownloadPack = useCallback(async () => {
    setPackError(null);
    setPageError(null);
    setPackState("downloading");
    setDownloadProgress(0);
    await deleteQuranPack();
    try {
      await ensureQuranPack((progress) => setDownloadProgress(progress));
      setPackState("ready");
    } catch (error) {
      setPackError(error instanceof Error ? error.message : "Download failed");
      setPackState("error");
    }
  }, []);

  const handlePageChange = useCallback(
    (next: number) => {
      if (loadingPage) return;
      const clamped = Math.min(Math.max(next, 1), QURAN_TOTAL_PAGES);
      if (clamped !== currentPage) {
        setPageDirection(clamped > currentPage ? 1 : -1);
      }
      setCurrentPage(clamped);
    },
    [currentPage, loadingPage],
  );

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
    if (!displayVerses.length) {
      setSelectedVerseKey(null);
      return;
    }
    const exists = selectedVerseKey
      ? displayVerses.some((verse) => verse.key === selectedVerseKey)
      : false;
    if (!exists) {
      setSelectedVerseKey(displayVerses[0].key);
    }
  }, [displayVerses, selectedVerseKey]);

  const selectedVerse = useMemo(
    () =>
      selectedVerseKey
        ? (displayVerses.find((verse) => verse.key === selectedVerseKey) ??
          null)
        : null,
    [displayVerses, selectedVerseKey],
  );
  const verseKeys = useMemo(
    () => displayVerses.map((verse) => verse.key),
    [displayVerses],
  );
  const recitation = useVerseRecitation({
    verseKeys,
    selectedVerseKey,
    onSelectVerse: setSelectedVerseKey,
  });

  const hasWordData = Boolean(pageData?.words?.length);
  const arabicFontSize = Math.round(28 * quranFontScale);
  const arabicLineHeight = getArabicLineHeight(arabicFontSize);
  const translationFontSize = Math.round(14 * Math.min(1.1, quranFontScale));
  const isBlockSessionActive = activeSchedule != null;

  const remaining = Math.max(
    0,
    Math.ceil((requiredMinutes - accumulatedQuranMinutesForCurrentBlock) * 60),
  );
  const remainingMinutes = Math.floor(remaining / 60);
  const remainingSeconds = remaining % 60;

  const handleFontAdjust = useCallback(
    (delta: number) => {
      const currentIndex = FONT_SCALES.reduce((closest, value, index) => {
        const diff = Math.abs(value - quranFontScale);
        const bestDiff = Math.abs(FONT_SCALES[closest] - quranFontScale);
        return diff < bestDiff ? index : closest;
      }, 0);
      const nextIndex = Math.min(
        FONT_SCALES.length - 1,
        Math.max(0, currentIndex + delta),
      );
      setQuranFontScale(FONT_SCALES[nextIndex]);
    },
    [quranFontScale, setQuranFontScale],
  );

  const executeSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await searchQuranVerses(trimmed, { page: 1, size: 15 });
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults(results);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchError(
        error instanceof Error
          ? error.message
          : "Unable to search right now. Please try again.",
      );
      setSearchResults([]);
    } finally {
      if (requestId !== searchRequestIdRef.current) return;
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!searchVisible) return;
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [executeSearch, searchQuery, searchVisible]);

  const jumpToVerse = useCallback(
    async (verseKey: string, fallbackPage?: number) => {
      const lookup = await findVerseLocationByKey(verseKey);
      if (lookup) {
        setPageDirection(lookup.page >= currentPage ? 1 : -1);
        setCurrentPage(lookup.page);
        setSelectedVerseKey(lookup.verse.key);
        return;
      }
      if (
        fallbackPage &&
        fallbackPage >= 1 &&
        fallbackPage <= QURAN_TOTAL_PAGES
      ) {
        setPageDirection(fallbackPage >= currentPage ? 1 : -1);
        setCurrentPage(fallbackPage);
        setSelectedVerseKey(verseKey);
        return;
      }
      setPageError("Verse found in search but unavailable in your local pack.");
    },
    [currentPage],
  );

  const handleSearchPick = useCallback(
    async (item: QuranSearchResult) => {
      setSearchVisible(false);
      setSearchQuery(item.verseKey);
      await jumpToVerse(item.verseKey, item.pageNumber);
    },
    [jumpToVerse],
  );

  const animatedContentStyle = useMemo(
    () => ({
      opacity: transition,
      transform: [
        {
          translateX: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [pageDirection * 18, 0],
          }),
        },
      ],
    }),
    [pageDirection, transition],
  );

  return {
    header: {
      title: pageData?.surahName ?? "The Qur'an",
      subtitle: pageData?.rangeLabel ?? `Page ${currentPage}`,
      translationEnabled,
    },
    content: {
      packState,
      loadingPage,
      pageError,
      pageData,
      animatedContentStyle,
      hasWordData,
      groupedLines,
      displayVerses,
      selectedVerse,
      selectedVerseKey,
      arabicFontSize,
      arabicLineHeight,
      translationFontSize,
    },
    progress: {
      isBlockSessionActive,
      requiredMinutes,
      remainingMinutes,
      remainingSeconds,
      pendingSchedulesCount: pendingSchedules.length,
    },
    navigation: {
      currentPage,
      totalPages: QURAN_TOTAL_PAGES,
      canGoNext: currentPage < QURAN_TOTAL_PAGES,
      canGoPrevious: currentPage > 1,
    },
    search: {
      visible: searchVisible,
      query: searchQuery,
      searching,
      error: searchError,
      results: searchResults,
    },
    pack: {
      error: packError,
      downloadProgress,
    },
    recitation: {
      visible: recitationVisible,
      reciters: recitation.reciters,
      selectedReciterId: recitation.reciterId,
      playbackRate: recitation.playbackRate,
      isLoadingAudio: recitation.isLoadingAudio,
      isPlaying: recitation.isPlaying,
      error: recitation.error,
      canGoNext: recitation.canGoNext,
      canGoPrevious: recitation.canGoPrevious,
      positionLabel: recitation.positionLabel,
      durationLabel: recitation.durationLabel,
    },
    actions: {
      goBack: () => router.back(),
      increaseFont: () => handleFontAdjust(1),
      decreaseFont: () => handleFontAdjust(-1),
      toggleTranslation: () => setTranslationEnabled(!translationEnabled),
      openSearch: () => setSearchVisible(true),
      closeSearch: () => setSearchVisible(false),
      setSearchQuery,
      pickSearchResult: handleSearchPick,
      toggleReadingMode: () =>
        setReadingMode((mode) => (mode === "mushaf" ? "study" : "mushaf")),
      setReadingMode: (mode: ReadingMode) => setReadingMode(mode),
      readingMode,
      downloadPack: handleDownload,
      redownloadPack: handleRedownloadPack,
      goNextPage: () => handlePageChange(currentPage + 1),
      goPreviousPage: () => handlePageChange(currentPage - 1),
      selectVerse: setSelectedVerseKey,
      setReciter: recitation.setReciterId,
      toggleRecitationVisible: () =>
        setRecitationVisible((visible) => !visible),
      toggleRecitationPlayback: recitation.actions.togglePlayback,
      playNextRecitationVerse: recitation.actions.playNext,
      playPreviousRecitationVerse: recitation.actions.playPrevious,
      cycleRecitationRate: recitation.actions.cycleRate,
    },
    readingMode,
  };
};
