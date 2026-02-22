import { DEFAULT_QURAN_RECITERS } from "@/services/quranFoundation";
import { resolveVerseRecitationPlaybackSource } from "@/services/recitationPack";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_RATES = [0.8, 1, 1.2] as const;
const DEFAULT_RECITER_ID = DEFAULT_QURAN_RECITERS[0]?.id ?? 7;
const PLAYER_END_SEEK_TOLERANCE_SECONDS = 0.06;
const STATUS_END_TOLERANCE_SECONDS = 0.08;
const AUTOPLAY_KICK_INTERVAL_MS = 120;
const MAX_AUTOPLAY_KICK_ATTEMPTS = 5;

interface UseVerseRecitationArgs {
  verseKeys: string[];
  selectedVerseKey: string | null;
  onSelectVerse: (verseKey: string) => void;
  onRequestNextPageVerse?: () => Promise<string | null>;
}

interface LoadVerseOptions {
  silentTransition?: boolean;
}

interface LoadedSourceState {
  verseKey: string | null;
  reciterId: number | null;
}

interface PlayIntentState {
  enabled: boolean;
  loadId: number;
  verseKey: string | null;
}

interface PlayKickState {
  loadId: number;
  attempts: number;
  lastAtMs: number;
}

const formatMillis = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const isPlayerAtTrackEnd = (player: AudioPlayer) =>
  player.duration > 0 &&
  player.currentTime >= player.duration - PLAYER_END_SEEK_TOLERANCE_SECONDS;

const didStatusReachTrackEnd = (status: AudioStatus) =>
  status.isLoaded &&
  Number.isFinite(status.duration) &&
  status.duration > 0 &&
  Number.isFinite(status.currentTime) &&
  status.currentTime >= status.duration - STATUS_END_TOLERANCE_SECONDS;

