import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

export const QURAN_DB_NAME = "quran-pack.db";
export const QURAN_TOTAL_PAGES = 604;
type ProgressListener = (
  progress: number,
  written: number,
  total: number,
) => void;
const progressListeners = new Set<ProgressListener>();
let downloadPromise: Promise<void> | null = null;

export interface QuranWord {
  id: number;
  text: string;
  translation?: string;
  transliteration?: string;
  line: number;
  verseKey: string;
}

export interface QuranVerseTranslation {
  key: string;
  text?: string;
  translation?: string;
  arabic?: string;
}

export interface QuranPageData {
  page: number;
  surahName: string;
  rangeLabel: string;
  words?: QuranWord[];
  verses?: QuranVerseTranslation[];
}

export interface QuranVerseLookup {
  page: number;
  verse: QuranVerseTranslation;
}

export interface QuranPackSearchResult {
  verseKey: string;
  highlightedText: string;
  translation?: string;
  surahName?: string;
  pageNumber?: number;
}

/**
 * Expected SQLite schema:
 * pages(page_number INTEGER PRIMARY KEY, data TEXT)
 * data JSON: { page, surahName, rangeLabel, words: [...], verses: [...] }
 */

const getDbDirectory = () => {
  if (FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}SQLite`;
  }
  return SQLite.defaultDatabaseDirectory ?? null;
};

const getDbFileUri = () => {
  const directory = getDbDirectory();
  if (!directory) return null;
  return `${directory}/${QURAN_DB_NAME}`;
};

export const getPackInfo = async () => {
  const fileUri = getDbFileUri();
  if (!fileUri) {
    return { exists: false, size: 0 };
  }
  const info = await FileSystem.getInfoAsync(fileUri);
  return {
    exists: info.exists,
    size: "size" in info ? (info.size ?? 0) : 0,
  };
};

export const deleteQuranPack = async () => {
  const fileUri = getDbFileUri();
  if (!fileUri) return;
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
};

const notifyProgress = (
  progress: number,
  written: number,
  total: number,
) => {
  progressListeners.forEach((listener) => listener(progress, written, total));
};

const performDownload = async () => {
  const downloadUrl = process.env.EXPO_PUBLIC_QURAN_PACK_URL;
  const downloadEndpoint = process.env.EXPO_PUBLIC_QURAN_PACK_URL_ENDPOINT;
  let resolvedUrl = downloadUrl ?? null;
  if (downloadEndpoint) {
    const response = await fetch(downloadEndpoint);
    if (!response.ok) {
      throw new Error("Unable to resolve Quran pack URL");
    }
    const data = (await response.json()) as { url?: string };
    if (!data.url) {
      throw new Error("Invalid Quran pack URL response");
    }
    resolvedUrl = data.url;
  }
  if (!resolvedUrl) {
    throw new Error("Missing EXPO_PUBLIC_QURAN_PACK_URL");
  }

  const directory = getDbDirectory();
  const fileUri = getDbFileUri();
  if (!directory || !fileUri) {
    throw new Error("Unable to resolve database path");
  }

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const tempUri = `${FileSystem.cacheDirectory ?? directory}/quran-pack.tmp`;
  const downloadResumable = FileSystem.createDownloadResumable(
    resolvedUrl,
    tempUri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite) {
        notifyProgress(
          totalBytesWritten / totalBytesExpectedToWrite,
          totalBytesWritten,
          totalBytesExpectedToWrite,
        );
      }
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error("Download cancelled");
  }

  const existing = await FileSystem.getInfoAsync(fileUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }

  await FileSystem.moveAsync({ from: result.uri, to: fileUri });
};

export const ensureQuranPack = async (
  onProgress?: ProgressListener,
) => {
  if (onProgress) {
    progressListeners.add(onProgress);
  }

  try {
    const info = await getPackInfo();
    if (info.exists) return;

    if (!downloadPromise) {
      downloadPromise = performDownload().finally(() => {
        downloadPromise = null;
        progressListeners.clear();
      });
    }
    await downloadPromise;
  } finally {
    if (onProgress) {
      progressListeners.delete(onProgress);
    }
  }
};

export const downloadQuranPack = async (
  onProgress?: ProgressListener,
) => ensureQuranPack(onProgress);

export const isQuranPackDownloading = () => Boolean(downloadPromise);

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const pageCache = new Map<number, QuranPageData>();

type PagePriority = "high" | "low";
type PageTask = {
  page: number;
  priority: PagePriority;
  shouldAbort?: () => boolean;
  resolve: (value: QuranPageData | null) => void;
  reject: (error: unknown) => void;
  promise: Promise<QuranPageData | null>;
};

const inFlight = new Map<number, PageTask>();
const highQueue: PageTask[] = [];
const lowQueue: PageTask[] = [];
let isProcessing = false;
let prefetchEpoch = 0;

export const openQuranDatabase = async () => {
  if (!dbPromise) {
    const directory = getDbDirectory();
    dbPromise = directory
      ? SQLite.openDatabaseAsync(QURAN_DB_NAME, undefined, directory)
      : SQLite.openDatabaseAsync(QURAN_DB_NAME);
  }
  return dbPromise;
};

const runQueryTask = async (task: PageTask) => {
  if (task.shouldAbort?.()) {
    return null;
  }
  const db = await openQuranDatabase();
  if (task.shouldAbort?.()) {
    return null;
  }
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM pages WHERE page_number = ? LIMIT 1",
    [task.page],
  );
  if (task.shouldAbort?.()) {
    return null;
  }
  if (!row?.data) {
    return null;
  }
  if (task.shouldAbort?.()) {
    return null;
  }
  const parsed = JSON.parse(row.data) as QuranPageData;
  if (task.shouldAbort?.()) {
    return null;
  }
  return parsed;
};

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;
  while (highQueue.length || lowQueue.length) {
    const task = highQueue.shift() ?? lowQueue.shift();
    if (!task) continue;
    try {
      const result = await runQueryTask(task);
      if (result) {
        pageCache.set(task.page, result);
      }
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      inFlight.delete(task.page);
    }
  }
  isProcessing = false;
};

const promoteTask = (task: PageTask) => {
  if (task.priority === "high") return;
  task.priority = "high";
  const idx = lowQueue.indexOf(task);
  if (idx !== -1) {
    lowQueue.splice(idx, 1);
    highQueue.push(task);
  }
};

export const resetPrefetchQueue = () => {
  prefetchEpoch += 1;
};

export const getQuranPage = (
  page: number,
  options?: {
    priority?: PagePriority;
    shouldAbort?: () => boolean;
  },
): Promise<QuranPageData | null> => {
  if (pageCache.has(page)) {
    return Promise.resolve(pageCache.get(page) ?? null);
  }
  const existing = inFlight.get(page);
  if (existing) {
    if (options?.priority === "high") {
      promoteTask(existing);
      if (options.shouldAbort) {
        existing.shouldAbort = options.shouldAbort;
      } else if (existing.priority !== "low") {
        existing.shouldAbort = undefined;
      }
      processQueue();
    }
    return existing.promise;
  }

  const priority = options?.priority ?? "high";
  let resolve: (value: QuranPageData | null) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<QuranPageData | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const task: PageTask = {
    page,
    priority,
    shouldAbort: options?.shouldAbort,
    resolve: resolve!,
    reject: reject!,
    promise,
  };

  inFlight.set(page, task);
  if (priority === "high") {
    highQueue.push(task);
  } else {
    lowQueue.push(task);
  }
  processQueue();
  return promise;
};

export const prefetchQuranPages = (pages: number[]) => {
  const epoch = prefetchEpoch;
  pages.forEach((page) => {
    if (page < 1 || page > QURAN_TOTAL_PAGES) return;
    if (pageCache.has(page)) return;
    getQuranPage(page, {
      priority: "low",
      shouldAbort: () => prefetchEpoch !== epoch,
    });
  });
};

export const pruneQuranCache = (centerPage: number, radius = 2) => {
  const min = Math.max(1, centerPage - radius);
  const max = Math.min(QURAN_TOTAL_PAGES, centerPage + radius);
  for (const key of pageCache.keys()) {
    if (key < min || key > max) {
      pageCache.delete(key);
    }
  }
};

export const findVerseLocationByKey = async (
  verseKey: string,
): Promise<QuranVerseLookup | null> => {
  if (!verseKey.trim()) return null;
  const db = await openQuranDatabase();
  const needle = `%\"key\":\"${verseKey.trim()}\"%`;
  const rows = await db.getAllAsync<{ page_number: number; data: string }>(
    "SELECT page_number, data FROM pages WHERE data LIKE ? LIMIT 12",
    [needle],
  );

  for (const row of rows) {
    if (!row?.data) continue;
    const parsed = JSON.parse(row.data) as QuranPageData;
    const match = parsed.verses?.find((verse) => verse.key === verseKey);
    if (match) {
      pageCache.set(parsed.page, parsed);
      return {
        page: row.page_number || parsed.page,
        verse: match,
      };
    }
  }

  return null;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const buildSnippet = (source: string, needle: string) => {
  const cleaned = source.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return cleaned.slice(0, 120);
  const start = Math.max(0, idx - 36);
  const end = Math.min(cleaned.length, idx + needle.length + 60);
  return cleaned.slice(start, end).trim();
};

export const searchVersesInLocalPack = async (
  query: string,
  options?: {
    limit?: number;
  },
): Promise<QuranPackSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = await openQuranDatabase();
  const limit = Math.min(40, Math.max(1, options?.limit ?? 15));
  const coarseLimit = Math.max(80, limit * 8);
  const needle = normalizeSearchText(trimmed);

  let rows = await db.getAllAsync<{ page_number: number; data: string }>(
    "SELECT page_number, data FROM pages WHERE data LIKE ? LIMIT ?",
    [`%${trimmed}%`, coarseLimit],
  );

  if (!rows.length && trimmed.includes(" ")) {
    const firstToken = trimmed.split(/\s+/).find((token) => token.length > 1);
    if (firstToken) {
      rows = await db.getAllAsync<{ page_number: number; data: string }>(
        "SELECT page_number, data FROM pages WHERE data LIKE ? LIMIT ?",
        [`%${firstToken}%`, coarseLimit],
      );
    }
  }

  const dedup = new Map<string, QuranPackSearchResult>();
  for (const row of rows) {
    if (!row?.data) continue;
    const parsed = JSON.parse(row.data) as QuranPageData;
    const pageNumber = row.page_number || parsed.page;
    const surahName = parsed.surahName;
    const verseWordMap = new Map<string, string[]>();
    parsed.words?.forEach((word) => {
      const words = verseWordMap.get(word.verseKey) ?? [];
      words.push(word.text);
      verseWordMap.set(word.verseKey, words);
    });

    const verses = parsed.verses ?? [];
    for (const verse of verses) {
      if (!verse.key || dedup.has(verse.key)) continue;
      const arabic = verse.arabic ?? verseWordMap.get(verse.key)?.join(" ") ?? "";
      const translation = verse.translation ?? verse.text;
      const corpus = `${arabic} ${translation ?? ""}`.toLowerCase();
      if (!corpus.includes(needle)) continue;

      const source =
        [arabic, translation].find((value) =>
          (value ?? "").toLowerCase().includes(needle),
        ) ?? arabic ?? translation ?? "";

      dedup.set(verse.key, {
        verseKey: verse.key,
        highlightedText: buildSnippet(source, needle),
        translation: translation || undefined,
        surahName,
        pageNumber,
      });
      if (dedup.size >= limit) {
        return [...dedup.values()];
      }
    }
  }

  return [...dedup.values()];
};
