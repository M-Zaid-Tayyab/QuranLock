import { convexClient } from "@/services/convexClient";
import {
  findVerseLocationByKey,
  searchVersesInLocalPack,
} from "@/services/quranPack";

export type QuranFoundationScope = "content";

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

const isInvalidPathError = (error: unknown) =>
  normalizeErrorMessage(error).toLowerCase().includes("invalid_path");

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

const searchLocalQuranVerses = async (query: string, limit: number) => {
  try {
    if (isVerseKeyQuery(query)) {
      const lookup = await findVerseLocationByKey(query);
      if (!lookup) return [];
      const highlightedText =
        lookup.verse.translation ?? lookup.verse.arabic ?? lookup.verse.key;
      return [
        {
          verseKey: lookup.verse.key,
          highlightedText,
          arabicText: lookup.verse.arabic,
          translation: lookup.verse.translation,
          pageNumber: lookup.page,
        },
      ] satisfies QuranSearchResult[];
    }

    return await searchVersesInLocalPack(query, { limit });
  } catch {
    return [];
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
  const resultLimit = Math.min(20, Math.max(1, options?.size ?? 10));
  return await searchLocalQuranVerses(trimmed, resultLimit);
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
