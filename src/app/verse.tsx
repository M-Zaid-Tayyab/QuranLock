import {
  VerseBottomBarPane,
  VerseContentPane,
  VerseHeader,
  VerseRecitationPane,
  VerseSearchModal,
  VerseSettingsSheet,
  type VerseScrollableRef,
} from "@/components/verse";
import { useVerseScreen } from "@/hooks/verse";
import { useVerseStore } from "@/store/verse";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

export default function VerseScreen() {
  const vm = useVerseScreen();
  const isFocused = useIsFocused();
  const settingsSheetRef = useRef<GorhomBottomSheetModal | null>(null);
  const scrollViewRef = useRef<VerseScrollableRef | null>(null);
  const verseLayoutsRef = useRef<Map<string, { top: number; bottom: number }>>(
    new Map(),
  );
  const pendingAutoScrollVerseKeyRef = useRef<string | null>(null);
  const pendingEntryAutoScrollRef = useRef(false);
  const suppressAutoScrollOnceRef = useRef(false);
  const scrollMetricsRef = useRef({ y: 0, viewportHeight: 0 });
  const bottomOverlayHeightRef = useRef(0);
  const isRecitationPlayingRef = useRef(false);
  const selectedVerseKeyRef = useRef<string | null>(
    useVerseStore.getState().selectedVerseKey,
  );
  const studyVerseIndexByKey = useMemo(
    () =>
      new Map(vm.content.displayVerses.map((verse, index) => [verse.key, index])),
    [vm.content.displayVerses],
  );

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

  const tryAutoScrollToVerse = useCallback((verseKey: string) => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) {
      return false;
    }

    if (vm.readingMode === "study" && scrollView.scrollToIndex) {
      const targetIndex = studyVerseIndexByKey.get(verseKey) ?? -1;
      if (targetIndex < 0) {
        return false;
      }
      scrollView.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.5,
      });
      return true;
    }

    const bounds = verseLayoutsRef.current.get(verseKey);
    if (!bounds) {
      return false;
    }

    const { y: scrollY, viewportHeight } = scrollMetricsRef.current;
    if (viewportHeight <= 0) {
      return false;
    }

    const overlayOffset = bottomOverlayHeightRef.current + 24;
    const usableViewportHeight = Math.max(140, viewportHeight - overlayOffset);
    const verseCenter = (bounds.top + bounds.bottom) / 2;
    const viewportCenter = scrollY + usableViewportHeight / 2;
    const centerTolerance = Math.max(
      40,
      Math.min(96, usableViewportHeight * 0.12),
    );
    const isNearCenter =
      Math.abs(verseCenter - viewportCenter) <= centerTolerance;
    if (isNearCenter) {
      return true;
    }

    const targetY = Math.max(0, verseCenter - usableViewportHeight / 2);
    if (Math.abs(targetY - scrollY) < 12) {
      return true;
    }

    if (scrollView.scrollTo) {
      scrollView.scrollTo({
        y: targetY,
        animated: true,
      });
    } else if (scrollView.scrollToOffset) {
      scrollView.scrollToOffset({
        offset: targetY,
        animated: true,
      });
    }
    return true;
  }, [studyVerseIndexByKey, vm.readingMode]);

  const registerVerseLayout = useCallback(
    (verseKey: string, y: number, height: number) => {
      const nextTop = y;
      const nextBottom = y + height;
      const existing = verseLayoutsRef.current.get(verseKey);
      if (!existing) {
        verseLayoutsRef.current.set(verseKey, {
          top: nextTop,
          bottom: nextBottom,
        });
      } else {
        verseLayoutsRef.current.set(verseKey, {
          top: Math.min(existing.top, nextTop),
          bottom: Math.max(existing.bottom, nextBottom),
        });
      }

      if (pendingAutoScrollVerseKeyRef.current === verseKey) {
        const didScroll = tryAutoScrollToVerse(verseKey);
        if (didScroll) {
          pendingAutoScrollVerseKeyRef.current = null;
          pendingEntryAutoScrollRef.current = false;
        }
      }
    },
    [tryAutoScrollToVerse],
  );

  const handleViewportHeightChange = useCallback((height: number) => {
    scrollMetricsRef.current.viewportHeight = height;
  }, []);

  const handleScrollYChange = useCallback((y: number) => {
    scrollMetricsRef.current.y = y;
  }, []);

  const handleBottomOverlayHeightChange = useCallback((height: number) => {
    bottomOverlayHeightRef.current = height;
  }, []);

  const scrollToSelectedVerse = useCallback((bypassSuppress: boolean) => {
    const selectedVerseKey = selectedVerseKeyRef.current;
    if (!selectedVerseKey) {
      return false;
    }
    if (suppressAutoScrollOnceRef.current && !bypassSuppress) {
      suppressAutoScrollOnceRef.current = false;
      return false;
    }
    const didScroll = tryAutoScrollToVerse(selectedVerseKey);
    pendingAutoScrollVerseKeyRef.current = didScroll ? null : selectedVerseKey;
    return didScroll;
  }, [tryAutoScrollToVerse]);

  const attemptAutoScrollToSelectedVerse = useCallback(
    () => scrollToSelectedVerse(false),
    [scrollToSelectedVerse],
  );

  const attemptEntryAutoScrollToSelectedVerse = useCallback(() => {
    const didScroll = scrollToSelectedVerse(true);
    if (didScroll) {
      pendingEntryAutoScrollRef.current = false;
    }
  }, [scrollToSelectedVerse]);

  const handleStudyListLayout = useCallback(() => {
    if (!isFocused || !pendingEntryAutoScrollRef.current) {
      return;
    }
    attemptEntryAutoScrollToSelectedVerse();
  }, [attemptEntryAutoScrollToSelectedVerse, isFocused]);

  const handleRecitationPlayingChange = useCallback((isPlaying: boolean) => {
    isRecitationPlayingRef.current = isPlaying;
    if (!isPlaying) {
      return;
    }
    attemptAutoScrollToSelectedVerse();
  }, [attemptAutoScrollToSelectedVerse]);

  useEffect(() => {
    if (!isFocused) {
      pendingEntryAutoScrollRef.current = false;
      return;
    }
    pendingEntryAutoScrollRef.current = true;
    attemptEntryAutoScrollToSelectedVerse();
  }, [attemptEntryAutoScrollToSelectedVerse, isFocused]);

  useEffect(() => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false });
    } else if (scrollViewRef.current?.scrollToOffset) {
      scrollViewRef.current.scrollToOffset({ offset: 0, animated: false });
    }
    scrollMetricsRef.current.y = 0;
    suppressAutoScrollOnceRef.current = true;
  }, [vm.navigation.currentPage]);

  useEffect(() => {
    verseLayoutsRef.current.clear();
    pendingAutoScrollVerseKeyRef.current = null;
  }, [
    vm.navigation.currentPage,
    vm.readingMode,
    vm.content.hasWordData,
    vm.content.arabicFontSize,
    vm.content.translationFontSize,
    vm.header.translationEnabled,
  ]);

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
      if (pendingEntryAutoScrollRef.current) {
        attemptEntryAutoScrollToSelectedVerse();
        return;
      }
      if (isRecitationPlayingRef.current) {
        attemptAutoScrollToSelectedVerse();
      }
    });
    return unsubscribe;
  }, [attemptAutoScrollToSelectedVerse, attemptEntryAutoScrollToSelectedVerse]);

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
        pendingSchedulesCount={vm.progress.pendingSchedulesCount}
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
        onSelectVerse={vm.actions.selectVerse}
        onRedownloadPack={vm.actions.redownloadPack}
        onViewportHeightChange={handleViewportHeightChange}
        onScrollYChange={handleScrollYChange}
        onRegisterVerseLayout={registerVerseLayout}
        onStudyListLayout={handleStudyListLayout}
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
