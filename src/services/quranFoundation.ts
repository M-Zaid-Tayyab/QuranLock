import { convexClient } from "@/services/convexClient";
import {
  getArabicTextByVerseKeysFromLocalPack,
  searchVersesInLocalPack,
} from "@/services/quranPack";

export type QuranFoundationScope = "content" | "search";

interface QuranFoundationProxyGetArgs {
  scope: QuranFoundationScope;
  path: string;
  query?: Record<string, string>;
}

export interface QuranSearchResult {
  verseKey: string;
  highlightedText: string;
  arabicText?: string;
  translation?: string;
  surahName?: string;
  pageNumber?: number;
}

export interface QuranReciter {
  id: number;
  name: string;
}

export interface QuranVerseRecitation {
  verseKey: string;
  reciterId: number;
  url: string;
  durationMs?: number;
}

export const quranFoundationProxyGet = async <TResponse = unknown>(
  args: QuranFoundationProxyGetArgs,
) => {
  if (!convexClient) {
    throw new Error("Missing EXPO_PUBLIC_CONVEX_URL");
  }

  const client = convexClient as unknown as {
    action: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  return client.action("quranFoundation:proxyGet", {
    ...args,
  }) as Promise<TResponse>;
};

const SEARCH_PATH = process.env.EXPO_PUBLIC_QF_SEARCH_PATH ?? "/v1/search";
const SEARCH_MODE = process.env.EXPO_PUBLIC_QF_SEARCH_MODE ?? "advanced";
const SEARCH_SCOPE = process.env.EXPO_PUBLIC_QF_SEARCH_SCOPE ?? "auto";
const SEARCH_FALLBACK_PATHS = [
  process.env.EXPO_PUBLIC_QF_SEARCH_FALLBACK_PATH ?? "/search",
  "/content/api/v4/search",
] as const;
const SEARCH_LOCAL_FALLBACK_ENABLED =
  (process.env.EXPO_PUBLIC_QF_SEARCH_LOCAL_FALLBACK ?? "true") !== "false";
const DEFAULT_VERSIONED_SEARCH_PATH = "/v1/search";
const RECITATION_BY_VERSE_PATH_TEMPLATE =
  process.env.EXPO_PUBLIC_QF_RECITATION_BY_VERSE_PATH_TEMPLATE ??
  "/recitations/{recitation_id}/by_ayah/{ayah_key}";
const RECITATION_BY_CHAPTER_PATH_TEMPLATE =
  process.env.EXPO_PUBLIC_QF_RECITATION_BY_CHAPTER_PATH_TEMPLATE ??
  "/recitations/{recitation_id}/by_chapter/{chapter_number}";
const RECITATION_LIST_PATH_TEMPLATE =
  process.env.EXPO_PUBLIC_QF_RECITATION_LIST_PATH_TEMPLATE ??
  "/recitations/{recitation_id}";
const RECITATION_FALLBACK_PATH_TEMPLATES = [
  "/recitations/{recitation_id}/by_ayah/{ayah_key}",
  "/recitations/{reciterId}/by_ayah/{ayah_key}",
  "/recitations/{reciterId}/by_ayah/{verseKey}",
  "/recitations/{reciter_id}/by_ayah/{ayah_key}",
  "/recitations/{reader_id}/by_ayah/{ayah_key}",
] as const;
const RECITATION_CHAPTER_FALLBACK_PATH_TEMPLATES = [
  "/recitations/{recitation_id}/by_chapter/{chapter_number}",
  "/recitations/{reciterId}/by_chapter/{chapter_number}",
] as const;
const RECITATION_VERSE_QUERY_KEY =
  process.env.EXPO_PUBLIC_QF_RECITATION_VERSE_QUERY_KEY ?? "verse_key";
const RECITATION_RECITER_QUERY_KEY =
  process.env.EXPO_PUBLIC_QF_RECITATION_RECITER_QUERY_KEY ?? "reciter";
const RECITATION_CHAPTER_QUERY_KEY =
  process.env.EXPO_PUBLIC_QF_RECITATION_CHAPTER_QUERY_KEY ?? "chapter_number";
const RECITATION_CHAPTER_PER_PAGE = Math.min(
  50,
  Math.max(1, Number(process.env.EXPO_PUBLIC_QF_RECITATION_CHAPTER_PER_PAGE ?? 50)),
);
const RECITATION_CACHE_MAX_ENTRIES = Math.min(
  1000,
  Math.max(50, Number(process.env.EXPO_PUBLIC_QF_RECITATION_CACHE_MAX ?? 300)),
);

export const DEFAULT_QURAN_RECITERS: QuranReciter[] = [
  { id: 7, name: "Mishary Alafasy" },
  { id: 1, name: "Abdul Basit" },
  { id: 2, name: "Maher Al Muaiqly" },
  { id: 4, name: "Saad Al Ghamdi" },
];
const recitationCache = new Map<string, QuranVerseRecitation>();
const recitationRequestCache = new Map<string, Promise<QuranVerseRecitation>>();
const chapterRecitationCache = new Map<string, Map<string, QuranVerseRecitation>>();
const chapterRecitationRequestCache = new Map<
  string,
  Promise<Map<string, QuranVerseRecitation>>
>();

const getRecitationCacheKey = (verseKey: string, reciterId: number) =>
  `${reciterId}:${verseKey}`;
const getChapterCacheKey = (chapterNumber: number, reciterId: number) =>
  `${reciterId}:${chapterNumber}`;
const getChapterNumberFromVerseKey = (verseKey: string) => {
  const [chapterPart] = verseKey.split(":");
  const chapterNumber = Number(chapterPart);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1 || chapterNumber > 114) {
    return null;
  }
  return Math.trunc(chapterNumber);
};

