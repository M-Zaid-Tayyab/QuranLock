import {
  DEFAULT_QURAN_RECITERS,
  fetchVerseRecitationAudio,
  type QuranReciter,
} from "@/services/quranFoundation";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_RATES = [0.8, 1, 1.2] as const;

interface UseVerseRecitationArgs {
  verseKeys: string[];
  selectedVerseKey: string | null;
  onSelectVerse: (verseKey: string) => void;
}

const formatMillis = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const useVerseRecitation = ({
  verseKeys,
  selectedVerseKey,
  onSelectVerse,
}: UseVerseRecitationArgs) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const loadRequestIdRef = useRef(0);
  const configuredRef = useRef(false);
  const unmountedRef = useRef(false);
  const loadedVerseKeyRef = useRef<string | null>(null);
  const finishedVerseKeyRef = useRef<string | null>(null);

  const [reciterId, setReciterId] = useState<number>(
    DEFAULT_QURAN_RECITERS[0]?.id ?? 7,
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loadedVerseKey, setLoadedVerseKey] = useState<string | null>(null);
  const [loadedReciterId, setLoadedReciterId] = useState<number | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishedTick, setFinishedTick] = useState(0);

  const currentIndex = useMemo(() => {
    if (!selectedVerseKey) return -1;
    return verseKeys.findIndex((key) => key === selectedVerseKey);
  }, [selectedVerseKey, verseKeys]);

  const canGoNext = currentIndex >= 0 && currentIndex < verseKeys.length - 1;
  const canGoPrevious = currentIndex > 0;

  const clearPlaybackState = useCallback(() => {
    if (unmountedRef.current) return;
    setLoadedVerseKey(null);
    setLoadedReciterId(null);
    loadedVerseKeyRef.current = null;
    finishedVerseKeyRef.current = null;
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
  }, []);

  const detachStatusListener = useCallback(() => {
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;
  }, []);

  const unloadPlayer = useCallback(async () => {
    const player = playerRef.current;
    playerRef.current = null;
    detachStatusListener();
    if (player) {
      player.remove();
    }
    clearPlaybackState();
  }, [clearPlaybackState, detachStatusListener]);

  const onPlaybackStatus = useCallback((status: AudioStatus) => {
    if (unmountedRef.current) return;
    setIsPlaying(status.playing);
    setPositionMillis(Math.max(0, Math.round((status.currentTime ?? 0) * 1000)));
    if (Number.isFinite(status.duration) && status.duration > 0) {
      setDurationMillis(Math.round(status.duration * 1000));
    }
    if (status.isLoaded) {
      setIsLoadingAudio(false);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
      finishedVerseKeyRef.current = loadedVerseKeyRef.current;
      setFinishedTick((value) => value + 1);
    }
  }, []);

  const ensureAudioMode = useCallback(async () => {
    if (configuredRef.current) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
    });
    configuredRef.current = true;
  }, []);

  const attachStatusListener = useCallback(
    (player: AudioPlayer) => {
      detachStatusListener();
      statusSubscriptionRef.current = player.addListener(
        "playbackStatusUpdate",
        onPlaybackStatus,
      );
    },
    [detachStatusListener, onPlaybackStatus],
  );

  const loadVerse = useCallback(
    async (verseKey: string, shouldPlay: boolean) => {
      const trimmedVerseKey = verseKey.trim();
      if (!trimmedVerseKey) return;

      const requestId = ++loadRequestIdRef.current;
      setIsLoadingAudio(true);
      setError(null);

      try {
        await ensureAudioMode();

        const currentPlayer = playerRef.current;
        const isSameSource =
          loadedVerseKey === trimmedVerseKey && loadedReciterId === reciterId;

        if (currentPlayer && isSameSource) {
          currentPlayer.setPlaybackRate(playbackRate, "high");
          if (shouldPlay) {
            currentPlayer.play();
          }
          return;
        }

        if (currentPlayer) {
          detachStatusListener();
          currentPlayer.remove();
          playerRef.current = null;
        }

        const recitation = await fetchVerseRecitationAudio(trimmedVerseKey, reciterId);
        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        const player = createAudioPlayer(
          { uri: recitation.url },
          {
            updateInterval: 350,
          },
        );
        player.shouldCorrectPitch = true;
        player.setPlaybackRate(playbackRate, "high");
        attachStatusListener(player);
        playerRef.current = player;

        if (requestId !== loadRequestIdRef.current) {
          detachStatusListener();
          player.remove();
          playerRef.current = null;
          return;
        }

        setLoadedVerseKey(trimmedVerseKey);
        setLoadedReciterId(reciterId);
        loadedVerseKeyRef.current = trimmedVerseKey;
        if (recitation.durationMs != null && Number.isFinite(recitation.durationMs)) {
          setDurationMillis(recitation.durationMs);
        }
        if (shouldPlay) {
          player.play();
        }
      } catch (loadError) {
        if (requestId !== loadRequestIdRef.current || unmountedRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to play this verse right now",
        );
        setIsPlaying(false);
      } finally {
        if (requestId === loadRequestIdRef.current && !unmountedRef.current) {
          setIsLoadingAudio(false);
        }
      }
    },
    [
      attachStatusListener,
      detachStatusListener,
      ensureAudioMode,
      loadedReciterId,
      loadedVerseKey,
      playbackRate,
      reciterId,
    ],
  );

  const togglePlayback = useCallback(async () => {
    if (!selectedVerseKey) return;

    const currentPlayer = playerRef.current;
    const isLoadedCurrentVerse =
      loadedVerseKey === selectedVerseKey && loadedReciterId === reciterId;

    if (currentPlayer && isLoadedCurrentVerse) {
      if (!currentPlayer.isLoaded) {
        await loadVerse(selectedVerseKey, true);
        return;
      }

      if (currentPlayer.playing) {
        currentPlayer.pause();
      } else {
        currentPlayer.play();
      }
      return;
    }

    await loadVerse(selectedVerseKey, true);
  }, [loadVerse, loadedReciterId, loadedVerseKey, reciterId, selectedVerseKey]);

  const playRelative = useCallback(
    async (offset: 1 | -1) => {
      const baseIndex = currentIndex;
      if (baseIndex < 0) return;
      const target = verseKeys[baseIndex + offset];
      if (!target) return;
      onSelectVerse(target);
      await loadVerse(target, true);
    },
    [currentIndex, loadVerse, onSelectVerse, verseKeys],
  );

  const cycleRate = useCallback(async () => {
    const currentRateIndex = PLAYBACK_RATES.findIndex(
      (value) => value === playbackRate,
    );
    const nextRate =
      PLAYBACK_RATES[(currentRateIndex + 1 + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);

    const currentPlayer = playerRef.current;
    if (currentPlayer?.isLoaded) {
      currentPlayer.setPlaybackRate(nextRate, "high");
    }
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      loadRequestIdRef.current += 1;
      const player = playerRef.current;
      playerRef.current = null;
      detachStatusListener();
      player?.remove();
    };
  }, [detachStatusListener]);

  useEffect(() => {
    if (!selectedVerseKey) {
      void unloadPlayer();
      return;
    }

    if (!isPlaying) return;
    if (loadedVerseKey === selectedVerseKey && loadedReciterId === reciterId) return;
    void loadVerse(selectedVerseKey, true);
  }, [
    isPlaying,
    loadVerse,
    loadedReciterId,
    loadedVerseKey,
    reciterId,
    selectedVerseKey,
    unloadPlayer,
  ]);

  useEffect(() => {
    if (loadedVerseKey !== selectedVerseKey && !isPlaying) {
      setPositionMillis(0);
      setDurationMillis(0);
    }
  }, [isPlaying, loadedVerseKey, selectedVerseKey]);

  useEffect(() => {
    if (finishedTick <= 0) return;
    const finishedVerseKey = finishedVerseKeyRef.current;
    if (!finishedVerseKey) return;
    const finishedIndex = verseKeys.findIndex((key) => key === finishedVerseKey);
    if (finishedIndex < 0 || finishedIndex >= verseKeys.length - 1) return;
    const nextVerseKey = verseKeys[finishedIndex + 1];
    if (!nextVerseKey) return;

    onSelectVerse(nextVerseKey);
    void loadVerse(nextVerseKey, true);
  }, [finishedTick, loadVerse, onSelectVerse, verseKeys]);

  return {
    reciters: DEFAULT_QURAN_RECITERS as QuranReciter[],
    reciterId,
    setReciterId,
    playbackRate,
    isLoadingAudio,
    isPlaying,
    error,
    canGoNext,
    canGoPrevious,
    positionLabel: formatMillis(positionMillis),
    durationLabel: formatMillis(durationMillis),
    actions: {
      togglePlayback,
      playNext: () => playRelative(1),
      playPrevious: () => playRelative(-1),
      cycleRate,
    },
  };
};