export const useVerseRecitation = ({
  verseKeys,
  selectedVerseKey,
  onSelectVerse,
  onRequestNextPageVerse,
}: UseVerseRecitationArgs) => {
  const reciterId = DEFAULT_RECITER_ID;
  const player = useAudioPlayer(null, {
    updateInterval: 250,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);

  const unmountedRef = useRef(false);
  const configuredAudioModeRef = useRef(false);
  const activeLoadIdRef = useRef(0);
  const inFlightRequestKeyRef = useRef<string | null>(null);
  const loadedSourceRef = useRef<LoadedSourceState>({
    verseKey: null,
    reciterId: null,
  });
  const pageAdvanceInFlightRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const completionHandledForVerseRef = useRef<string | null>(null);
  const playIntentRef = useRef<PlayIntentState>({
    enabled: false,
    loadId: 0,
    verseKey: null,
  });
  const playKickStateRef = useRef<PlayKickState>({
    loadId: 0,
    attempts: 0,
    lastAtMs: 0,
  });

  const verseKeysRef = useRef(verseKeys);
  const onSelectVerseRef = useRef(onSelectVerse);
  const onRequestNextPageVerseRef = useRef<(() => Promise<string | null>) | null>(
    onRequestNextPageVerse ?? null,
  );
  const loadVerseRef = useRef<
    (verseKey: string, shouldPlay: boolean, options?: LoadVerseOptions) => void
  >(() => {});

  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const positionDisplaySecondRef = useRef(0);
  const durationDisplaySecondRef = useRef(0);

  const setPositionForDisplay = (nextMillis: number, force = false) => {
    const safeMillis = Math.max(0, Math.round(nextMillis));
    const nextSecond = Math.floor(safeMillis / 1000);
    if (!force && nextSecond === positionDisplaySecondRef.current) return;
    positionDisplaySecondRef.current = nextSecond;
    setPositionMillis(nextSecond * 1000);
  };

  const setDurationForDisplay = (nextMillis: number, force = false) => {
    const safeMillis = Math.max(0, Math.round(nextMillis));
    const nextSecond = Math.floor(safeMillis / 1000);
    if (!force && nextSecond === durationDisplaySecondRef.current) return;
    durationDisplaySecondRef.current = nextSecond;
    setDurationMillis(nextSecond * 1000);
  };

  verseKeysRef.current = verseKeys;
  onSelectVerseRef.current = onSelectVerse;
  onRequestNextPageVerseRef.current = onRequestNextPageVerse ?? null;

  const currentIndex = useMemo(() => {
    if (!selectedVerseKey) return -1;
    return verseKeys.findIndex((key) => key === selectedVerseKey);
  }, [selectedVerseKey, verseKeys]);

  const canGoNext = currentIndex >= 0 && currentIndex < verseKeys.length - 1;
  const canGoPrevious = currentIndex > 0;

  const setLoadedSource = useCallback(
    (verseKey: string | null, nextReciterId: number | null) => {
      loadedSourceRef.current = {
        verseKey,
        reciterId: nextReciterId,
      };
      if (!verseKey) {
        completionHandledForVerseRef.current = null;
      }
    },
    [],
  );

  const setPlayIntent = useCallback(
    (enabled: boolean, loadId: number, verseKey: string | null) => {
      playIntentRef.current = {
        enabled,
        loadId,
        verseKey,
      };
      playKickStateRef.current = {
        loadId,
        attempts: 0,
        lastAtMs: 0,
      };
    },
    [],
  );

  const ensureAudioMode = useCallback(async () => {
    if (configuredAudioModeRef.current) return;
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
    });
    configuredAudioModeRef.current = true;
  }, []);

  const advanceToNextPageVerse = useCallback(() => {
    if (pageAdvanceInFlightRef.current) return;

    const requestNextPageVerse = onRequestNextPageVerseRef.current;
    if (!requestNextPageVerse) {
      setPlayIntent(false, activeLoadIdRef.current, null);
      setIsPlaying(false);
      return;
    }

    pageAdvanceInFlightRef.current = true;
    void requestNextPageVerse()
      .then((nextVerseKey) => {
        if (!nextVerseKey || unmountedRef.current) {
          setPlayIntent(false, activeLoadIdRef.current, null);
          setIsPlaying(false);
          return;
        }
        onSelectVerseRef.current(nextVerseKey);
        loadVerseRef.current(nextVerseKey, true, { silentTransition: true });
      })
      .catch(() => {
        setPlayIntent(false, activeLoadIdRef.current, null);
        setIsPlaying(false);
      })
      .finally(() => {
        pageAdvanceInFlightRef.current = false;
      });
  }, [setPlayIntent]);

  const advanceToNextVerse = useCallback(
    (finishedVerseKey: string) => {
      const keys = verseKeysRef.current;
      const finishedIndex = keys.findIndex((key) => key === finishedVerseKey);

      if (finishedIndex < 0) {
        setPlayIntent(false, activeLoadIdRef.current, null);
        setIsPlaying(false);
        return;
      }

      if (finishedIndex >= keys.length - 1) {
        advanceToNextPageVerse();
        return;
      }

      const nextVerseKey = keys[finishedIndex + 1];
      if (!nextVerseKey) {
        setPlayIntent(false, activeLoadIdRef.current, null);
        setIsPlaying(false);
        return;
      }
      onSelectVerseRef.current(nextVerseKey);
      loadVerseRef.current(nextVerseKey, true, { silentTransition: true });
    },
    [advanceToNextPageVerse, setPlayIntent],
  );

  useEffect(() => {
    player.shouldCorrectPitch = true;
  }, [player]);

  useEffect(() => {
    if (unmountedRef.current) return;

    const reachedTrackEnd =
      status.didJustFinish ||
      (wasPlayingRef.current && !status.playing && didStatusReachTrackEnd(status));
    if (!reachedTrackEnd) {
      const shouldHoldPlaying =
        playIntentRef.current.enabled &&
        playIntentRef.current.loadId === activeLoadIdRef.current &&
        !status.playing;
      setIsPlaying(shouldHoldPlaying ? true : status.playing);
    }

    setPositionForDisplay((status.currentTime ?? 0) * 1000);
    if (Number.isFinite(status.duration) && status.duration > 0) {
      setDurationForDisplay(status.duration * 1000);
    }
    if (status.isLoaded) {
      setIsLoadingAudio(false);
    }

    if (status.playing) {
      if (playIntentRef.current.enabled) {
        setPlayIntent(
          false,
          activeLoadIdRef.current,
          loadedSourceRef.current.verseKey,
        );
      }
      completionHandledForVerseRef.current = null;
    }

    if (status.isLoaded && !status.playing && !reachedTrackEnd) {
      const intent = playIntentRef.current;
      const loadedVerseKey = loadedSourceRef.current.verseKey;
      const isIntentActive =
        intent.enabled &&
        intent.loadId === activeLoadIdRef.current &&
        intent.verseKey != null &&
        intent.verseKey === loadedVerseKey;

      if (isIntentActive) {
        const now = Date.now();
        const kickState = playKickStateRef.current;

        if (kickState.loadId !== intent.loadId) {
          playKickStateRef.current = {
            loadId: intent.loadId,
            attempts: 0,
            lastAtMs: 0,
          };
        }

        const currentKickState = playKickStateRef.current;
        const canKickNow =
          now - currentKickState.lastAtMs >= AUTOPLAY_KICK_INTERVAL_MS;

        if (canKickNow && currentKickState.attempts < MAX_AUTOPLAY_KICK_ATTEMPTS) {
          player.play();
          playKickStateRef.current = {
            loadId: intent.loadId,
            attempts: currentKickState.attempts + 1,
            lastAtMs: now,
          };
        } else if (currentKickState.attempts >= MAX_AUTOPLAY_KICK_ATTEMPTS) {
          setPlayIntent(false, intent.loadId, intent.verseKey);
          setIsPlaying(false);
        }
      }
    }

    if (reachedTrackEnd) {
      if (playIntentRef.current.enabled) {
        wasPlayingRef.current = status.playing;
        return;
      }

      setPositionForDisplay(0, true);
      const finishedVerseKey = loadedSourceRef.current.verseKey;
      if (!finishedVerseKey) {
        setPlayIntent(false, activeLoadIdRef.current, null);
        setIsPlaying(false);
      } else if (completionHandledForVerseRef.current !== finishedVerseKey) {
        completionHandledForVerseRef.current = finishedVerseKey;
        advanceToNextVerse(finishedVerseKey);
      }
    }

    wasPlayingRef.current = status.playing;
  }, [player, status]);

  const loadVerse = useCallback(
    async (verseKey: string, shouldPlay: boolean, options?: LoadVerseOptions) => {
      const trimmedVerseKey = verseKey.trim();
      if (!trimmedVerseKey) return;

      const silentTransition = Boolean(options?.silentTransition);
      const requestKey = `${reciterId}:${trimmedVerseKey}:${shouldPlay ? "1" : "0"}`;
      if (inFlightRequestKeyRef.current === requestKey) {
        return;
      }

      const loadId = ++activeLoadIdRef.current;
      inFlightRequestKeyRef.current = requestKey;
      setPlayIntent(shouldPlay, loadId, shouldPlay ? trimmedVerseKey : null);
      setError(null);
      if (!silentTransition) {
        setIsLoadingAudio(true);
      }

      try {
        await ensureAudioMode();

        const isSameSource =
          loadedSourceRef.current.verseKey === trimmedVerseKey &&
          loadedSourceRef.current.reciterId === reciterId;

        if (isSameSource) {
          player.setPlaybackRate(playbackRate, "high");
          if (shouldPlay) {
            if (isPlayerAtTrackEnd(player)) {
              await player.seekTo(0).catch(() => undefined);
            }
            player.play();
          }
          return;
        }

        if (player.playing) {
          player.pause();
        }

        const source = await resolveVerseRecitationPlaybackSource(
          trimmedVerseKey,
          reciterId,
        );
        if (loadId !== activeLoadIdRef.current) return;

        player.replace({ uri: source.uri });
        player.shouldCorrectPitch = true;
        player.setPlaybackRate(playbackRate, "high");
        setLoadedSource(trimmedVerseKey, reciterId);
        setPositionForDisplay(0, true);
        setDurationForDisplay(
          source.durationMs != null && Number.isFinite(source.durationMs)
            ? source.durationMs
            : 0,
          true,
        );

        if (shouldPlay) {
          player.play();
        }
      } catch (loadError) {
        if (loadId !== activeLoadIdRef.current || unmountedRef.current) return;
        setPlayIntent(false, loadId, trimmedVerseKey);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to play this verse right now",
        );
        setIsPlaying(false);
      } finally {
        if (loadId === activeLoadIdRef.current) {
          inFlightRequestKeyRef.current = null;
        }
        if (
          !silentTransition &&
          loadId === activeLoadIdRef.current &&
          !unmountedRef.current
        ) {
          setIsLoadingAudio(false);
        }
      }
    },
    [
      ensureAudioMode,
      playbackRate,
      player,
      reciterId,
      setLoadedSource,
      setPlayIntent,
    ],
  );

  loadVerseRef.current = (
    verseKey: string,
    shouldPlay: boolean,
    options?: LoadVerseOptions,
  ) => {
    void loadVerse(verseKey, shouldPlay, options);
  };

  const togglePlayback = useCallback(async () => {
    if (!selectedVerseKey || isLoadingAudio) return;
    const isLoadedSelection =
      loadedSourceRef.current.verseKey === selectedVerseKey &&
      loadedSourceRef.current.reciterId === reciterId;

    if (isLoadedSelection) {
      if (!player.isLoaded) {
        await loadVerse(selectedVerseKey, true);
        return;
      }

      if (player.playing) {
        setPlayIntent(false, activeLoadIdRef.current, selectedVerseKey);
        player.pause();
      } else {
        if (isPlayerAtTrackEnd(player)) {
          await player.seekTo(0).catch(() => undefined);
        }
        setPlayIntent(true, activeLoadIdRef.current, selectedVerseKey);
        player.play();
      }
      return;
    }
    await loadVerse(selectedVerseKey, true);
  }, [isLoadingAudio, loadVerse, player, reciterId, selectedVerseKey, setPlayIntent]);

  const playRelative = useCallback(
    (offset: 1 | -1) => {
      if (currentIndex < 0) return;
      const target = verseKeys[currentIndex + offset];
      if (!target) {
        if (offset === 1) {
          advanceToNextPageVerse();
        }
        return;
      }
      onSelectVerse(target);
      loadVerseRef.current(target, true, { silentTransition: true });
    },
    [
      advanceToNextPageVerse,
      currentIndex,
      onSelectVerse,
      verseKeys,
    ],
  );

  const cycleRate = useCallback(() => {
    const currentRateIndex = PLAYBACK_RATES.findIndex((value) => value === playbackRate);
    const nextRate =
      PLAYBACK_RATES[(currentRateIndex + 1 + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);

    if (player.isLoaded) {
      player.setPlaybackRate(nextRate, "high");
    }
  }, [playbackRate, player]);

  const handlePlayNext = useCallback(() => {
    playRelative(1);
  }, [playRelative]);

  const handlePlayPrevious = useCallback(() => {
    playRelative(-1);
  }, [playRelative]);

  const actions = useMemo(
    () => ({
      togglePlayback,
      playNext: handlePlayNext,
      playPrevious: handlePlayPrevious,
      cycleRate,
    }),
    [cycleRate, handlePlayNext, handlePlayPrevious, togglePlayback],
  );

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      activeLoadIdRef.current += 1;
      inFlightRequestKeyRef.current = null;
      pageAdvanceInFlightRef.current = false;
      wasPlayingRef.current = false;
      completionHandledForVerseRef.current = null;
      setPlayIntent(false, activeLoadIdRef.current, null);
      try {
        if (player.playing) {
          player.pause();
        }
      } catch {
        // noop
      }
    };
  }, [player]);

  useEffect(() => {
    if (!selectedVerseKey) {
      try {
        if (player.playing) {
          player.pause();
        }
      } catch {
        // noop
      }
      setPlayIntent(false, activeLoadIdRef.current, null);
      setIsPlaying(false);
      setIsLoadingAudio(false);
      setPositionForDisplay(0, true);
      setDurationForDisplay(0, true);
      setError(null);
      setLoadedSource(null, null);
      return;
    }

    const isLoadedSelection =
      loadedSourceRef.current.verseKey === selectedVerseKey &&
      loadedSourceRef.current.reciterId === reciterId;

    if (isPlaying && !isLoadedSelection) {
      if (!inFlightRequestKeyRef.current?.includes(`:${selectedVerseKey}:`)) {
        loadVerseRef.current(selectedVerseKey, true);
      }
      return;
    }

    if (!isPlaying && !isLoadedSelection) {
      setPositionForDisplay(0);
      setDurationForDisplay(0);
    }
  }, [isPlaying, player, reciterId, selectedVerseKey]);

  return {
    playbackRate,
    isLoadingAudio,
    isPlaying,
    error,
    canGoNext,
    canGoPrevious,
    positionLabel: formatMillis(positionMillis),
    durationLabel: formatMillis(durationMillis),
    actions,
  };
};
