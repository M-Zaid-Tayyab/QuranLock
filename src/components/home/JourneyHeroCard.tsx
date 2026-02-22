import { PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { useBlockingStore } from "@/store/blocking";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

interface JourneyHeroCardProps {
  title: string;
  subtitle: string;
  isBlockingActive: boolean;
  progressPercent: number;
  pagesRead: number;
  pagesTotal: number;
  requiredMinutes: number;
  onPressRead: () => void;
}

interface JourneyHeroSubtitleProps {
  subtitle: string;
  isBlockingActive: boolean;
  fallbackProgressPercent: number;
  pagesRead: number;
  pagesTotal: number;
}

function JourneyHeroSessionMetrics({
  subtitle,
  isBlockingActive,
  fallbackProgressPercent,
  pagesRead,
  pagesTotal,
}: JourneyHeroSubtitleProps) {
  const isFocused = useIsFocused();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const {
    requiredQuranMinutes,
    quranMinutesToUnblock,
    lastBlockedAt,
    getAccumulatedMinutesSnapshot,
  } = useBlockingStore(
    useShallow((s) => ({
      requiredQuranMinutes: s.requiredQuranMinutes,
      quranMinutesToUnblock: s.quranMinutesToUnblock,
      lastBlockedAt: s.lastBlockedAt,
      getAccumulatedMinutesSnapshot: s.getAccumulatedMinutesSnapshot,
    })),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState === "active") {
        setNowMs(Date.now());
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isBlockingActive || !isFocused || appState !== "active") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [appState, isBlockingActive, isFocused]);

  const requiredMinutes = useMemo(
    () =>
      requiredQuranMinutes > 0
        ? requiredQuranMinutes
        : lastBlockedAt != null
          ? quranMinutesToUnblock
          : 0,
    [lastBlockedAt, quranMinutesToUnblock, requiredQuranMinutes],
  );

  const progressPercent = useMemo(() => {
    if (!isBlockingActive || requiredMinutes <= 0) {
      return Math.min(100, Math.max(0, fallbackProgressPercent));
    }
    const accumulated = getAccumulatedMinutesSnapshot(nowMs);
    return Math.min(100, Math.max(0, Math.round((accumulated / requiredMinutes) * 100)));
  }, [
    fallbackProgressPercent,
    getAccumulatedMinutesSnapshot,
    isBlockingActive,
    nowMs,
    requiredMinutes,
  ]);

  const text = useMemo(() => {
    if (!isBlockingActive || requiredMinutes <= 0) return subtitle;
    const accumulated = getAccumulatedMinutesSnapshot(nowMs);
    const remainingSeconds = Math.max(
      0,
      Math.ceil((requiredMinutes - accumulated) * 60),
    );
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingSecondsPart = remainingSeconds % 60;
    return `${remainingMinutes}:${remainingSecondsPart
      .toString()
      .padStart(2, "0")} left to unlock apps`;
  }, [
    getAccumulatedMinutesSnapshot,
    isBlockingActive,
    nowMs,
    requiredMinutes,
    subtitle,
  ]);

  return (
    <>
      <Text className="mt-1 text-sm font-sfPro text-muted">{text}</Text>

      <View className="mt-5 w-full">
        <View className="h-2 rounded-full bg-backgroundElevated">
          <View
            className="h-2 rounded-full bg-primary"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="book-outline" size={13} color={colors.muted} />
            <Text className="text-xs font-sfPro text-muted">
              {pagesRead}/{pagesTotal} pages
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="trending-up-outline" size={13} color={colors.primary} />
            <Text className="text-xs font-sfPro-semibold text-foreground">
              {progressPercent}%
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

export function JourneyHeroCard({
  title,
  subtitle,
  isBlockingActive,
  progressPercent,
  pagesRead,
  pagesTotal,
  requiredMinutes,
  onPressRead,
}: JourneyHeroCardProps) {
  return (
    <View className="mb-6 rounded-3xl border border-outline bg-surface px-6 py-6">
      <View className="items-center">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accent + "22" }}
        >
          <Ionicons name="bar-chart-outline" size={24} color={colors.accent} />
        </View>
        <Text className="mt-4 text-2xl font-sfPro-bold text-foreground">{title}</Text>
        <JourneyHeroSessionMetrics
          subtitle={subtitle}
          isBlockingActive={isBlockingActive}
          fallbackProgressPercent={progressPercent}
          pagesRead={pagesRead}
          pagesTotal={pagesTotal}
        />
      </View>

      <PrimaryButton
        title={requiredMinutes > 0 ? "Continue Reading" : "Bismillah, Let's Read"}
        onPress={onPressRead}
        className="mt-5"
      />
    </View>
  );
}
