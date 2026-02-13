import {
  DEFAULT_QURAN_RECITERS,
} from "@/services/quranFoundation";
import { resolveVerseRecitationPlaybackSource } from "@/services/recitationPack";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_RATES = [0.8, 1, 1.2] as const;
const DEFAULT_RECITER_ID = DEFAULT_QURAN_RECITERS[0]?.id ?? 7;

interface UseVerseRecitationArgs {
  verseKeys: string[];
  selectedVerseKey: string | null;
  onSelectVerse: (verseKey: string) => void;
  onRequestNextPageVerse?: () => Promise<string | null>;
}

interface LoadVerseOptions {
  silentTransition?: boolean;
}

const formatMillis = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const isPlaybackAtEnd = (player: AudioPlayer) =>
  player.duration > 0 && player.currentTime >= player.duration - 0.06;

export const useVerseRecitation = ({
  verseKeys,
  selectedVerseKey,
  onSelectVerse,
  onRequestNextPageVerse,
}: UseVerseRecitationArgs) => {
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const loadRequestIdRef = useRef(0);
  const loadingRequestKeyRef = useRef<string | null>(null);
  const configuredRef = useRef(false);
  const unmountedRef = useRef(false);
  const loadedVerseKeyRef = useRef<string | null>(null);
  const loadedReciterIdRef = useRef<number | null>(null);
  const onRequestNextPageVerseRef = useRef<(() => Promise<string | null>) | null>(
    onRequestNextPageVerse ?? null,
  );
  const pageAdvanceInFlightRef = useRef(false);

  const verseKeysRef = useRef<string[]>(verseKeys);
  const onSelectVerseRef = useRef(onSelectVerse);
  const loadVerseRef = useRef<
    (verseKey: string, shouldPlay: boolean, options?: LoadVerseOptions) => void
  >(() => {});

  const reciterId = DEFAULT_RECITER_ID;
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [error, setError] = useState<string | null>(null);

  verseKeysRef.current = verseKeys;
  onSelectVerseRef.current = onSelectVerse;
  onRequestNextPageVerseRef.current = onRequestNextPageVerse ?? null;

  const currentIndex = useMemo(() => {
    if (!selectedVerseKey) return -1;
    return verseKeys.findIndex((key) => key === selectedVerseKey);
  }, [selectedVerseKey, verseKeys]);

  const canGoNext = currentIndex >= 0 && currentIndex < verseKeys.length - 1;
  const canGoPrevious = currentIndex > 0;

  const updateLoadedSource = useCallback(
    (verseKey: string | null, nextReciterId: number | null) => {
      loadedVerseKeyRef.current = verseKey;
      loadedReciterIdRef.current = nextReciterId;
    },
    [],
  );

  const detachStatusListener = useCallback(() => {
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;
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

  const advanceToNextPageVerse = useCallback(() => {
    if (pageAdvanceInFlightRef.current) return;
    const requestNextPageVerse = onRequestNextPageVerseRef.current;
    if (!requestNextPageVerse) return;

    pageAdvanceInFlightRef.current = true;
    void requestNextPageVerse()
      .then((nextVerseKey) => {
        if (!nextVerseKey || unmountedRef.current) return;
        onSelectVerseRef.current(nextVerseKey);
        loadVerseRef.current(nextVerseKey, true, { silentTransition: true });
      })
      .catch(() => {
        // Keep silent; playback controls already expose loading/error state on next user action.
      })
      .finally(() => {
        pageAdvanceInFlightRef.current = false;
      });
  }, []);

  const onPlaybackStatus = useCallback((status: AudioStatus) => {
    if (unmountedRef.current) return;

    const shouldKeepPlayingState = status.didJustFinish;
    if (!shouldKeepPlayingState) {
      setIsPlaying(status.playing);
    }
    setPositionMillis(Math.max(0, Math.round((status.currentTime ?? 0) * 1000)));
    if (Number.isFinite(status.duration) && status.duration > 0) {
      setDurationMillis(Math.round(status.duration * 1000));
    }
    if (status.isLoaded) {
      setIsLoadingAudio(false);
    }

    if (!status.didJustFinish) return;

    setPositionMillis(0);
    const finishedVerseKey = loadedVerseKeyRef.current;
    if (!finishedVerseKey) return;
    const keys = verseKeysRef.current;
    const finishedIndex = keys.findIndex((key) => key === finishedVerseKey);
    if (finishedIndex < 0) return;
    if (finishedIndex >= keys.length - 1) {
      advanceToNextPageVerse();
      return;
    }
    const nextVerseKey = keys[finishedIndex + 1];
    if (!nextVerseKey) return;
    onSelectVerseRef.current(nextVerseKey);
    loadVerseRef.current(nextVerseKey, true, { silentTransition: true });
  }, [advanceToNextPageVerse]);

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

  const disposePlayer = useCallback(
    (player: AudioPlayer | null) => {
      if (!player) return;
      if (playerRef.current?.id === player.id) {
        detachStatusListener();
        playerRef.current = null;
      }
      try {
        if (player.playing) {
          player.pause();
        }
      } catch {
        // noop
      }
      try {
        player.remove();
      } catch {
        // noop
      }
    },
    [detachStatusListener],
  );

  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    const player = createAudioPlayer(null, {
      updateInterval: 250,
      keepAudioSessionActive: true,
    });
    player.shouldCorrectPitch = true;
    attachStatusListener(player);
    playerRef.current = player;
    return player;
  }, [attachStatusListener]);

  const loadVerse = useCallback(
    async (
      verseKey: string,
      shouldPlay: boolean,
      options?: LoadVerseOptions,
    ) => {
      const trimmedVerseKey = verseKey.trim();
      if (!trimmedVerseKey) return;
      const silentTransition = Boolean(options?.silentTransition);
      const requestKey = `${reciterId}:${trimmedVerseKey}:${shouldPlay ? "1" : "0"}`;
      if (loadingRequestKeyRef.current === requestKey) return;

      const requestId = ++loadRequestIdRef.current;
      loadingRequestKeyRef.current = requestKey;
      if (!silentTransition) {
        setIsLoadingAudio(true);
      }
      setError(null);

      try {
        await ensureAudioMode();
        const player = ensurePlayer();
        const isSameSource =
          loadedVerseKeyRef.current === trimmedVerseKey &&
          loadedReciterIdRef.current === reciterId;

        if (isSameSource) {
          player.setPlaybackRate(playbackRate, "high");
          if (shouldPlay) {
            if (isPlaybackAtEnd(player)) {
              await player.seekTo(0).catch(() => {
                // noop
              });
            }
            player.play();
          }
          return;
        }

        if (player.playing) {
          player.pause();
        }

        const recitation = await resolveVerseRecitationPlaybackSource(
          trimmedVerseKey,
          reciterId,
        );
        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        player.replace({ uri: recitation.uri });
        player.shouldCorrectPitch = true;
        player.setPlaybackRate(playbackRate, "high");
        updateLoadedSource(trimmedVerseKey, reciterId);
        setPositionMillis(0);
        setDurationMillis(
          recitation.durationMs != null && Number.isFinite(recitation.durationMs)
            ? recitation.durationMs
            : 0,
        );
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
        if (requestId === loadRequestIdRef.current) {
          loadingRequestKeyRef.current = null;
        }
        if (
          !silentTransition &&
          requestId === loadRequestIdRef.current &&
          !unmountedRef.current
        ) {
          setIsLoadingAudio(false);
        }
      }
    },
    [ensureAudioMode, ensurePlayer, playbackRate, reciterId, updateLoadedSource],
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

    const player = playerRef.current;
    const isLoadedCurrentVerse =
      loadedVerseKeyRef.current === selectedVerseKey &&
      loadedReciterIdRef.current === reciterId;

    if (player && isLoadedCurrentVerse) {
      if (!player.isLoaded) {
        await loadVerse(selectedVerseKey, true);
        return;
      }

      if (player.playing) {
        player.pause();
      } else {
        if (isPlaybackAtEnd(player)) {
          await player.seekTo(0).catch(() => {
            // noop
          });
        }
        player.play();
      }
      return;
    }

    await loadVerse(selectedVerseKey, true);
  }, [isLoadingAudio, loadVerse, reciterId, selectedVerseKey]);

  const playRelative = useCallback(
    (offset: 1 | -1) => {
      const baseIndex = currentIndex;
      if (baseIndex < 0) return;
      const target = verseKeys[baseIndex + offset];
      if (!target) {
        if (offset === 1) {
          advanceToNextPageVerse();
        }
        return;
      }
      onSelectVerse(target);
      loadVerseRef.current(target, true, { silentTransition: true });
    },
    [advanceToNextPageVerse, currentIndex, onSelectVerse, verseKeys],
  );

  const cycleRate = useCallback(() => {
    const currentRateIndex = PLAYBACK_RATES.findIndex(
      (value) => value === playbackRate,
    );
    const nextRate =
      PLAYBACK_RATES[(currentRateIndex + 1 + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);

    const player = playerRef.current;
    if (player?.isLoaded) {
      player.setPlaybackRate(nextRate, "high");
    }
  }, [playbackRate]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      loadRequestIdRef.current += 1;
      loadingRequestKeyRef.current = null;
      pageAdvanceInFlightRef.current = false;
      disposePlayer(playerRef.current);
    };
  }, [disposePlayer]);

  useEffect(() => {
    const player = playerRef.current;
    if (!selectedVerseKey) {
      if (player?.playing) {
        player.pause();
      }
      setIsPlaying(false);
      setIsLoadingAudio(false);
      setPositionMillis(0);
      setDurationMillis(0);
      setError(null);
      updateLoadedSource(null, null);
      return;
    }

    const isLoadedSelection =
      loadedVerseKeyRef.current === selectedVerseKey &&
      loadedReciterIdRef.current === reciterId;

    if (isPlaying && !isLoadedSelection) {
      if (!loadingRequestKeyRef.current?.includes(`:${selectedVerseKey}:`)) {
        loadVerseRef.current(selectedVerseKey, true);
      }
      return;
    }

    if (!isPlaying && !isLoadedSelection) {
      setPositionMillis(0);
      setDurationMillis(0);
    }
  }, [isPlaying, reciterId, selectedVerseKey, updateLoadedSource]);

  return {
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
