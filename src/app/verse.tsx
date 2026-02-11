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
import { useCallback, useRef } from "react";
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
          reciters={vm.recitation.reciters}
          selectedReciterId={vm.recitation.selectedReciterId}
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
          onSelectReciter={vm.actions.setReciter}
        />
      )}

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={
          vm.progress.pendingSchedulesCount > 0
            ? { paddingBottom: 200 }
            : { paddingBottom: 40 }
        }
        showsVerticalScrollIndicator={false}
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
          <View className="mt-6 rounded-3xl border border-outline bg-surface px-5 py-6">
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
                      <MushafWordLines
                        groupedLines={vm.content.groupedLines}
                        selectedVerseKey={vm.content.selectedVerseKey}
                        arabicFontSize={vm.content.arabicFontSize}
                        arabicLineHeight={vm.content.arabicLineHeight}
                        onSelectVerse={vm.actions.selectVerse}
                      />
                    ) : (
                      <MushafVerseFlow
                        verses={vm.content.displayVerses}
                        selectedVerseKey={vm.content.selectedVerseKey}
                        arabicFontSize={vm.content.arabicFontSize}
                        arabicLineHeight={vm.content.arabicLineHeight}
                        onSelectVerse={vm.actions.selectVerse}
                      />
                    )}
                    {vm.header.translationEnabled && (
                      <MushafTranslationPanel
                        verses={vm.content.displayVerses}
                        selectedVerseKey={vm.content.selectedVerseKey}
                        translationFontSize={vm.content.translationFontSize}
                        onSelectVerse={vm.actions.selectVerse}
                      />
                    )}
                  </View>
                ) : (
                  <View className="gap-4">
                    {vm.content.displayVerses.map((verse) => (
                      <VerseCard
                        key={verse.key}
                        verse={verse}
                        isSelected={vm.content.selectedVerseKey === verse.key}
                        translationEnabled={vm.header.translationEnabled}
                        arabicFontSize={vm.content.arabicFontSize}
                        arabicLineHeight={vm.content.arabicLineHeight}
                        translationFontSize={vm.content.translationFontSize}
                        onSelect={() => vm.actions.selectVerse(verse.key)}
                      />
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
