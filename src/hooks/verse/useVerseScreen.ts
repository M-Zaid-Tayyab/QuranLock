import { PAYWALL_SOURCES } from "@/constants/entitlements";
import { useVerseFocusSessionTicker } from "@/hooks/verse/useVerseFocusSessionTicker";
import { useVersePackLifecycle } from "@/hooks/verse/useVersePackLifecycle";
import { useVersePageData } from "@/hooks/verse/useVersePageData";
import {
  canOpenQuran,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { convexClient } from "@/services/convexClient";
import {
  type QuranSearchResult,
} from "@/services/quranFoundation";
import {
  QURAN_TOTAL_PAGES,
  findVerseLocationByKey,
} from "@/services/quranPack";
import { useUserStore } from "@/store/user";
import { useVerseStore, type ReadingMode } from "@/store/verse";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

const FONT_SCALES = [0.9, 1, 1.15, 1.3];

export const useVerseScreen = () => {
  const router = useRouter();
  const {
    appUserId,
    lastReadPage,
    setLastReadPage,
    syncedTranslationEnabled,
    setSyncedTranslationEnabled,
    quranFontScale,
    setQuranFontScale,
    isPremium,
    completedUnlockSessions,
  } = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      lastReadPage: s.lastReadPage,
      setLastReadPage: s.setLastReadPage,
      syncedTranslationEnabled: s.translationEnabled,
      setSyncedTranslationEnabled: s.setTranslationEnabled,
      quranFontScale: s.quranFontScale,
      setQuranFontScale: s.setQuranFontScale,
      isPremium: s.isPremium,
      completedUnlockSessions: s.completedUnlockSessions,
    })),
  );
  const {
    hasMigratedFromUserStore,
    hydrateFromUserTranslation,
    translationEnabled,
    toggleTranslationEnabled,
    readingMode,
    setReadingMode,
    toggleReadingMode,
    recitationVisible,
    toggleRecitationVisible,
    setSelectedVerseKey,
  } = useVerseStore(
    useShallow((s) => ({
      hasMigratedFromUserStore: s.hasMigratedFromUserStore,
      hydrateFromUserTranslation: s.hydrateFromUserTranslation,
      translationEnabled: s.translationEnabled,
      toggleTranslationEnabled: s.toggleTranslationEnabled,
      readingMode: s.readingMode,
      setReadingMode: s.setReadingMode,
      toggleReadingMode: s.toggleReadingMode,
      recitationVisible: s.recitationVisible,
      toggleRecitationVisible: s.toggleRecitationVisible,
      setSelectedVerseKey: s.setSelectedVerseKey,
    })),
  );
  const translationEnabledRef = useRef(translationEnabled);
  const gateCheckedRef = useRef(false);
  const focusSessionVm = useVerseFocusSessionTicker();

  const [currentPage, setCurrentPage] = useState(
    Math.min(Math.max(lastReadPage || 1, 1), QURAN_TOTAL_PAGES),
  );
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    translationEnabledRef.current = translationEnabled;
  }, [translationEnabled]);

  useEffect(() => {
    if (hasMigratedFromUserStore) return;
    hydrateFromUserTranslation(syncedTranslationEnabled);
  }, [hasMigratedFromUserStore, syncedTranslationEnabled]);

  useEffect(() => {
    if (
      !hasMigratedFromUserStore ||
      syncedTranslationEnabled === translationEnabled
    ) {
      return;
    }
    setSyncedTranslationEnabled(translationEnabled);
  }, [hasMigratedFromUserStore, syncedTranslationEnabled, translationEnabled]);

  const packVm = useVersePackLifecycle({
    currentPage,
    setLastReadPage,
    translationEnabledRef,
    enableAutoDownload: Boolean(appUserId && convexClient),
  });

  const handlePageChange = useCallback(
    (next: number) => {
      if (packVm.loadingPage) return;
      const clamped = Math.min(Math.max(next, 1), QURAN_TOTAL_PAGES);
      if (clamped !== currentPage) {
        setPageDirection(clamped > currentPage ? 1 : -1);
      }
      setCurrentPage(clamped);
    },
    [currentPage, packVm.loadingPage],
  );

  const pageVm = useVersePageData({
    pageData: packVm.pageData,
    quranFontScale,
    setSelectedVerseKey,
    currentPage,
    setCurrentPage,
    setPageDirection,
  });

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

  const handleCloseSearch = useCallback(() => {
    setSearchVisible(false);
  }, []);

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
      packVm.actions.setPageErrorMessage(
        "Verse found in search but unavailable in your local pack.",
      );
    },
    [currentPage, packVm.actions, setSelectedVerseKey],
  );

  const handleSearchPick = useCallback(
    async (item: QuranSearchResult) => {
      await jumpToVerse(item.verseKey, item.pageNumber);
    },
    [jumpToVerse],
  );

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, [router]);

  const handleIncreaseFont = useCallback(() => {
    handleFontAdjust(1);
  }, [handleFontAdjust]);

  const handleDecreaseFont = useCallback(() => {
    handleFontAdjust(-1);
  }, [handleFontAdjust]);

  const handleOpenSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const handleSetReadingMode = useCallback(
    (mode: ReadingMode) => {
      setReadingMode(mode);
    },
    [setReadingMode],
  );

  const handleGoNextPage = useCallback(() => {
    handlePageChange(currentPage + 1);
  }, [currentPage, handlePageChange]);

  const handleGoPreviousPage = useCallback(() => {
    handlePageChange(currentPage - 1);
  }, [currentPage, handlePageChange]);

  const handleRefreshVerse = useCallback(async () => {
    setRefreshing(true);
    try {
      focusSessionVm.refreshSchedule();
    } finally {
      setRefreshing(false);
    }
  }, [focusSessionVm.refreshSchedule]);

  const actions = useMemo(
    () => ({
      goBack: handleGoBack,
      increaseFont: handleIncreaseFont,
      decreaseFont: handleDecreaseFont,
      toggleTranslation: toggleTranslationEnabled,
      openSearch: handleOpenSearch,
      closeSearch: handleCloseSearch,
      pickSearchResult: handleSearchPick,
      toggleReadingMode,
      setReadingMode: handleSetReadingMode,
      readingMode,
      downloadPack: packVm.actions.downloadPack,
      redownloadPack: packVm.actions.redownloadPack,
      goNextPage: handleGoNextPage,
      goPreviousPage: handleGoPreviousPage,
      refreshVerse: handleRefreshVerse,
      selectVerse: setSelectedVerseKey,
      toggleRecitationVisible,
    }),
    [
      handleGoBack,
      handleIncreaseFont,
      handleDecreaseFont,
      toggleTranslationEnabled,
      handleOpenSearch,
      handleCloseSearch,
      handleSearchPick,
      toggleReadingMode,
      handleSetReadingMode,
      readingMode,
      packVm.actions.downloadPack,
      packVm.actions.redownloadPack,
      handleGoNextPage,
      handleGoPreviousPage,
      handleRefreshVerse,
      setSelectedVerseKey,
      toggleRecitationVisible,
    ],
  );

  const animatedContentStyle = useMemo(
    () => ({
      opacity: packVm.transition,
      transform: [
        {
          translateX: packVm.transition.interpolate({
            inputRange: [0, 1],
            outputRange: [pageDirection * 18, 0],
          }),
        },
      ],
    }),
    [packVm.transition, pageDirection],
  );

  return {
    header: {
      title: packVm.pageData?.surahName ?? "The Qur'an",
      subtitle: packVm.pageData?.rangeLabel ?? `Page ${currentPage}`,
      translationEnabled,
    },
    content: {
      packState: packVm.packState,
      loadingPage: packVm.loadingPage,
      pageError: packVm.pageError,
      pageData: packVm.pageData,
      animatedContentStyle,
      hasWordData: pageVm.hasWordData,
      groupedLines: pageVm.groupedLines,
      displayVerses: pageVm.displayVerses,
      arabicFontSize: pageVm.arabicFontSize,
      arabicLineHeight: pageVm.arabicLineHeight,
      translationFontSize: pageVm.translationFontSize,
    },
    progress: {
      pendingSchedulesCount: focusSessionVm.pendingSchedulesCount,
    },
    navigation: {
      currentPage,
      totalPages: QURAN_TOTAL_PAGES,
      canGoNext: currentPage < QURAN_TOTAL_PAGES,
      canGoPrevious: currentPage > 1,
    },
    search: {
      visible: searchVisible,
    },
    refresh: {
      refreshing,
    },
    pack: {
      error: packVm.packError,
      downloadProgress: packVm.downloadProgress,
    },
    recitation: {
      visible: recitationVisible,
      verseKeys: pageVm.verseKeys,
      requestNextPageVerse: pageVm.requestNextPageVerse,
    },
    actions,
    readingMode,
  };
};
