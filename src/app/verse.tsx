import {
  VerseBottomBarPane,
  VerseContentPane,
  VerseHeader,
  VerseRecitationPane,
  VerseSearchModal,
  VerseSettingsSheet,
} from "@/components/verse";
import { VERSE_SCROLL_EDGE_PADDING } from "@/constants/verse";
import { useVerseScreen } from "@/hooks/verse";
import { useVerseStore } from "@/store/verse";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ScrollView, View } from "react-native";

interface VerseLayoutBounds {
  top: number;
  bottom: number;
}

interface PendingAutoScroll {
  verseKey: string;
  animated: boolean;
}

export default function VerseScreen() {
  const vm = useVerseScreen();
  const isFocused = useIsFocused();
  const settingsSheetRef = useRef<GorhomBottomSheetModal | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const verseLayoutFragmentsRef = useRef<
    Map<string, Map<string, VerseLayoutBounds>>
  >(new Map());
  const expectedVerseLayoutCountsRef = useRef<Map<string, number>>(new Map());
  const pendingAutoScrollRef = useRef<PendingAutoScroll | null>(null);
  const contentLayoutReadyRef = useRef(false);
  const initialScrollPendingRef = useRef(true);
  const suppressAutoScrollOnceRef = useRef(false);
  const scrollMetricsRef = useRef({ y: 0, viewportHeight: 0 });
  const bottomOverlayHeightRef = useRef(0);
  const selectedVerseKeyRef = useRef<string | null>(
    useVerseStore.getState().selectedVerseKey,
  );
  const [bottomOverlayHeight, setBottomOverlayHeight] = useState(0);
  const handleOpenSettings = useCallback(() => {
    settingsSheetRef.current?.present();
  }, []);

  const handleCloseSettings = useCallback(() => {
    settingsSheetRef.current?.dismiss();
  }, []);

  const handleOpenSearchFromSettings = useCallback(() => {
    settingsSheetRef.current?.dismiss();
    vm.actions.openSearch();
  }, [vm.actions.openSearch]);

  const tryAutoScrollToVerse = useCallback(
    (verseKey: string, animated: boolean) => {
      const scrollView = scrollViewRef.current;
      if (
        !scrollView ||
        !contentLayoutReadyRef.current ||
        bottomOverlayHeightRef.current <= 0
      ) {
        return false;
      }
      const fragments = verseLayoutFragmentsRef.current.get(verseKey);
      const expectedFragmentCount =
        expectedVerseLayoutCountsRef.current.get(verseKey);
      if (
        !fragments ||
        expectedFragmentCount == null ||
        fragments.size < expectedFragmentCount
      ) {
        return false;
      }

      let verseTop = Number.POSITIVE_INFINITY;
      let verseBottom = Number.NEGATIVE_INFINITY;
      fragments.forEach((fragment) => {
        verseTop = Math.min(verseTop, fragment.top);
        verseBottom = Math.max(verseBottom, fragment.bottom);
      });

      const { y: scrollY, viewportHeight } = scrollMetricsRef.current;
      if (viewportHeight <= 0) {
        return false;
      }

      const overlayOffset = bottomOverlayHeightRef.current;
      const usableViewportHeight = Math.max(
        140,
        viewportHeight - overlayOffset,
      );
      const verseCenter = (verseTop + verseBottom) / 2;
      const viewportCenter = scrollY + usableViewportHeight / 2;
      const centerTolerance = Math.max(
        40,
        Math.min(96, usableViewportHeight * 0.12),
      );
      const isNearCenter =
        Math.abs(verseCenter - viewportCenter) <= centerTolerance;
      if (animated && isNearCenter) {
        return true;
      }

      const centeredTargetY = verseCenter - usableViewportHeight / 2;
      const topProtectedTargetY = verseTop - VERSE_SCROLL_EDGE_PADDING;
      const targetY = Math.max(
        0,
        Math.min(centeredTargetY, topProtectedTargetY),
      );
      if (animated && Math.abs(targetY - scrollY) < 12) {
        return true;
      }

      scrollView.scrollTo({ y: targetY, animated });
      return true;
    },
    [],
  );

  const attemptPendingAutoScroll = useCallback(() => {
    const pendingAutoScroll = pendingAutoScrollRef.current;
    if (!isFocused || !pendingAutoScroll) {
      return false;
    }
    const didScroll = tryAutoScrollToVerse(
      pendingAutoScroll.verseKey,
      pendingAutoScroll.animated,
    );
    if (didScroll && pendingAutoScroll.animated) {
      initialScrollPendingRef.current = false;
    }
    if (didScroll && pendingAutoScrollRef.current === pendingAutoScroll) {
      pendingAutoScrollRef.current = null;
    }
    return didScroll;
  }, [isFocused, tryAutoScrollToVerse]);

  const registerVerseLayout = useCallback(
    (verseKey: string, fragmentKey: string, y: number, height: number) => {
      const fragments =
        verseLayoutFragmentsRef.current.get(verseKey) ?? new Map();
      fragments.set(fragmentKey, { top: y, bottom: y + height });
      verseLayoutFragmentsRef.current.set(verseKey, fragments);

      if (pendingAutoScrollRef.current?.verseKey === verseKey) {
        attemptPendingAutoScroll();
      }
    },
    [attemptPendingAutoScroll],
  );

  const handleViewportHeightChange = useCallback(
    (height: number) => {
      scrollMetricsRef.current.viewportHeight = height;
      attemptPendingAutoScroll();
    },
    [attemptPendingAutoScroll],
  );

  const handleContentLayoutReady = useCallback(() => {
    contentLayoutReadyRef.current = true;
    attemptPendingAutoScroll();
  }, [attemptPendingAutoScroll]);

  const handleScrollYChange = useCallback((y: number) => {
    scrollMetricsRef.current.y = y;
  }, []);

  const handleBottomOverlayHeightChange = useCallback((height: number) => {
    bottomOverlayHeightRef.current = height;
    setBottomOverlayHeight(height);
  }, []);

  const scrollToSelectedVerse = useCallback(
    (bypassSuppress: boolean, animated: boolean) => {
      const selectedVerseKey = selectedVerseKeyRef.current;
      if (!selectedVerseKey) {
        return false;
      }
      if (suppressAutoScrollOnceRef.current && !bypassSuppress) {
        suppressAutoScrollOnceRef.current = false;
        return false;
      }
      pendingAutoScrollRef.current = { verseKey: selectedVerseKey, animated };
      return attemptPendingAutoScroll();
    },
    [attemptPendingAutoScroll],
  );

  const attemptAutoScrollToSelectedVerse = useCallback(
    () => scrollToSelectedVerse(false, true),
    [scrollToSelectedVerse],
  );

  const attemptEntryAutoScrollToSelectedVerse = useCallback(() => {
    scrollToSelectedVerse(true, initialScrollPendingRef.current);
  }, [scrollToSelectedVerse]);

  const handleRecitationPlayingChange = useCallback(
    (isPlaying: boolean) => {
      if (!isPlaying) {
        return;
      }
      attemptAutoScrollToSelectedVerse();
    },
    [attemptAutoScrollToSelectedVerse],
  );

  useEffect(() => {
    if (!isFocused) {
      pendingAutoScrollRef.current = null;
      return;
    }
    attemptEntryAutoScrollToSelectedVerse();
  }, [attemptEntryAutoScrollToSelectedVerse, isFocused]);

  useLayoutEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    scrollMetricsRef.current.y = 0;
    suppressAutoScrollOnceRef.current = true;
  }, [vm.navigation.currentPage]);

  useLayoutEffect(() => {
    const expectedVerseLayoutCounts = new Map<string, number>();
    const hasCurrentPageData =
      vm.content.pageData?.page === vm.navigation.currentPage &&
      !vm.content.loadingPage;

    if (hasCurrentPageData) {
      if (vm.readingMode === "study" || !vm.content.hasWordData) {
        vm.content.displayVerses.forEach((verse) => {
          expectedVerseLayoutCounts.set(verse.key, 1);
        });
      } else {
        vm.content.groupedLines.forEach(([, words]) => {
          const verseKeys = new Set(words.map((word) => word.verseKey));
          verseKeys.forEach((verseKey) => {
            expectedVerseLayoutCounts.set(
              verseKey,
              (expectedVerseLayoutCounts.get(verseKey) ?? 0) + 1,
            );
          });
        });
      }
    }

    expectedVerseLayoutCountsRef.current = expectedVerseLayoutCounts;
    verseLayoutFragmentsRef.current.clear();
    contentLayoutReadyRef.current = false;
    const selectedVerseKey = useVerseStore.getState().selectedVerseKey;
    selectedVerseKeyRef.current = selectedVerseKey;
    const existingPendingAutoScroll = pendingAutoScrollRef.current;
    pendingAutoScrollRef.current =
      selectedVerseKey && expectedVerseLayoutCounts.has(selectedVerseKey)
        ? {
            verseKey: selectedVerseKey,
            animated:
              existingPendingAutoScroll?.verseKey === selectedVerseKey
                ? existingPendingAutoScroll.animated
                : initialScrollPendingRef.current,
          }
        : null;
  }, [
    vm.navigation.currentPage,
    vm.readingMode,
    vm.content.pageData,
    vm.content.loadingPage,
    vm.content.hasWordData,
    vm.content.groupedLines,
    vm.content.displayVerses,
    vm.content.arabicFontSize,
    vm.content.arabicLineHeight,
    vm.content.translationFontSize,
    vm.header.translationEnabled,
  ]);

  useLayoutEffect(() => {
    const selectedVerseKey = selectedVerseKeyRef.current;
    if (
      bottomOverlayHeight <= 0 ||
      !selectedVerseKey ||
      !expectedVerseLayoutCountsRef.current.has(selectedVerseKey)
    ) {
      return;
    }
    const existingPendingAutoScroll = pendingAutoScrollRef.current;
    pendingAutoScrollRef.current = {
      verseKey: selectedVerseKey,
      animated:
        existingPendingAutoScroll?.verseKey === selectedVerseKey
          ? existingPendingAutoScroll.animated
          : initialScrollPendingRef.current,
    };
    attemptPendingAutoScroll();
  }, [attemptPendingAutoScroll, bottomOverlayHeight]);

  useEffect(() => {
    const unsubscribe = useVerseStore.subscribe((state, previousState) => {
      if (state.selectedVerseKey === previousState.selectedVerseKey) {
        return;
      }
      const selectedVerseKey = state.selectedVerseKey;
      selectedVerseKeyRef.current = selectedVerseKey;
      if (!selectedVerseKey) {
        return;
      }
      if (!isFocused) {
        return;
      }
      attemptAutoScrollToSelectedVerse();
    });
    return unsubscribe;
  }, [attemptAutoScrollToSelectedVerse, isFocused]);

  return (
    <View className="flex-1 bg-background py-safe">
      <VerseHeader
        title={vm.header.title}
        subtitle={vm.header.subtitle}
        onBack={vm.actions.goBack}
        onOpenSettings={handleOpenSettings}
      />

      <VerseRecitationPane
        visible={
          isFocused && vm.content.packState === "ready" && vm.recitation.visible
        }
        verseKeys={vm.recitation.verseKeys}
        onSelectVerse={vm.actions.selectVerse}
        onRequestNextPageVerse={vm.recitation.requestNextPageVerse}
        onPlayingChange={handleRecitationPlayingChange}
      />

      <VerseContentPane
        scrollViewRef={scrollViewRef}
        packState={vm.content.packState}
        packError={vm.pack.error}
        downloadProgress={vm.pack.downloadProgress}
        onDownloadPack={vm.actions.downloadPack}
        loadingPage={vm.content.loadingPage}
        pageError={vm.content.pageError}
        hasPageData={Boolean(vm.content.pageData)}
        animatedContentStyle={vm.content.animatedContentStyle}
        readingMode={vm.readingMode}
        hasWordData={vm.content.hasWordData}
        groupedLines={vm.content.groupedLines}
        displayVerses={vm.content.displayVerses}
        translationEnabled={vm.header.translationEnabled}
        arabicFontSize={vm.content.arabicFontSize}
        arabicLineHeight={vm.content.arabicLineHeight}
        translationFontSize={vm.content.translationFontSize}
        bottomOverlayHeight={bottomOverlayHeight}
        onSelectVerse={vm.actions.selectVerse}
        onRedownloadPack={vm.actions.redownloadPack}
        refreshing={vm.refresh.refreshing}
        onRefresh={vm.actions.refreshVerse}
        onViewportHeightChange={handleViewportHeightChange}
        onScrollYChange={handleScrollYChange}
        onRegisterVerseLayout={registerVerseLayout}
        onContentLayoutReady={handleContentLayoutReady}
      />

      <VerseBottomBarPane
        visible={vm.content.packState === "ready"}
        currentPage={vm.navigation.currentPage}
        totalPages={vm.navigation.totalPages}
        canGoNext={vm.navigation.canGoNext}
        canGoPrevious={vm.navigation.canGoPrevious}
        onNext={vm.actions.goNextPage}
        onPrevious={vm.actions.goPreviousPage}
        pendingSchedulesCount={vm.progress.pendingSchedulesCount}
        onMeasuredHeight={handleBottomOverlayHeightChange}
      />

      <VerseSearchModal
        visible={vm.search.visible}
        onClose={vm.actions.closeSearch}
        onPickResult={vm.actions.pickSearchResult}
      />

      <VerseSettingsSheet
        sheetRef={settingsSheetRef}
        readingMode={vm.readingMode}
        recitationVisible={vm.recitation.visible}
        translationEnabled={vm.header.translationEnabled}
        onSetReadingMode={vm.actions.setReadingMode}
        onToggleRecitationVisible={vm.actions.toggleRecitationVisible}
        onToggleTranslation={vm.actions.toggleTranslation}
        onIncreaseFont={vm.actions.increaseFont}
        onDecreaseFont={vm.actions.decreaseFont}
        onOpenSearch={handleOpenSearchFromSettings}
        onClose={handleCloseSettings}
      />
    </View>
  );
}
