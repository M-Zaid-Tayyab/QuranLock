import { colors } from "@/constants/colors";
import {
  QURAN_TOTAL_PAGES,
  deleteQuranPack,
  ensureQuranPack,
  getPackInfo,
  getQuranPage,
  prefetchQuranPages,
  pruneQuranCache,
  resetPrefetchQueue,
  type QuranPageData,
  type QuranWord,
} from "@/services/quranPack";
import { unblockSelection } from "@/services/deviceActivity";
import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { getScheduleStatuses } from "@/utils/scheduleEngine";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

const TICK_INTERVAL_MS = 1000;
const MINUTES_PER_TICK = 1 / 60;
const FONT_SCALES = [0.9, 1, 1.15, 1.3];

export default function VerseScreen() {
  const router = useRouter();
  const addQuranMinutes = useBlockingStore((s) => s.addQuranMinutes);
  const getRequiredMinutes = useBlockingStore((s) => s.getRequiredMinutes);
  const resetAfterUnblock = useBlockingStore((s) => s.resetAfterUnblock);
  const accumulatedQuranMinutesForCurrentBlock = useBlockingStore(
    (s) => s.accumulatedQuranMinutesForCurrentBlock,
  );
  const completedScheduleIds = useBlockingStore((s) => s.completedScheduleIds);
  const markScheduleCompleted = useBlockingStore((s) => s.markScheduleCompleted);
  const setActiveSchedule = useBlockingStore((s) => s.setActiveSchedule);
  const lastReadPage = useUserStore((s) => s.lastReadPage);
  const setLastReadPage = useUserStore((s) => s.setLastReadPage);
  const translationEnabled = useUserStore((s) => s.translationEnabled);
  const setTranslationEnabled = useUserStore((s) => s.setTranslationEnabled);
  const quranFontScale = useUserStore((s) => s.quranFontScale);
  const setQuranFontScale = useUserStore((s) => s.setQuranFontScale);
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const translationEnabledRef = useRef(translationEnabled);

  const { dateKey, activeSchedule, pendingSchedules } =
    useFocusScheduleStatus();

  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentPage, setCurrentPage] = useState(
    Math.min(Math.max(lastReadPage || 1, 1), QURAN_TOTAL_PAGES),
  );
  const [packState, setPackState] = useState<
    "checking" | "missing" | "downloading" | "ready" | "error"
  >("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [packError, setPackError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const requestIdRef = useRef(0);

  const requiredMinutes = getRequiredMinutes();

  const tick = useCallback(() => {
    const shouldUnblock = addQuranMinutes(MINUTES_PER_TICK);
    if (shouldUnblock) {
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
      } else {
        unblockSelection();
        resetAfterUnblock();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }
  }, [
    addQuranMinutes,
    activeSchedule,
    completedScheduleIds,
    dateKey,
    focusSchedules,
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
      if (info.exists) {
        setPackState("ready");
      } else {
        setPackState("missing");
      }
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
      setPackError(
        error instanceof Error ? error.message : "Download failed",
      );
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
  }, [packState, autoDownloadAttempted, handleDownload]);

  const loadPage = useCallback(async (page: number) => {
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
  }, [setLastReadPage]);

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
      setPackError(
        error instanceof Error ? error.message : "Download failed",
      );
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
    if (!pageData?.words?.length) return [];
    const map = new Map<number, QuranWord[]>();
    pageData.words.forEach((word) => {
      const line = word.line ?? 1;
      if (!map.has(line)) map.set(line, []);
      map.get(line)?.push(word);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [pageData]);
  const hasWordData = Boolean(pageData?.words?.length);
  const hasVerseData = Boolean(pageData?.verses?.length);
  const arabicFontSize = Math.round(28 * quranFontScale);
  const arabicLineHeight = Math.round(arabicFontSize * 1.45);
  const translationFontSize = Math.round(14 * Math.min(1.1, quranFontScale));

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

  const isBlockSessionActive = activeSchedule != null;
  const remaining = Math.max(
    0,
    Math.ceil((requiredMinutes - accumulatedQuranMinutesForCurrentBlock) * 60),
  );
  const remainingMinutes = Math.floor(remaining / 60);
  const remainingSeconds = remaining % 60;

  return (
    <View className="flex-1 bg-background py-safe">
      <View className="flex-row items-center justify-between px-6 pb-3 pt-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
        >
          <Ionicons name="chevron-back" size={22} color={colors.muted} />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-base font-sfPro-semibold text-foreground">
            {pageData?.surahName ?? "The Qur'an"}
          </Text>
          <Text className="text-xs font-sfPro text-muted">
            {pageData?.rangeLabel ?? `Page ${currentPage}`}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => handleFontAdjust(-1)}
            className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
          >
            <Ionicons name="remove" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => handleFontAdjust(1)}
            className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
          >
            <Ionicons name="add" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => setTranslationEnabled(!translationEnabled)}
            className={`h-10 w-10 items-center justify-center rounded-full border ${
              translationEnabled
                ? "border-accent bg-accent/20"
                : "border-outline bg-surface"
            }`}
          >
            <Ionicons
              name="language-outline"
              size={18}
              color={translationEnabled ? colors.accent : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {packState !== "ready" && (
          <View className="mt-6 rounded-3xl border border-outline bg-surface px-6 py-8">
            <View className="items-center">
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.accent + "22" }}
              >
                <Ionicons name="cloud-download" size={24} color={colors.accent} />
              </View>
              <Text className="mt-4 text-xl font-sfPro-bold text-foreground">
                Quran download
              </Text>
              <Text className="mt-2 text-center text-sm font-sfPro text-muted">
                Download the Quran pack once so it works fully offline.
              </Text>
            </View>

            {packState === "downloading" && (
              <View className="mt-6 items-center">
                <ActivityIndicator color={colors.accent} />
                <Text className="mt-3 text-sm font-sfPro text-muted">
                  {Math.round(downloadProgress * 100)}% complete
                </Text>
              </View>
            )}

            {packState === "error" && (
              <Text className="mt-4 text-center text-sm font-sfPro text-error">
                {packError ?? "Unable to download. Please try again."}
              </Text>
            )}

            {packState !== "downloading" && (
              <Pressable
                onPress={handleDownload}
                className="mt-6 rounded-full bg-accent px-6 py-3"
              >
                <Text className="text-center text-base font-sfPro-bold text-black">
                  {packState === "checking" ? "Checking…" : "Download now"}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {packState === "ready" && (
          <View className="mt-6 rounded-3xl border border-outline bg-surface px-5 py-6">
            {loadingPage && (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.primary} />
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
                  onPress={handleRedownloadPack}
                  className="mt-4 rounded-full bg-primary px-5 py-2"
                >
                  <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
                    Redownload pack
                  </Text>
                </Pressable>
              </View>
            )}

            {!loadingPage && !pageError && !pageData && (
              <Text className="text-center text-sm font-sfPro text-muted">
                Page data not found.
              </Text>
            )}

            {pageData && (
              <Animated.View
                className="gap-4"
                style={{
                  opacity: transition,
                  transform: [
                    {
                      translateX: transition.interpolate({
                        inputRange: [0, 1],
                        outputRange: [pageDirection * 18, 0],
                      }),
                    },
                  ],
                }}
              >
                {hasWordData && (
                  <View className="gap-4">
                    {groupedLines.map(([lineNumber, words]) => (
                      <View
                        key={`line-${lineNumber}`}
                        className="flex-row flex-wrap"
                        style={{
                          flexDirection: "row-reverse",
                          justifyContent: "flex-start",
                          writingDirection: "rtl",
                        }}
                      >
                        {words.map((word) => (
                          <View
                            key={`${word.id}-${word.verseKey}`}
                            className="items-center px-1 py-1"
                          >
                            <Text
                              className="text-foreground"
                              style={{
                                fontSize: arabicFontSize,
                                lineHeight: arabicLineHeight,
                              }}
                            >
                              {word.text}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {!hasWordData && hasVerseData && (
                  <View className="gap-5">
                    {pageData.verses?.map((verse) => (
                      <View key={verse.key} className="gap-2">
                        <Text
                          className="text-right text-foreground"
                          style={{
                            writingDirection: "rtl",
                            fontSize: arabicFontSize,
                            lineHeight: arabicLineHeight,
                          }}
                        >
                          {verse.arabic ?? ""}
                        </Text>
                        {translationEnabled && (verse.translation ?? verse.text) ? (
                          <Text
                            className="font-sfPro text-muted"
                            style={{ fontSize: translationFontSize }}
                          >
                            {verse.translation ?? verse.text}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {translationEnabled && hasWordData && pageData?.verses?.length ? (
              <View className="mt-6 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
                <Text className="text-sm font-sfPro-semibold text-foreground">
                  Translation
                </Text>
                <View className="mt-3 gap-3">
                  {pageData.verses.map((verse) => (
                    <View key={verse.key}>
                      <Text className="text-xs font-sfPro-semibold text-accent">
                        {verse.key}
                      </Text>
                      <Text
                        className="mt-1 font-sfPro text-muted"
                        style={{ fontSize: translationFontSize }}
                      >
                        {verse.translation ?? verse.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {packState === "ready" && (
        <View className="absolute bottom-6 left-6 right-6">
          <View className="flex-row items-center justify-between rounded-full border border-outline bg-surface px-4 py-3">
            <Pressable
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= QURAN_TOTAL_PAGES}
              className={`h-10 w-10 items-center justify-center rounded-full ${
                currentPage >= QURAN_TOTAL_PAGES
                  ? "bg-backgroundElevated"
                  : "bg-primary/20"
              }`}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={
                  currentPage >= QURAN_TOTAL_PAGES
                    ? colors.muted
                    : colors.primary
                }
              />
            </Pressable>
            <Text className="text-sm font-sfPro-semibold text-foreground">
              {currentPage} / {QURAN_TOTAL_PAGES}
            </Text>
            <Pressable
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`h-10 w-10 items-center justify-center rounded-full ${
                currentPage <= 1 ? "bg-backgroundElevated" : "bg-primary/20"
              }`}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={currentPage <= 1 ? colors.muted : colors.primary}
              />
            </Pressable>
          </View>

          {isBlockSessionActive && requiredMinutes > 0 && (
            <View className="mt-3 rounded-2xl border border-outline bg-backgroundElevated px-4 py-3">
              <Text className="text-center text-xs font-sfPro text-muted">
                Time on this screen counts toward unblocking your apps.
              </Text>
              <Text className="mt-1 text-center text-lg font-sfPro-bold text-foreground">
                {remainingMinutes}:{remainingSeconds.toString().padStart(2, "0")}{" "}
                remaining
              </Text>
              <Text className="mt-1 text-center text-xs font-sfPro text-muted">
                {Math.floor(accumulatedQuranMinutesForCurrentBlock)} min of{" "}
                {requiredMinutes} min
              </Text>
              {pendingSchedules.length > 1 && (
                <Text className="mt-1 text-center text-[10px] font-sfPro text-muted">
                  {pendingSchedules.length} focus sessions remaining today
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
