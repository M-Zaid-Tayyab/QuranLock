import {
  DEFAULT_QURAN_RECITERS,
  fetchChapterVerseRecitations,
  fetchVerseRecitationAudio,
  type QuranVerseRecitation,
} from "@/services/quranFoundation";
import { retryAsync } from "@/services/retry";
import * as FileSystem from "expo-file-system/legacy";

type RecitationSourceType = "offline" | "stream";

export interface RecitationPlaybackSource {
  uri: string;
  durationMs?: number;
  source: RecitationSourceType;
}

export interface RecitationOfflineDownloadStatus {
  isDownloading: boolean;
  completedChapters: number;
  totalChapters: number;
  progressPercent: number;
  currentChapter: number | null;
  lastError: string | null;
}

const DEFAULT_RECITER_ID = DEFAULT_QURAN_RECITERS[0]?.id ?? 7;
const TOTAL_RECITATION_CHAPTERS = 114;
const RECITATION_DOWNLOAD_CHAPTERS = __DEV__ ? 1 : TOTAL_RECITATION_CHAPTERS;
const OFFLINE_DOWNLOAD_CONCURRENCY = 3;
const RECITATION_FILE_DOWNLOAD_RETRY_ATTEMPTS = 3;
const RECITATION_CHAPTER_FETCH_RETRY_ATTEMPTS = 3;

const verseDownloadCache = new Map<string, Promise<string>>();
let globalDownloadPromise: Promise<void> | null = null;
const downloadStatusListeners = new Set<
  (status: RecitationOfflineDownloadStatus) => void
>();
let offlineDownloadStatus: RecitationOfflineDownloadStatus = {
  isDownloading: false,
  completedChapters: 0,
  totalChapters: RECITATION_DOWNLOAD_CHAPTERS,
  progressPercent: 0,
  currentChapter: null,
  lastError: null,
};

