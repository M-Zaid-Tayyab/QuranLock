import { colors } from "@/constants/colors";
import {
  VERSE_MIN_BOTTOM_PADDING_PERCENT,
  VERSE_SCROLL_EDGE_PADDING,
} from "@/constants/verse";
import type { QuranWord } from "@/services/quranPack";
import { useVerseStore } from "@/store/verse";
import { useCallback, useMemo, useRef, type RefObject } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { heightPercentageToDP } from "react-native-responsive-screen";
import { MushafTranslationPanel } from "./MushafTranslationPanel";
import { MushafVerseFlow } from "./MushafVerseFlow";
import { MushafWordLines } from "./MushafWordLines";
import type { DisplayVerse, PackState, ReadingMode } from "./types";
import { VerseCard } from "./VerseCard";
import { VersePackCard } from "./VersePackCard";

interface VerseContentPaneProps {
  scrollViewRef: RefObject<ScrollView | null>;
  packState: PackState;
  packError: string | null;
  downloadProgress: number;
  onDownloadPack: () => void;
  loadingPage: boolean;
  pageError: string | null;
  hasPageData: boolean;
  animatedContentStyle: any;
  readingMode: ReadingMode;
  hasWordData: boolean;
  groupedLines: [number, QuranWord[]][];
  displayVerses: DisplayVerse[];
  translationEnabled: boolean;
  arabicFontSize: number;
  arabicLineHeight: number;
  translationFontSize: number;
  bottomOverlayHeight: number;
  onSelectVerse: (verseKey: string) => void;
  onRedownloadPack: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onViewportHeightChange: (height: number) => void;
  onScrollYChange: (y: number) => void;
  onRegisterVerseLayout: (
    verseKey: string,
    fragmentKey: string,
    y: number,
    height: number,
  ) => void;
  onContentLayoutReady: () => void;
}

interface StudyVerseListItemProps {
  verse: DisplayVerse;
  translationEnabled: boolean;
  arabicFontSize: number;
  arabicLineHeight: number;
  translationFontSize: number;
  onSelectVerse: (verseKey: string) => void;
}

function StudyVerseListItem({
  verse,
  translationEnabled,
  arabicFontSize,
  arabicLineHeight,
  translationFontSize,
  onSelectVerse,
}: StudyVerseListItemProps) {
  const isSelected = useVerseStore((s) => s.selectedVerseKey === verse.key);
  return (
    <VerseCard
      verse={verse}
      isSelected={isSelected}
      translationEnabled={translationEnabled}
      arabicFontSize={arabicFontSize}
      arabicLineHeight={arabicLineHeight}
      translationFontSize={translationFontSize}
      onSelectVerse={onSelectVerse}
    />
  );
}