const cacheRecitation = (value: QuranVerseRecitation) => {
  const key = getRecitationCacheKey(value.verseKey, value.reciterId);
  if (recitationCache.has(key)) {
    recitationCache.delete(key);
  }
  recitationCache.set(key, value);
  while (recitationCache.size > RECITATION_CACHE_MAX_ENTRIES) {
    const oldestKey = recitationCache.keys().next().value;
    if (!oldestKey) break;
    recitationCache.delete(oldestKey);
  }
};

const buildChapterRecitationPath = (template: string, chapterNumber: number, reciterId: number) =>
  sanitizeProxyPath(
    template
      .replaceAll("{chapterNumber}", String(chapterNumber))
      .replaceAll("{chapter_number}", String(chapterNumber))
      .replaceAll("{chapter}", String(chapterNumber))
      .replaceAll("{reciterId}", String(reciterId))
      .replaceAll("{reciter_id}", String(reciterId))
      .replaceAll("{reciter}", String(reciterId))
      .replaceAll("{recitation_id}", String(reciterId))
      .replaceAll("{id}", String(reciterId))
      .replaceAll("{readerId}", String(reciterId))
      .replaceAll("{reader_id}", String(reciterId)),
  );

const toStringValue = (value: unknown) =>
  typeof value === "string" ? value : null;

const toNumberValue = (value: unknown) =>
  typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

const isInvalidScopeError = (error: unknown) => {
  const message = normalizeErrorMessage(error).toLowerCase();
  return message.includes("invalid_scope");
};

const isInvalidPathError = (error: unknown) => {
  const message = normalizeErrorMessage(error).toLowerCase();
  return message.includes("invalid_path");
};

const isSearchPermissionError = (error: unknown) => {
  const message = normalizeErrorMessage(error).toLowerCase();
  return (
    message.includes("forbidden") ||
    message.includes("permission") ||
    message.includes("does not have the required \"search\" scope") ||
    message.includes("does not have the required 'search' scope")
  );
};

const toVerseKey = (record: Record<string, unknown>) => {
  const direct =
    toStringValue(record.verse_key) ??
    toStringValue(record.verseKey) ??
    toStringValue(record.key);
  if (direct) return direct;

  const chapterId =
    toNumberValue(record.chapter_id) ??
    toNumberValue(record.chapterId) ??
    toNumberValue(record.surah);
  const verseNumber =
    toNumberValue(record.verse_number) ??
    toNumberValue(record.verseNumber) ??
    toNumberValue(record.ayah);
  if (
    chapterId != null &&
    verseNumber != null &&
    Number.isFinite(chapterId) &&
    Number.isFinite(verseNumber)
  ) {
    return `${Math.trunc(chapterId)}:${Math.trunc(verseNumber)}`;
  }
  return null;
};

const sanitizeProxyPath = (value: string) => {
  if (!value.includes("://")) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
};