const getRecitationRootDirectory = () => {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}Recitations`;
};

const normalizeVerseKey = (verseKey: string) => verseKey.trim();

const getSafeVerseFileName = (verseKey: string) => {
  const normalized = normalizeVerseKey(verseKey);
  const strict = normalized.replace(/[^0-9:]/g, "");
  const fallback = normalized.replace(/[^a-zA-Z0-9:_-]/g, "_");
  const token = (strict || fallback || "verse").replaceAll(":", "_");
  return `${token}.mp3`;
};

const getReciterDirectory = (reciterId: number) => {
  const root = getRecitationRootDirectory();
  if (!root) return null;
  return `${root}/reciter-${reciterId}`;
};

const getVerseFileUri = (verseKey: string, reciterId: number) => {
  const reciterDirectory = getReciterDirectory(reciterId);
  if (!reciterDirectory) return null;
  return `${reciterDirectory}/${getSafeVerseFileName(verseKey)}`;
};

const getChapterMarkerUri = (reciterId: number, chapterNumber: number) => {
  const reciterDirectory = getReciterDirectory(reciterId);
  if (!reciterDirectory) return null;
  return `${reciterDirectory}/chapter-${chapterNumber}.done`;
};

const ensureReciterDirectory = async (reciterId: number) => {
  const reciterDirectory = getReciterDirectory(reciterId);
  if (!reciterDirectory) {
    throw new Error("Unable to resolve recitation storage directory");
  }
  await FileSystem.makeDirectoryAsync(reciterDirectory, { intermediates: true });
  return reciterDirectory;
};

const checkFileExists = async (uri: string) => {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
};

const toProgressPercent = (completedChapters: number) => {
  const bounded = Math.min(
    RECITATION_DOWNLOAD_CHAPTERS,
    Math.max(0, completedChapters),
  );
  return Math.round((bounded / RECITATION_DOWNLOAD_CHAPTERS) * 100);
};

const isCancelledError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("cancel");
};

const publishOfflineDownloadStatus = (
  next: RecitationOfflineDownloadStatus,
) => {
  offlineDownloadStatus = next;
  downloadStatusListeners.forEach((listener) => listener(offlineDownloadStatus));
};

const updateOfflineDownloadStatus = (
  patch: Partial<RecitationOfflineDownloadStatus>,
) => {
  const merged = {
    ...offlineDownloadStatus,
    ...patch,
  };
  publishOfflineDownloadStatus({
    ...merged,
    totalChapters: RECITATION_DOWNLOAD_CHAPTERS,
    progressPercent: toProgressPercent(merged.completedChapters),
  });
};

const getChapterMarkerExists = async (reciterId: number, chapterNumber: number) => {
  const markerUri = getChapterMarkerUri(reciterId, chapterNumber);
  if (!markerUri) return false;
  return checkFileExists(markerUri);
};

const loadCompletedChapterSet = async (reciterId: number) => {
  const completed = new Set<number>();
  for (let chapter = 1; chapter <= RECITATION_DOWNLOAD_CHAPTERS; chapter += 1) {
    if (await getChapterMarkerExists(reciterId, chapter)) {
      completed.add(chapter);
    }
  }
  return completed;
};

export const getOfflineRecitationUri = async (
  verseKey: string,
  reciterId: number,
) => {
  const normalizedVerseKey = normalizeVerseKey(verseKey);
  if (!normalizedVerseKey) return null;
  const fileUri = getVerseFileUri(normalizedVerseKey, reciterId);
  if (!fileUri) return null;
  return (await checkFileExists(fileUri)) ? fileUri : null;
};

const downloadRecitationToFile = async (
  recitation: QuranVerseRecitation,
) => {
  const normalizedVerseKey = normalizeVerseKey(recitation.verseKey);
  if (!normalizedVerseKey) {
    throw new Error("Missing verse key for recitation file");
  }

  const fileUri = getVerseFileUri(normalizedVerseKey, recitation.reciterId);
  if (!fileUri) {
    throw new Error("Unable to resolve recitation file path");
  }
  if (await checkFileExists(fileUri)) {
    return fileUri;
  }

  const cacheKey = `${recitation.reciterId}:${normalizedVerseKey}`;
  const pending = verseDownloadCache.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const reciterDirectory = await ensureReciterDirectory(recitation.reciterId);
    const tempDirectory = FileSystem.cacheDirectory ?? reciterDirectory;
    try {
      return await retryAsync(
        async () => {
          const existing = await FileSystem.getInfoAsync(fileUri);
          if (existing.exists) {
            return fileUri;
          }

          const tempUri = `${tempDirectory}/recitation-${recitation.reciterId}-${Date.now()}-${getSafeVerseFileName(normalizedVerseKey)}.tmp`;
          try {
            const downloadResumable = FileSystem.createDownloadResumable(
              recitation.url,
              tempUri,
            );
            const result = await downloadResumable.downloadAsync();
            if (!result?.uri) {
              throw new Error("Recitation download was cancelled");
            }

            const outputExists = await FileSystem.getInfoAsync(fileUri);
            if (outputExists.exists) {
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            }
            await FileSystem.moveAsync({ from: result.uri, to: fileUri });
            return fileUri;
          } finally {
            await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(
              () => undefined,
            );
          }
        },
        {
          attempts: RECITATION_FILE_DOWNLOAD_RETRY_ATTEMPTS,
          shouldRetry: (error) => !isCancelledError(error),
        },
      );
    } finally {
      verseDownloadCache.delete(cacheKey);
    }
  })();

  verseDownloadCache.set(cacheKey, request);
  return request;
};

const downloadVerseRecitation = async (verseKey: string, reciterId: number) => {
  const recitation = await retryAsync(
    () => fetchVerseRecitationAudio(verseKey, reciterId),
    {
      attempts: RECITATION_CHAPTER_FETCH_RETRY_ATTEMPTS,
    },
  );
  return downloadRecitationToFile(recitation);
};

const downloadChapterRecitations = async (
  chapterNumber: number,
  reciterId: number,
) => {
  const markerUri = getChapterMarkerUri(reciterId, chapterNumber);
  if (markerUri && (await checkFileExists(markerUri))) {
    return true;
  }

  const recitations = await retryAsync(
    () => fetchChapterVerseRecitations(chapterNumber, reciterId),
    {
      attempts: RECITATION_CHAPTER_FETCH_RETRY_ATTEMPTS,
    },
  );
  const entries = [...recitations.values()];
  if (!entries.length) {
    return false;
  }

  let cursor = 0;
  let hadFailures = false;
  const worker = async () => {
    while (cursor < entries.length) {
      const current = entries[cursor];
      cursor += 1;
      if (!current) continue;
      try {
        await downloadRecitationToFile(current);
      } catch {
        hadFailures = true;
        // Continue downloading the rest; individual verse failures should not block queue.
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(OFFLINE_DOWNLOAD_CONCURRENCY, entries.length) },
      () => worker(),
    ),
  );

  if (hadFailures) {
    return false;
  }

  if (markerUri) {
    await ensureReciterDirectory(reciterId);
    await FileSystem.writeAsStringAsync(markerUri, new Date().toISOString()).catch(
      () => undefined,
    );
  }
  return true;
};

export const resolveVerseRecitationPlaybackSource = async (
  verseKey: string,
  reciterId: number,
): Promise<RecitationPlaybackSource> => {
  const normalizedVerseKey = normalizeVerseKey(verseKey);
  if (!normalizedVerseKey) {
    throw new Error("Missing verse key for recitation");
  }

  const offlineUri = await getOfflineRecitationUri(normalizedVerseKey, reciterId);
  if (offlineUri) {
    return {
      uri: offlineUri,
      source: "offline",
    };
  }

  const stream = await retryAsync(
    () => fetchVerseRecitationAudio(normalizedVerseKey, reciterId),
    {
      attempts: 2,
    },
  );
  if (getRecitationRootDirectory()) {
    void downloadRecitationToFile(stream).catch(() => undefined);
  }

  return {
    uri: stream.url,
    durationMs: stream.durationMs,
    source: "stream",
  };
};

export const cacheVerseRecitationInBackground = (
  verseKey: string,
  reciterId: number,
) => {
  if (!getRecitationRootDirectory()) return;
  void downloadVerseRecitation(verseKey, reciterId).catch(() => undefined);
};

export const startGlobalRecitationOfflineDownload = () => {
  if (!getRecitationRootDirectory()) {
    updateOfflineDownloadStatus({
      isDownloading: false,
      currentChapter: null,
      lastError: "Recitation storage is unavailable on this platform.",
    });
    return Promise.resolve();
  }
  if (globalDownloadPromise) {
    return globalDownloadPromise;
  }

  globalDownloadPromise = (async () => {
    try {
      const reciterId = DEFAULT_RECITER_ID;
      const completedChapters = await loadCompletedChapterSet(reciterId);
      updateOfflineDownloadStatus({
        isDownloading: true,
        completedChapters: completedChapters.size,
        currentChapter: null,
        lastError: null,
      });

      for (let chapter = 1; chapter <= RECITATION_DOWNLOAD_CHAPTERS; chapter += 1) {
        if (completedChapters.has(chapter)) {
          continue;
        }

        updateOfflineDownloadStatus({
          isDownloading: true,
          currentChapter: chapter,
        });

        try {
          const finished = await downloadChapterRecitations(chapter, reciterId);
          if (finished) {
            completedChapters.add(chapter);
            updateOfflineDownloadStatus({
              isDownloading: true,
              completedChapters: completedChapters.size,
              currentChapter: chapter,
              lastError: null,
            });
            continue;
          }
          updateOfflineDownloadStatus({
            isDownloading: true,
            currentChapter: chapter,
            lastError: `Chapter ${chapter} did not complete. Tap Continue to retry.`,
          });
        } catch (error) {
          updateOfflineDownloadStatus({
            isDownloading: true,
            currentChapter: chapter,
            lastError:
              error instanceof Error
                ? error.message
                : "Failed to download one or more recitation chapters.",
          });
          // Continue chapter queue so transient network errors do not stop the full download.
        }
      }

      updateOfflineDownloadStatus({
        isDownloading: false,
        completedChapters: completedChapters.size,
        currentChapter: null,
        lastError:
          completedChapters.size === RECITATION_DOWNLOAD_CHAPTERS
            ? null
            : offlineDownloadStatus.lastError,
      });
    } catch (error) {
      updateOfflineDownloadStatus({
        isDownloading: false,
        currentChapter: null,
        lastError:
          error instanceof Error
            ? error.message
            : "Unable to continue recitation download.",
      });
    }
  })().finally(() => {
    globalDownloadPromise = null;
  });

  return globalDownloadPromise;
};

export const getRecitationOfflineDownloadStatus = () => offlineDownloadStatus;

export const subscribeRecitationOfflineDownloadStatus = (
  listener: (status: RecitationOfflineDownloadStatus) => void,
) => {
  downloadStatusListeners.add(listener);
  return () => {
    downloadStatusListeners.delete(listener);
  };
};
