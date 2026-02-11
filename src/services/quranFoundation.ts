import { convexClient } from "@/services/convexClient";
import { searchVersesInLocalPack } from "@/services/quranPack";

export type QuranFoundationScope = "content" | "search";

interface QuranFoundationProxyGetArgs {
  scope: QuranFoundationScope;
  path: string;
  query?: Record<string, string>;
}

export interface QuranSearchResult {
  verseKey: string;
  highlightedText: string;
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
const RECITATION_BY_VERSE_PATH_TEMPLATE =
  process.env.EXPO_PUBLIC_QF_RECITATION_BY_VERSE_PATH_TEMPLATE ??
  "/recitations/{recitation_id}/by_ayah/{ayah_key}";
const RECITATION_FALLBACK_PATH_TEMPLATES = [
  "/recitations/{recitation_id}/by_ayah/{ayah_key}",
  "/recitations/{reciterId}/by_ayah/{ayah_key}",
  "/recitations/{reciterId}/by_ayah/{verseKey}",
  "/recitations/{reciter_id}/by_ayah/{ayah_key}",
  "/recitations/{reader_id}/by_ayah/{ayah_key}",
] as const;
const RECITATION_VERSE_QUERY_KEY =
  process.env.EXPO_PUBLIC_QF_RECITATION_VERSE_QUERY_KEY ?? "verse_key";
const RECITATION_RECITER_QUERY_KEY =
  process.env.EXPO_PUBLIC_QF_RECITATION_RECITER_QUERY_KEY ?? "reciter";

export const DEFAULT_QURAN_RECITERS: QuranReciter[] = [
  { id: 7, name: "Mishary Alafasy" },
  { id: 1, name: "Abdul Basit" },
  { id: 2, name: "Maher Al Muaiqly" },
  { id: 4, name: "Saad Al Ghamdi" },
];

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
    toStringValue(record.text_uthmani) ??
    "";

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
  const normalizedScope = SEARCH_SCOPE.toLowerCase();
  const scopeOrder: QuranFoundationScope[] =
    normalizedScope === "content"
      ? ["content", "search"]
      : normalizedScope === "search"
        ? ["search", "content"]
        : ["search", "content"];
  const pathCandidates = [
    SEARCH_PATH,
    ...SEARCH_FALLBACK_PATHS.filter((path) => path !== SEARCH_PATH),
  ];
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
      return normalizeSearchPayload(payload);
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

export const fetchVerseRecitationAudio = async (
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
