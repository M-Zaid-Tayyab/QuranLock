import type { QuranWord } from "@/services/quranPack";
import { colors } from "@/constants/colors";
import { useBlockingStore } from "@/store/blocking";
import { useVerseStore } from "@/store/verse";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
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
import { useShallow } from "zustand/react/shallow";
import { MushafTranslationPanel } from "./MushafTranslationPanel";
import { MushafVerseFlow } from "./MushafVerseFlow";
import { MushafWordLines } from "./MushafWordLines";
import type { DisplayVerse, PackState, ReadingMode } from "./types";
import { VerseCard } from "./VerseCard";
import { VersePackCard } from "./VersePackCard";

export interface VerseScrollableRef {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
  scrollToEnd?: (options?: { animated?: boolean }) => void;
  scrollToIndex?: (options: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
    viewOffset?: number;
  }) => void | Promise<void>;
}

interface VerseContentPaneProps {
  scrollViewRef: RefObject<VerseScrollableRef | null>;
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
  onSelectVerse: (verseKey: string) => void;
  onRedownloadPack: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onViewportHeightChange: (height: number) => void;
  onScrollYChange: (y: number) => void;
  onRegisterVerseLayout: (verseKey: string, y: number, height: number) => void;
  onStudyListLayout: () => void;
}

interface StudyVerseExtraData {
  translationEnabled: boolean;
  arabicFontSize: number;
  arabicLineHeight: number;
  translationFontSize: number;
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

function StudyItemSeparator() {
  return <View className="py-3" />;
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
  onSelectVerse,
  onRedownloadPack,
  refreshing,
  onRefresh,
  onViewportHeightChange,
  onScrollYChange,
  onRegisterVerseLayout,
  onStudyListLayout,
}: VerseContentPaneProps) {
  const selectedVerseKeyForMushaf = useVerseStore(
    useCallback(
      (s) => (readingMode === "mushaf" ? s.selectedVerseKey : null),
      [readingMode],
    ),
  );
  const contentContainerYRef = useRef(0);
  const mushafWordSectionYRef = useRef(0);
  const mushafFlowSectionYRef = useRef(0);
  const translationSectionYRef = useRef(0);
  const {
    activeScheduleId,
    requiredQuranMinutes,
    quranMinutesToUnblock,
    lastBlockedAt,
  } = useBlockingStore(
    useShallow((s) => ({
      activeScheduleId: s.activeScheduleId,
      requiredQuranMinutes: s.requiredQuranMinutes,
      quranMinutesToUnblock: s.quranMinutesToUnblock,
      lastBlockedAt: s.lastBlockedAt,
    })),
  );
  const requiredMinutes =
    requiredQuranMinutes > 0
      ? requiredQuranMinutes
      : lastBlockedAt != null
        ? quranMinutesToUnblock
        : 0;
  const hasBottomTimer =
    packState === "ready" && activeScheduleId != null && requiredMinutes > 0;
  const bottomPadding = hasBottomTimer
    ? heightPercentageToDP(18)
    : heightPercentageToDP(9);
  const shouldUseStudyFlashList =
    packState === "ready" &&
    !loadingPage &&
    !pageError &&
    hasPageData &&
    readingMode === "study";
  const studyExtraData = useMemo<StudyVerseExtraData>(
    () => ({
      translationEnabled,
      arabicFontSize,
      arabicLineHeight,
      translationFontSize,
    }),
    [translationEnabled, arabicFontSize, arabicLineHeight, translationFontSize],
  );
  const listContentContainerStyle = useMemo(
    () => ({
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding],
  );
  const renderStudyVerseItem = useCallback(
    ({ item, extraData }: ListRenderItemInfo<DisplayVerse>) => {
      const currentExtraData = extraData as StudyVerseExtraData | undefined;
      return (
        <StudyVerseListItem
          verse={item}
          translationEnabled={currentExtraData?.translationEnabled ?? false}
          arabicFontSize={currentExtraData?.arabicFontSize ?? 28}
          arabicLineHeight={currentExtraData?.arabicLineHeight ?? 40}
          translationFontSize={currentExtraData?.translationFontSize ?? 14}
          onSelectVerse={onSelectVerse}
        />
      );
    },
    [onSelectVerse],
  );
  const getStudyItemType = useCallback(() => "verse", []);
  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onViewportHeightChange(event.nativeEvent.layout.height);
      onStudyListLayout();
    },
    [onStudyListLayout, onViewportHeightChange],
  );
  const handleListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      onScrollYChange(event.nativeEvent.contentOffset.y);
    },
    [onScrollYChange],
  );

  if (shouldUseStudyFlashList) {
    return (
      <View className="flex-1 px-6">
        <View className="mt-6 flex-1 overflow-hidden rounded-3xl border border-outline bg-surface">
          <Animated.View className="flex-1" style={animatedContentStyle}>
            <FlashList
              ref={
                scrollViewRef as RefObject<FlashListRef<DisplayVerse> | null>
              }
              data={displayVerses}
              extraData={studyExtraData}
              keyExtractor={(item) => item.key}
              renderItem={renderStudyVerseItem}
              ItemSeparatorComponent={StudyItemSeparator}
              getItemType={getStudyItemType}
              contentContainerStyle={listContentContainerStyle}
              drawDistance={320}
              showsVerticalScrollIndicator={false}
              onLayout={handleListLayout}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef as RefObject<ScrollView | null>}
      className="flex-1 px-6"
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
            <Animated.View className="gap-4" style={animatedContentStyle}>
              {readingMode === "mushaf" ? (
                <View>
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
                        onVerseLayout={(verseKey, y, height) => {
                          onRegisterVerseLayout(
                            verseKey,
                            contentContainerYRef.current +
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
                        onVerseLayout={(verseKey, y, height) => {
                          onRegisterVerseLayout(
                            verseKey,
                            contentContainerYRef.current +
                              mushafFlowSectionYRef.current +
                              y,
                            height,
                          );
                        }}
                      />
                    </View>
                  )}
                  {translationEnabled && (
                    <View
                      onLayout={(event) => {
                        translationSectionYRef.current =
                          event.nativeEvent.layout.y;
                      }}
                    >
                      <MushafTranslationPanel
                        verses={displayVerses}
                        selectedVerseKey={selectedVerseKeyForMushaf}
                        translationFontSize={translationFontSize}
                        onSelectVerse={onSelectVerse}
                        onVerseLayout={(verseKey, y, height) => {
                          onRegisterVerseLayout(
                            verseKey,
                            contentContainerYRef.current +
                              translationSectionYRef.current +
                              y,
                            height,
                          );
                        }}
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
