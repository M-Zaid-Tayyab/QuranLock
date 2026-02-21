import {
  MushafTranslationPanel,
  MushafVerseFlow,
  MushafWordLines,
  VerseCard,
  VerseHeader,
  VerseNavigationBar,
  VersePackCard,
  VerseRecitationControls,
  VerseSearchModal,
  VerseSettingsSheet,
} from "@/components/verse";
import { useVerseScreen } from "@/hooks/verse";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

export default function VerseScreen() {
  const vm = useVerseScreen();
  const settingsSheetRef = useRef<GorhomBottomSheetModal | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const verseLayoutsRef = useRef<Map<string, { y: number; height: number }>>(
    new Map(),
  );
  const pendingAutoScrollVerseKeyRef = useRef<string | null>(null);
  const suppressAutoScrollOnceRef = useRef(false);
  const scrollMetricsRef = useRef({ y: 0, viewportHeight: 0 });
  const bottomOverlayHeightRef = useRef(0);
  const contentContainerYRef = useRef(0);
  const studySectionYRef = useRef(0);
  const mushafWordSectionYRef = useRef(0);
  const mushafFlowSectionYRef = useRef(0);
  const translationSectionYRef = useRef(0);

  const handleOpenSettings = useCallback(() => {
    settingsSheetRef.current?.present();
  }, []);

  const handleCloseSettings = useCallback(() => {
    settingsSheetRef.current?.dismiss();
  }, []);

  const handleOpenSearchFromSettings = useCallback(() => {
    settingsSheetRef.current?.dismiss();
    vm.actions.openSearch();
  }, [vm.actions]);

  const tryAutoScrollToVerse = useCallback((verseKey: string) => {
    const layout = verseLayoutsRef.current.get(verseKey);
    const scrollView = scrollViewRef.current;
    if (!layout || !scrollView) {
      return false;
    }

    const { y: scrollY, viewportHeight } = scrollMetricsRef.current;
    if (viewportHeight <= 0) {
      return false;
    }

    const overlayOffset = bottomOverlayHeightRef.current + 24;
    const usableViewportHeight = Math.max(140, viewportHeight - overlayOffset);
    const verseCenter = layout.y + layout.height / 2;
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

    scrollView.scrollTo({
      y: targetY,
      animated: true,
    });
    return true;
  }, []);

  const registerVerseLayout = useCallback(
    (verseKey: string, y: number, height: number) => {
      const existing = verseLayoutsRef.current.get(verseKey);
      if (!existing) {
        verseLayoutsRef.current.set(verseKey, { y, height });
      } else {
        verseLayoutsRef.current.set(verseKey, {
          y: Math.min(existing.y, y),
          height,
        });
      }

      if (pendingAutoScrollVerseKeyRef.current === verseKey) {
        const didScroll = tryAutoScrollToVerse(verseKey);
        if (didScroll) {
          pendingAutoScrollVerseKeyRef.current = null;
        }
      }
    },
    [tryAutoScrollToVerse],
  );

  const registerVerseLayoutWithBase = useCallback(
    (verseKey: string, y: number, height: number, baseY: number) => {
      registerVerseLayout(verseKey, baseY + y, height);
    },
    [registerVerseLayout],
  );

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
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
    const selectedVerseKey = vm.content.selectedVerseKey;
    if (!selectedVerseKey || !vm.recitation.isPlaying) return;
    if (suppressAutoScrollOnceRef.current) {
      suppressAutoScrollOnceRef.current = false;
      return;
    }
    const didScroll = tryAutoScrollToVerse(selectedVerseKey);
    pendingAutoScrollVerseKeyRef.current = didScroll ? null : selectedVerseKey;
  }, [vm.content.selectedVerseKey, vm.recitation.isPlaying]);

  return (
    <View className="flex-1 bg-background py-safe">
      <VerseHeader
        title={vm.header.title}
        subtitle={vm.header.subtitle}
        onBack={vm.actions.goBack}
        onOpenSettings={handleOpenSettings}
      />

      {vm.content.packState === "ready" && vm.recitation.visible && (
        <VerseRecitationControls
          selectedVerseKey={vm.content.selectedVerseKey}
          playbackRate={vm.recitation.playbackRate}
          isLoadingAudio={vm.recitation.isLoadingAudio}
          isPlaying={vm.recitation.isPlaying}
          error={vm.recitation.error}
          canGoNext={vm.recitation.canGoNext}
          canGoPrevious={vm.recitation.canGoPrevious}
          positionLabel={vm.recitation.positionLabel}
          durationLabel={vm.recitation.durationLabel}
          onTogglePlayback={vm.actions.toggleRecitationPlayback}
          onPlayNext={vm.actions.playNextRecitationVerse}
          onPlayPrevious={vm.actions.playPreviousRecitationVerse}
          onCycleRate={vm.actions.cycleRecitationRate}
        />
      )}

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-6"
        contentContainerStyle={
          vm.progress.pendingSchedulesCount > 0
            ? { paddingBottom: 200 }
            : { paddingBottom: 40 }
        }
        showsVerticalScrollIndicator={false}
        onLayout={(event) => {
          scrollMetricsRef.current.viewportHeight =
            event.nativeEvent.layout.height;
        }}
        onScroll={(event) => {
          scrollMetricsRef.current.y = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {vm.content.packState !== "ready" && (
          <VersePackCard
            packState={vm.content.packState}
            packError={vm.pack.error}
            downloadProgress={vm.pack.downloadProgress}
            onDownload={vm.actions.downloadPack}
          />
        )}

        {vm.content.packState === "ready" && (
          <View
            className="mt-6 rounded-3xl border border-outline bg-surface px-5 py-6"
            onLayout={(event) => {
              contentContainerYRef.current = event.nativeEvent.layout.y;
            }}
          >
            {vm.content.loadingPage && (
              <View className="items-center py-6">
                <ActivityIndicator />
                <Text className="mt-3 text-sm font-sfPro text-muted">
                  Loading page…
                </Text>
              </View>
            )}

            {!vm.content.loadingPage && vm.content.pageError && (
              <View className="items-center">
                <Text className="text-center text-sm font-sfPro text-error">
                  {vm.content.pageError}
                </Text>
                <Pressable
                  onPress={vm.actions.redownloadPack}
                  className="mt-4 rounded-full bg-primary px-5 py-2"
                >
                  <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
                    Redownload pack
                  </Text>
                </Pressable>
              </View>
            )}

            {!vm.content.loadingPage &&
              !vm.content.pageError &&
              !vm.content.pageData && (
                <Text className="text-center text-sm font-sfPro text-muted">
                  Page data not found.
                </Text>
              )}

            {vm.content.pageData && (
              <Animated.View
                className="gap-4"
                style={vm.content.animatedContentStyle}
              >
                {vm.readingMode === "mushaf" ? (
                  <View>
                    {vm.content.hasWordData ? (
                      <View
                        onLayout={(event) => {
                          mushafWordSectionYRef.current =
                            event.nativeEvent.layout.y;
                        }}
                      >
                        <MushafWordLines
                          groupedLines={vm.content.groupedLines}
                          selectedVerseKey={vm.content.selectedVerseKey}
                          arabicFontSize={vm.content.arabicFontSize}
                          arabicLineHeight={vm.content.arabicLineHeight}
                          onSelectVerse={vm.actions.selectVerse}
                          onVerseLayout={(verseKey, y, height) => {
                            registerVerseLayoutWithBase(
                              verseKey,
                              y,
                              height,
                              contentContainerYRef.current +
                                mushafWordSectionYRef.current,
                            );
                          }}
                        />
                      </View>
                    ) : (
                      <View
                        onLayout={(event) => {
                          mushafFlowSectionYRef.current =
                            event.nativeEvent.layout.y;
                        }}
                      >
                        <MushafVerseFlow
                          verses={vm.content.displayVerses}
                          selectedVerseKey={vm.content.selectedVerseKey}
                          arabicFontSize={vm.content.arabicFontSize}
                          arabicLineHeight={vm.content.arabicLineHeight}
                          onSelectVerse={vm.actions.selectVerse}
                          onVerseLayout={(verseKey, y, height) => {
                            registerVerseLayoutWithBase(
                              verseKey,
                              y,
                              height,
                              contentContainerYRef.current +
                                mushafFlowSectionYRef.current,
                            );
                          }}
                        />
                      </View>
                    )}
                    {vm.header.translationEnabled && (
                      <View
                        onLayout={(event) => {
                          translationSectionYRef.current =
                            event.nativeEvent.layout.y;
                        }}
                      >
                        <MushafTranslationPanel
                          verses={vm.content.displayVerses}
                          selectedVerseKey={vm.content.selectedVerseKey}
                          translationFontSize={vm.content.translationFontSize}
                          onSelectVerse={vm.actions.selectVerse}
                          onVerseLayout={(verseKey, y, height) => {
                            registerVerseLayoutWithBase(
                              verseKey,
                              y,
                              height,
                              contentContainerYRef.current +
                                translationSectionYRef.current,
                            );
                          }}
                        />
                      </View>
                    )}
                  </View>
                ) : (
                  <View
                    className="gap-4"
                    onLayout={(event) => {
                      studySectionYRef.current = event.nativeEvent.layout.y;
                    }}
                  >
                    {vm.content.displayVerses.map((verse) => (
                      <View
                        key={verse.key}
                        onLayout={(event) => {
                          registerVerseLayoutWithBase(
                            verse.key,
                            event.nativeEvent.layout.y,
                            event.nativeEvent.layout.height,
                            contentContainerYRef.current +
                              studySectionYRef.current,
                          );
                        }}
                      >
                        <VerseCard
                          verse={verse}
                          isSelected={vm.content.selectedVerseKey === verse.key}
                          translationEnabled={vm.header.translationEnabled}
                          arabicFontSize={vm.content.arabicFontSize}
                          arabicLineHeight={vm.content.arabicLineHeight}
                          translationFontSize={vm.content.translationFontSize}
                          onSelect={() => vm.actions.selectVerse(verse.key)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>

      {vm.content.packState === "ready" && (
        <VerseNavigationBar
          currentPage={vm.navigation.currentPage}
          totalPages={vm.navigation.totalPages}
          canGoNext={vm.navigation.canGoNext}
          canGoPrevious={vm.navigation.canGoPrevious}
          onNext={vm.actions.goNextPage}
          onPrevious={vm.actions.goPreviousPage}
          isBlockSessionActive={vm.progress.isBlockSessionActive}
          requiredMinutes={vm.progress.requiredMinutes}
          remainingMinutes={vm.progress.remainingMinutes}
          remainingSeconds={vm.progress.remainingSeconds}
          pendingSchedulesCount={vm.progress.pendingSchedulesCount}
          onMeasuredHeight={(height) => {
            bottomOverlayHeightRef.current = height;
          }}
        />
      )}

      <VerseSearchModal
        visible={vm.search.visible}
        query={vm.search.query}
        searching={vm.search.searching}
        error={vm.search.error}
        results={vm.search.results}
        onClose={vm.actions.closeSearch}
        onQueryChange={vm.actions.setSearchQuery}
        onPickResult={vm.actions.pickSearchResult}
      />

      <VerseSettingsSheet
        sheetRef={settingsSheetRef}
        readingMode={vm.readingMode}
        recitationVisible={vm.recitation.visible}
        recitationDownloadProgressPercent={
          vm.recitation.downloadProgressPercent
        }
        recitationDownloadCompletedChapters={
          vm.recitation.downloadCompletedChapters
        }
        recitationDownloadTotalChapters={vm.recitation.downloadTotalChapters}
        recitationDownloadCurrentChapter={vm.recitation.downloadCurrentChapter}
        recitationDownloadError={vm.recitation.downloadError}
        recitationDownloadInProgress={vm.recitation.isDownloadingOfflinePack}
        translationEnabled={vm.header.translationEnabled}
        onSetReadingMode={vm.actions.setReadingMode}
        onToggleRecitationVisible={vm.actions.toggleRecitationVisible}
        onResumeRecitationDownload={vm.actions.resumeRecitationDownload}
        onToggleTranslation={vm.actions.toggleTranslation}
        onIncreaseFont={vm.actions.increaseFont}
        onDecreaseFont={vm.actions.decreaseFont}
        onOpenSearch={handleOpenSearchFromSettings}
        onClose={handleCloseSettings}
      />
    </View>
  );
}