const isVerseKeyQuery = (value: string) => /^\d{1,3}:\d{1,3}$/.test(value.trim());

const isVersionedSearchPath = (path: string) => /^\/v\d+\//.test(path.trim());

const resolveAudioBaseUrl = () => {
  const normalizeBase = (value: string | undefined | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (
        host === "apis.quran.foundation" ||
        host === "apis-prelive.quran.foundation"
      ) {
        return "https://verses.quran.foundation";
      }
    } catch {
      // Keep raw value when parsing fails.
    }
    return trimmed;
  };

  return (
    normalizeBase(process.env.EXPO_PUBLIC_QF_AUDIO_BASE_URL) ??
    normalizeBase(process.env.EXPO_PUBLIC_QF_CONTENT_API_BASE_URL) ??
    "https://verses.quran.foundation"
  );
};

const normalizeAudioUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const audioBaseUrl = resolveAudioBaseUrl();
  if (!audioBaseUrl) return trimmed;
  const base = audioBaseUrl.replace(/\/+$/, "");
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const extractAudioPayload = (payload: unknown) => {
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (current == null || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === "string") {
      const normalized = normalizeAudioUrl(current);
      if (normalized) {
        return { url: normalized, durationMs: undefined };
      }
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) continue;

    const urlCandidate =
      toStringValue(current.url) ??
      toStringValue(current.audio_url) ??
      toStringValue(current.audioUrl) ??
      toStringValue(current.file_url) ??
      toStringValue(current.fileUrl) ??
      toStringValue(current.stream_url) ??
      toStringValue(current.streamUrl) ??
      toStringValue(current.mp3);

    if (urlCandidate) {
      const normalized = normalizeAudioUrl(urlCandidate);
      if (normalized) {
        const durationMs =
          toNumberValue(current.duration_ms) ??
          toNumberValue(current.durationMs) ??
          (() => {
            const seconds =
              toNumberValue(current.duration) ?? toNumberValue(current.seconds);
            return seconds != null && Number.isFinite(seconds)
              ? Math.max(0, seconds * 1000)
              : null;
          })() ??
          undefined;
        return {
          url: normalized,
          durationMs:
            durationMs != null && Number.isFinite(durationMs)
              ? Number(durationMs)
              : undefined,
        };
      }
    }

    const nestedCandidates = [
      current.audio_file,
      current.audioFile,
      current.audio,
      current.recitation,
      current.result,
      current.data,
      current.attributes,
      current.files,
      current.audio_files,
      current.audioFiles,
      current.results,
      current.verse,
    ];
    nestedCandidates.forEach((entry) => {
      if (entry != null) queue.push(entry);
    });
  }

  return null;
};

const extractRecitationDurationMs = (record: Record<string, unknown>) => {
  const milliseconds =
    toNumberValue(record.duration_ms) ??
    toNumberValue(record.durationMs) ??
    null;
  if (milliseconds != null && Number.isFinite(milliseconds)) {
    return Math.max(0, Number(milliseconds));
  }
  const seconds =
    toNumberValue(record.duration) ??
    toNumberValue(record.seconds) ??
    null;
  if (seconds != null && Number.isFinite(seconds)) {
    return Math.max(0, Number(seconds) * 1000);
  }
  return undefined;
};

const extractChapterRecitationsFromPayload = (
  payload: unknown,
  reciterId: number,
): QuranVerseRecitation[] => {
  const entries = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.audio_files)
      ? payload.audio_files
      : [];

  const results: QuranVerseRecitation[] = [];
  entries.forEach((entry) => {
    if (!isRecord(entry)) return;
    const verseKey =
      toStringValue(entry.verse_key) ??
      toStringValue(entry.verseKey) ??
      toStringValue(entry.key);
    const rawUrl =
      toStringValue(entry.url) ??
      toStringValue(entry.audio_url) ??
      toStringValue(entry.file_url);
    if (!verseKey || !rawUrl) return;
    const normalizedUrl = normalizeAudioUrl(rawUrl);
    if (!normalizedUrl) return;
    results.push({
      verseKey,
      reciterId,
      url: normalizedUrl,
      durationMs: extractRecitationDurationMs(entry),
    });
  });
  return results;
};

const hasTemplatePlaceholder = (template: string, names: string[]) =>
  names.some((name) => template.includes(`{${name}}`));

