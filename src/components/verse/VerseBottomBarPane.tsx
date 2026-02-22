import { useBlockingStore } from "@/store/blocking";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { VerseNavigationBar } from "./VerseNavigationBar";

interface VerseBottomBarPaneProps {
  visible: boolean;
  currentPage: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pendingSchedulesCount: number;
  onMeasuredHeight: (height: number) => void;
}

export function VerseBottomBarPane({
  visible,
  currentPage,
  totalPages,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  pendingSchedulesCount,
  onMeasuredHeight,
}: VerseBottomBarPaneProps) {
  const {
    activeScheduleId,
    requiredQuranMinutes,
    quranMinutesToUnblock,
    lastBlockedAt,
    getAccumulatedMinutesSnapshot,
  } = useBlockingStore(
    useShallow((s) => ({
      activeScheduleId: s.activeScheduleId,
      requiredQuranMinutes: s.requiredQuranMinutes,
      quranMinutesToUnblock: s.quranMinutesToUnblock,
      lastBlockedAt: s.lastBlockedAt,
      getAccumulatedMinutesSnapshot: s.getAccumulatedMinutesSnapshot,
    })),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isBlockSessionActive = visible && activeScheduleId != null;

  useEffect(() => {
    if (!visible || !isBlockSessionActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isBlockSessionActive, visible]);

  const requiredMinutes = useMemo(
    () =>
      requiredQuranMinutes > 0
        ? requiredQuranMinutes
        : lastBlockedAt != null
          ? quranMinutesToUnblock
          : 0,
    [lastBlockedAt, quranMinutesToUnblock, requiredQuranMinutes],
  );
  const accumulatedMinutes = getAccumulatedMinutesSnapshot(nowMs);
  const remaining = Math.max(
    0,
    Math.ceil((requiredMinutes - accumulatedMinutes) * 60),
  );
  const remainingMinutes = Math.floor(remaining / 60);
  const remainingSeconds = remaining % 60;

  if (!visible) return null;

  return (
    <VerseNavigationBar
      currentPage={currentPage}
      totalPages={totalPages}
      canGoNext={canGoNext}
      canGoPrevious={canGoPrevious}
      onNext={onNext}
      onPrevious={onPrevious}
      isBlockSessionActive={isBlockSessionActive}
      requiredMinutes={requiredMinutes}
      remainingMinutes={remainingMinutes}
      remainingSeconds={remainingSeconds}
      pendingSchedulesCount={pendingSchedulesCount}
      onMeasuredHeight={onMeasuredHeight}
    />
  );
}