export function VerseContentPane({
  scrollViewRef,
  packState,
  packError,
  downloadProgress,
  onDownloadPack,
  loadingPage,
  pageError,
  hasPageData,
  animatedContentStyle,
  readingMode,
  hasWordData,
  groupedLines,
  displayVerses,
  translationEnabled,
  arabicFontSize,
  arabicLineHeight,
  translationFontSize,
  bottomOverlayHeight,
  onSelectVerse,
  onRedownloadPack,
  refreshing,
  onRefresh,
  onViewportHeightChange,
  onScrollYChange,
  onRegisterVerseLayout,
  onContentLayoutReady,
}: VerseContentPaneProps) {
  const selectedVerseKeyForMushaf = useVerseStore(
    useCallback(
      (s) => (readingMode === "mushaf" ? s.selectedVerseKey : null),
      [readingMode],
    ),
  );
  const contentContainerYRef = useRef(0);
  const contentBodyYRef = useRef(0);
  const mushafWordSectionYRef = useRef(0);
  const mushafFlowSectionYRef = useRef(0);
  const studyLayoutKey = [
    translationEnabled,
    arabicFontSize,
    arabicLineHeight,
    translationFontSize,
  ].join(":");
  const mushafLayoutKey = [
    hasWordData,
    arabicFontSize,
    arabicLineHeight,
    translationEnabled,
    translationFontSize,
  ].join(":");
  const bottomPadding = Math.max(
    heightPercentageToDP(VERSE_MIN_BOTTOM_PADDING_PERCENT),
    bottomOverlayHeight + VERSE_SCROLL_EDGE_PADDING,
  );
  const shouldUseStudyScrollView =
    packState === "ready" &&
    !loadingPage &&
    !pageError &&
    hasPageData &&
    readingMode === "study";
  const listContentContainerStyle = useMemo(
    () => ({
      paddingTop: VERSE_SCROLL_EDGE_PADDING,
      paddingHorizontal: 20,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding],
  );
  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onViewportHeightChange(event.nativeEvent.layout.height);
    },
    [onViewportHeightChange],
  );
  const handleListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      onScrollYChange(event.nativeEvent.contentOffset.y);
    },
    [onScrollYChange],
  );

  if (shouldUseStudyScrollView) {
    return (
      <View className="flex-1 px-6">
        <View className="mt-6 flex-1 overflow-hidden rounded-3xl border border-outline bg-surface">
          <Animated.View className="flex-1" style={animatedContentStyle}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={listContentContainerStyle}
              showsVerticalScrollIndicator={false}
              onLayout={handleListLayout}
              onContentSizeChange={onContentLayoutReady}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            >
              {displayVerses.map((verse, index) => (
                <View
                  key={`${studyLayoutKey}:${verse.key}`}
                  className={index === 0 ? undefined : "mt-6"}
                  onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout;
                    onRegisterVerseLayout(verse.key, verse.key, y, height);
                  }}
                >
                  <StudyVerseListItem
                    verse={verse}
                    translationEnabled={translationEnabled}
                    arabicFontSize={arabicFontSize}
                    arabicLineHeight={arabicLineHeight}
                    translationFontSize={translationFontSize}
                    onSelectVerse={onSelectVerse}
                  />
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 px-6 mt-4"
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      onLayout={(event) => {
        onViewportHeightChange(event.nativeEvent.layout.height);
      }}
      onContentSizeChange={onContentLayoutReady}
      onScroll={(event) => {
        onScrollYChange(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={16}
    >
      {packState !== "ready" && (
        <VersePackCard
          packState={packState}
          packError={packError}
          downloadProgress={downloadProgress}
          onDownload={onDownloadPack}
        />
      )}

      {packState === "ready" && (
        <View
          className="mt-6 rounded-3xl border border-outline bg-surface px-5 py-6"
          onLayout={(event) => {
            contentContainerYRef.current = event.nativeEvent.layout.y;
          }}
        >
          {loadingPage && (
            <View className="items-center py-6">
              <ActivityIndicator />
              <Text className="mt-3 text-sm font-sfPro text-muted">
                Loading page…
              </Text>
            </View>
          )}

          {!loadingPage && pageError && (
            <View className="items-center">
              <Text className="text-center text-sm font-sfPro text-error">
                {pageError}
              </Text>
              <Pressable
                onPress={onRedownloadPack}
                className="mt-4 rounded-full bg-primary px-5 py-2"
              >
                <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
                  Redownload pack
                </Text>
              </Pressable>
            </View>
          )}

          {!loadingPage && !pageError && !hasPageData && (
            <Text className="text-center text-sm font-sfPro text-muted">
              Page data not found.
            </Text>
          )}

          {hasPageData && (
            <Animated.View
              className="gap-4"
              style={animatedContentStyle}
              onLayout={(event) => {
                contentBodyYRef.current = event.nativeEvent.layout.y;
              }}
            >
              {readingMode === "mushaf" ? (
                <View key={mushafLayoutKey}>
                  {hasWordData ? (
                    <View
                      onLayout={(event) => {
                        mushafWordSectionYRef.current =
                          event.nativeEvent.layout.y;
                      }}
                    >
                      <MushafWordLines
                        groupedLines={groupedLines}
                        selectedVerseKey={selectedVerseKeyForMushaf}
                        arabicFontSize={arabicFontSize}
                        arabicLineHeight={arabicLineHeight}
                        onSelectVerse={onSelectVerse}
                        onVerseLayout={(verseKey, fragmentKey, y, height) => {
                          onRegisterVerseLayout(
                            verseKey,
                            fragmentKey,
                            contentContainerYRef.current +
                              contentBodyYRef.current +
                              mushafWordSectionYRef.current +
                              y,
                            height,
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
                        verses={displayVerses}
                        selectedVerseKey={selectedVerseKeyForMushaf}
                        arabicFontSize={arabicFontSize}
                        arabicLineHeight={arabicLineHeight}
                        onSelectVerse={onSelectVerse}
                        onVerseLayout={(verseKey, fragmentKey, y, height) => {
                          onRegisterVerseLayout(
                            verseKey,
                            fragmentKey,
                            contentContainerYRef.current +
                              contentBodyYRef.current +
                              mushafFlowSectionYRef.current +
                              y,
                            height,
                          );
                        }}
                      />
                    </View>
                  )}
                  {translationEnabled && (
                    <View>
                      <MushafTranslationPanel
                        verses={displayVerses}
                        selectedVerseKey={selectedVerseKeyForMushaf}
                        translationFontSize={translationFontSize}
                        onSelectVerse={onSelectVerse}
                      />
                    </View>
                  )}
                </View>
              ) : (
                <View className="gap-4" />
              )}
            </Animated.View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