const buildRecitationPath = (
  template: string,
  verseKey: string,
  reciterId: number,
) => {
  const verseParam = encodeURIComponent(verseKey);
  const reciterParam = String(reciterId);
  return sanitizeProxyPath(
    template.replaceAll(
      "{verseKey}",
      verseParam,
    )
      .replaceAll("{verse_key}", verseParam)
      .replaceAll("{ayahKey}", verseParam)
      .replaceAll("{ayah_key}", verseParam)
      .replaceAll("{reciterId}", reciterParam)
      .replaceAll("{reciter_id}", reciterParam)
      .replaceAll("{reciter}", reciterParam)
      .replaceAll("{recitation_id}", reciterParam)
      .replaceAll("{readerId}", reciterParam)
      .replaceAll("{reader_id}", reciterParam),
  );
};

const normalizeSearchItem = (item: unknown): QuranSearchResult | null => {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const chapter =
    record.chapter && typeof record.chapter === "object"
      ? (record.chapter as Record<string, unknown>)
      : null;

  const verseKey = toVerseKey(record);
  if (!verseKey) return null;

  const highlightedText =
    toStringValue(record.highlighted) ??
    toStringValue(record.snippet) ??
    toStringValue(record.matched_text) ??
    toStringValue(record.matchedText) ??
    toStringValue(record.name) ??
    toStringValue(record.text) ??
    "";

  const arabicText =
    toStringValue(record.text_uthmani) ??
    toStringValue(record.text_imlaei) ??
    toStringValue(record.uthmani_text) ??
    toStringValue(record.imlaei_text) ??
    toStringValue(record.text_arabic) ??
    toStringValue(record.arabic);

  const translation =
    toStringValue(record.translation) ??
    toStringValue(record.translated_text) ??
    toStringValue(record.text_translation) ??
    toStringValue(record.translation_text);

  const surahName =
    toStringValue(record.chapter_name) ??
    toStringValue(record.surah_name) ??
    toStringValue(chapter?.name_simple) ??
    toStringValue(chapter?.name_arabic);

  const pageNumber =
    toNumberValue(record.page_number) ??
    toNumberValue(record.page) ??
    toNumberValue(record.pageNumber) ??
    undefined;

  return {
    verseKey,
    highlightedText,
    arabicText: arabicText ?? undefined,
    translation: translation ?? undefined,
    surahName: surahName ?? undefined,
    pageNumber: Number.isFinite(pageNumber) ? Number(pageNumber) : undefined,
  };
};

const getArrayCandidate = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return [];
};

const normalizeSearchPayload = (payload: unknown): QuranSearchResult[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizeSearchItem(entry))
      .filter((entry): entry is QuranSearchResult => Boolean(entry));
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidates = [
    ...getArrayCandidate(record.results),
    ...getArrayCandidate(record.hits),
    ...getArrayCandidate(record.matches),
    ...getArrayCandidate(record.data),
    ...getArrayCandidate(record.verses),
  ];

  if (record.search && typeof record.search === "object") {
    const nested = record.search as Record<string, unknown>;
    candidates.push(...getArrayCandidate(nested.results));
    candidates.push(...getArrayCandidate(nested.hits));
    candidates.push(...getArrayCandidate(nested.verses));
  }

  if (record.result && typeof record.result === "object") {
    const nested = record.result as Record<string, unknown>;
    candidates.push(...getArrayCandidate(nested.results));
    candidates.push(...getArrayCandidate(nested.hits));
    candidates.push(...getArrayCandidate(nested.matches));
    candidates.push(...getArrayCandidate(nested.data));
    candidates.push(...getArrayCandidate(nested.verses));
  }

  if (candidates.length === 0) {
    candidates.push(record);
  }

  const dedup = new Map<string, QuranSearchResult>();
  candidates.forEach((entry) => {
    const normalized = normalizeSearchItem(entry);
    if (!normalized) return;
    dedup.set(normalized.verseKey, normalized);
  });
  return [...dedup.values()];
};

const hydrateArabicSearchResults = async (results: QuranSearchResult[]) => {
  const missingArabic = results
    .filter((item) => !item.arabicText)
    .map((item) => item.verseKey);
  if (!missingArabic.length) {
    return results;
  }

  try {
    const arabicByKey = await getArabicTextByVerseKeysFromLocalPack(missingArabic);
    if (!arabicByKey.size) {
      return results;
    }
    return results.map((item) => ({
      ...item,
      arabicText: item.arabicText ?? arabicByKey.get(item.verseKey),
    }));
  } catch {
    return results;
  }
};

export const searchQuranVerses = async (
  query: string,
  options?: {
    page?: number;
    size?: number;
  },
) => {
  const trimmed = query.trim();
  if (!trimmed) return [] as QuranSearchResult[];
  const normalizedMode = SEARCH_MODE.toLowerCase() === "quick" ? "quick" : "advanced";
  const termParam = normalizedMode === "quick" ? "q" : "query";
  const commonQuery = {
    mode: normalizedMode,
    [termParam]: trimmed,
    page: String(Math.max(1, options?.page ?? 1)),
    size: String(Math.min(20, Math.max(1, options?.size ?? 10))),
  };
  const verseKeyQuery = isVerseKeyQuery(trimmed);
  const normalizedScope = SEARCH_SCOPE.toLowerCase();
  const scopeOrder: QuranFoundationScope[] = verseKeyQuery
    ? normalizedScope === "content"
      ? ["content", "search"]
      : normalizedScope === "search"
        ? ["search", "content"]
        : ["search", "content"]
    : normalizedScope === "content"
      ? ["content", "search"]
      : ["search"];
  const pathCandidatesBase = [
    SEARCH_PATH,
    ...SEARCH_FALLBACK_PATHS.filter((path) => path !== SEARCH_PATH),
  ];
  const pathCandidates = verseKeyQuery
    ? pathCandidatesBase
    : (() => {
        const versionedOnly = pathCandidatesBase.filter(isVersionedSearchPath);
        if (versionedOnly.length) {
          return versionedOnly;
        }
        return [DEFAULT_VERSIONED_SEARCH_PATH];
      })();
  const attempts: QuranFoundationProxyGetArgs[] = [];
  const pushAttempt = (scope: QuranFoundationScope, path: string) => {
    if (!path) return;
    if (attempts.some((attempt) => attempt.scope === scope && attempt.path === path)) {
      return;
    }
    attempts.push({
      scope,
      path,
      query: commonQuery,
    });
  };

  scopeOrder.forEach((scope) => {
    pathCandidates.forEach((path) => {
      pushAttempt(scope, path);
    });
  });

  let lastError: unknown = null;
  let sawScopeOrPermissionError = false;
  for (const attempt of attempts) {
    try {
      const payload = await quranFoundationProxyGet<unknown>(attempt);
      const normalized = normalizeSearchPayload(payload);
      return await hydrateArabicSearchResults(normalized);
    } catch (error) {
      lastError = error;
      if (isInvalidScopeError(error) || isSearchPermissionError(error)) {
        sawScopeOrPermissionError = true;
      }
      continue;
    }
  }

  if (SEARCH_LOCAL_FALLBACK_ENABLED) {
    try {
      const localResults = await searchVersesInLocalPack(trimmed, {
        limit: Math.min(20, Math.max(1, options?.size ?? 10)),
      });
      if (localResults.length) {
        return localResults;
      }
    } catch {
      // Ignore local fallback errors and keep the API error as primary.
    }
  }

  if (sawScopeOrPermissionError || isInvalidScopeError(lastError)) {
    throw new Error(
      "Search API is not enabled for this OAuth client. Ask Quran Foundation to grant the `search` scope for your client ID.",
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to search right now. Please try again.");
};

const resolveVerseRecitationAudio = async (
  verseKey: string,
  reciterId: number,
) => {
  const trimmedVerseKey = verseKey.trim();
  if (!trimmedVerseKey) {
    throw new Error("Missing verse key for recitation");
  }

  const templates = [
    RECITATION_BY_VERSE_PATH_TEMPLATE,
    ...RECITATION_FALLBACK_PATH_TEMPLATES,
  ];
  const seenAttempts = new Set<string>();
  let lastError: unknown = null;

  for (const template of templates) {
    const path = buildRecitationPath(template, trimmedVerseKey, reciterId);
    const query: Record<string, string> = {};

    const hasVersePlaceholder = hasTemplatePlaceholder(template, [
      "verseKey",
      "verse_key",
      "ayahKey",
      "ayah_key",
    ]);
    const hasReciterPlaceholder = hasTemplatePlaceholder(template, [
      "reciterId",
      "reciter_id",
      "reciter",
      "recitation_id",
      "readerId",
      "reader_id",
    ]);

    if (!hasVersePlaceholder) {
      query[RECITATION_VERSE_QUERY_KEY] = trimmedVerseKey;
    }
    if (!hasReciterPlaceholder) {
      query[RECITATION_RECITER_QUERY_KEY] = String(reciterId);
    }

    const attemptKey = `${path}?${JSON.stringify(query)}`;
    if (seenAttempts.has(attemptKey)) continue;
    seenAttempts.add(attemptKey);

    try {
      const payload = await quranFoundationProxyGet<unknown>({
        scope: "content",
        path,
        query: Object.keys(query).length ? query : undefined,
      });
      const audioPayload = extractAudioPayload(payload);
      if (!audioPayload?.url) {
        throw new Error("Audio stream not available for this verse");
      }

      return {
        verseKey: trimmedVerseKey,
        reciterId,
        url: audioPayload.url,
        durationMs: audioPayload.durationMs,
      } satisfies QuranVerseRecitation;
    } catch (error) {
      lastError = error;
      if (isInvalidPathError(error)) {
        continue;
      }
      throw error instanceof Error
        ? error
        : new Error("Unable to load recitation for this verse.");
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load recitation for this verse.");
};

export const fetchVerseRecitationAudio = async (
  verseKey: string,
  reciterId: number,
) => {
  const trimmedVerseKey = verseKey.trim();
  if (!trimmedVerseKey) {
    throw new Error("Missing verse key for recitation");
  }

  const key = getRecitationCacheKey(trimmedVerseKey, reciterId);
  const cached = recitationCache.get(key);
  if (cached) {
    recitationCache.delete(key);
    recitationCache.set(key, cached);
    return cached;
  }
  const chapterNumber = getChapterNumberFromVerseKey(trimmedVerseKey);
  if (chapterNumber != null) {
    const chapterKey = getChapterCacheKey(chapterNumber, reciterId);
    const chapterCached = chapterRecitationCache.get(chapterKey)?.get(trimmedVerseKey);
    if (chapterCached) {
      cacheRecitation(chapterCached);
      return chapterCached;
    }
  }

  const pending = recitationRequestCache.get(key);
  if (pending) {
    return pending;
  }

  const request = resolveVerseRecitationAudio(trimmedVerseKey, reciterId)
    .then((result) => {
      cacheRecitation(result);
      return result;
    })
    .finally(() => {
      recitationRequestCache.delete(key);
    });

  recitationRequestCache.set(key, request);
  return request;
};

export const fetchChapterVerseRecitations = async (
  chapterNumber: number,
  reciterId: number,
) => {
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1 || chapterNumber > 114) {
    throw new Error("Invalid chapter number for recitation prefetch");
  }
  const normalizedChapter = Math.trunc(chapterNumber);
  const chapterKey = getChapterCacheKey(normalizedChapter, reciterId);
  const cached = chapterRecitationCache.get(chapterKey);
  if (cached) {
    return cached;
  }
  const pending = chapterRecitationRequestCache.get(chapterKey);
  if (pending) {
    return pending;
  }

  const chapterTemplates = [
    RECITATION_BY_CHAPTER_PATH_TEMPLATE,
    ...RECITATION_CHAPTER_FALLBACK_PATH_TEMPLATES,
  ];
  const listTemplates = [
    RECITATION_LIST_PATH_TEMPLATE,
    "/recitations/{recitation_id}",
    "/recitations/{reciterId}",
  ];
  const seenAttemptKeys = new Set<string>();

  const request = (async () => {
    let lastError: unknown = null;
    for (const template of chapterTemplates) {
      const path = buildChapterRecitationPath(template, normalizedChapter, reciterId);
      if (!path || path.includes("{")) continue;
      const useChapterQueryFilter = !path.includes("/by_chapter/");
      const attemptKey = `${path}:${useChapterQueryFilter ? "query" : "path"}`;
      if (seenAttemptKeys.has(attemptKey)) continue;
      seenAttemptKeys.add(attemptKey);

      const all = new Map<string, QuranVerseRecitation>();
      let page = 1;
      let totalPages = 1;
      try {
        while (page <= totalPages) {
          const query: Record<string, string> = useChapterQueryFilter
            ? {
                [RECITATION_CHAPTER_QUERY_KEY]: String(normalizedChapter),
              }
            : {
                page: String(page),
                per_page: String(RECITATION_CHAPTER_PER_PAGE),
              };
          const payload = await quranFoundationProxyGet<unknown>({
            scope: "content",
            path,
            query,
          });
          const recitations = extractChapterRecitationsFromPayload(payload, reciterId);
          if (!recitations.length) {
            break;
          }
          recitations.forEach((recitation) => {
            all.set(recitation.verseKey, recitation);
            cacheRecitation(recitation);
          });
          if (useChapterQueryFilter) {
            break;
          }
          const pagination = isRecord(payload) && isRecord(payload.pagination)
            ? payload.pagination
            : null;
          const nextPage =
            pagination && "next_page" in pagination
              ? toNumberValue(pagination.next_page)
              : null;
          const parsedTotalPages =
            pagination && "total_pages" in pagination
              ? toNumberValue(pagination.total_pages)
              : null;
          totalPages =
            parsedTotalPages != null && Number.isFinite(parsedTotalPages)
              ? Math.max(1, Math.trunc(parsedTotalPages))
              : totalPages;
          if (nextPage != null && Number.isFinite(nextPage)) {
            page = Math.trunc(nextPage);
          } else {
            page += 1;
          }
          if (page > 20) {
            break;
          }
        }

        if (all.size > 0) {
          chapterRecitationCache.set(chapterKey, all);
          return all;
        }
      } catch (error) {
        lastError = error;
        if (isInvalidPathError(error)) {
          continue;
        }
        throw error;
      }
    }

    for (const template of listTemplates) {
      const path = buildChapterRecitationPath(template, normalizedChapter, reciterId);
      if (!path || path.includes("{")) continue;
      const attemptKey = `${path}:list`;
      if (seenAttemptKeys.has(attemptKey)) continue;
      seenAttemptKeys.add(attemptKey);

      try {
        const payload = await quranFoundationProxyGet<unknown>({
          scope: "content",
          path,
          query: {
            [RECITATION_CHAPTER_QUERY_KEY]: String(normalizedChapter),
          },
        });
        const recitations = extractChapterRecitationsFromPayload(payload, reciterId);
        if (!recitations.length) {
          continue;
        }
        const all = new Map<string, QuranVerseRecitation>();
        recitations.forEach((recitation) => {
          all.set(recitation.verseKey, recitation);
          cacheRecitation(recitation);
        });
        chapterRecitationCache.set(chapterKey, all);
        return all;
      } catch (error) {
        lastError = error;
        if (isInvalidPathError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Unable to load chapter recitations.");
  })().finally(() => {
    chapterRecitationRequestCache.delete(chapterKey);
  });

  chapterRecitationRequestCache.set(chapterKey, request);
  return request;
};

export const prefetchVerseRecitationAudio = async (
  verseKeys: string[],
  reciterId: number,
  options?: {
    limit?: number;
    concurrency?: number;
  },
) => {
  const deduped = [...new Set(verseKeys.map((key) => key.trim()).filter(Boolean))];
  if (!deduped.length) return;
  const chapterGroups = new Map<number, string[]>();
  deduped.forEach((verseKey) => {
    const chapterNumber = getChapterNumberFromVerseKey(verseKey);
    if (chapterNumber == null) return;
    const list = chapterGroups.get(chapterNumber) ?? [];
    list.push(verseKey);
    chapterGroups.set(chapterNumber, list);
  });
  for (const chapterNumber of chapterGroups.keys()) {
    try {
      await fetchChapterVerseRecitations(chapterNumber, reciterId);
    } catch {
      // Fall back to per-verse prefetch below.
    }
  }
  const limit = Math.min(80, Math.max(1, options?.limit ?? deduped.length));
  const concurrency = Math.min(8, Math.max(1, options?.concurrency ?? 4));
  const targets = deduped.slice(0, limit);
  let cursor = 0;

  const worker = async () => {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      const verseKey = targets[index];
      try {
        await fetchVerseRecitationAudio(verseKey, reciterId);
      } catch {
        // Silent prefetch failure; playback path still handles retries/errors.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, () =>
      worker(),
    ),
  );
};
