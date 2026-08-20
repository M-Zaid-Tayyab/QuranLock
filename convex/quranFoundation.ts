import { v } from "convex/values";
import { action } from "./_generated/server";

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const TOKEN_DEFAULT_TTL_MS = 3_600_000;

const SCOPE_VALIDATOR = v.literal("content");
type QuranFoundationScope = "content";
type QfEnvironment = "prelive" | "production";
type RequiredEnvironmentKey = "QF_CLIENT_ID" | "QF_CLIENT_SECRET";

const tokenCache = new Map<
  QuranFoundationScope,
  {
    accessToken: string;
    expiresAt: number;
  }
>();
const tokenRequestCache = new Map<QuranFoundationScope, Promise<string>>();

const ENV_CONFIG: Record<
  QfEnvironment,
  { authBaseUrl: string; apiBaseUrl: string }
> = {
  prelive: {
    authBaseUrl: "https://prelive-oauth2.quran.foundation",
    apiBaseUrl: "https://apis-prelive.quran.foundation",
  },
  production: {
    authBaseUrl: "https://oauth2.quran.foundation",
    apiBaseUrl: "https://apis.quran.foundation",
  },
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");
const trimLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const getRequiredEnv = (key: RequiredEnvironmentKey) => {
  const value =
    key === "QF_CLIENT_ID"
      ? process.env.QF_CLIENT_ID
      : process.env.QF_CLIENT_SECRET;
  if (!value) {
    throw new Error(`Missing required Convex env var: ${key}`);
  }
  return value;
};

const getConfiguredEnvironment = (): QfEnvironment | null => {
  const envValue = process.env.QF_ENV?.trim().toLowerCase();
  if (!envValue) return null;
  if (envValue === "prelive" || envValue === "production") {
    return envValue;
  }
  return null;
};

const getTokenUrl = () => {
  const explicitUrl = process.env.QF_OAUTH_TOKEN_URL;
  if (explicitUrl) return explicitUrl;

  const envConfig = getConfiguredEnvironment();
  const baseUrl =
    process.env.QF_OAUTH_BASE_URL ??
    (envConfig ? ENV_CONFIG[envConfig].authBaseUrl : undefined);
  if (!baseUrl) {
    throw new Error(
      "Missing OAuth token URL. Set QF_OAUTH_TOKEN_URL, QF_OAUTH_BASE_URL, or QF_ENV.",
    );
  }
  const tokenPath = process.env.QF_OAUTH_TOKEN_PATH ?? "/oauth2/token";
  const base = trimTrailingSlashes(baseUrl);
  const path = trimLeadingSlashes(tokenPath);
  return `${base}/${path}`;
};

const getApiBaseUrl = () => {
  const environment = getConfiguredEnvironment();
  const envConfig = environment ? ENV_CONFIG[environment] : null;
  const scoped = process.env.QF_CONTENT_API_BASE_URL;
  const fallback = process.env.QF_API_BASE_URL;
  const value = scoped ?? fallback ?? envConfig?.apiBaseUrl;
  if (!value) {
    throw new Error(
      "Missing Quran Foundation content API base URL. Set QF_CONTENT_API_BASE_URL, QF_API_BASE_URL, or QF_ENV.",
    );
  }
  return trimTrailingSlashes(value);
};

const buildUrl = (
  baseUrl: string,
  path: string,
  query: Record<string, string> | undefined,
) => {
  if (!path || path.includes("://") || path.startsWith("//")) {
    throw new Error("Invalid Quran Foundation path");
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
};

const parseJsonOrText = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

const isInvalidPathError = (error: unknown) =>
  normalizeErrorMessage(error).toLowerCase().includes("invalid_path");

const normalizePath = (value: string) =>
  value.startsWith("/") ? value : `/${value}`;

const isVersionedPath = (path: string) => /^\/(?:api\/)?v\d+\//.test(path);

const buildPathCandidates = (path: string) => {
  const normalized = normalizePath(path);
  if (isVersionedPath(normalized)) {
    return [normalized];
  }

  let candidates: string[];
  if (/^\/content\/api\/v4(\/|$)/.test(normalized)) {
    candidates = [
      normalized,
      normalized.replace(/^\/content\/api\/v4/, "/api/v4"),
      normalized.replace(/^\/content\/api\/v4/, ""),
    ];
  } else if (/^\/api\/v4(\/|$)/.test(normalized)) {
    candidates = [
      `/content${normalized}`,
      normalized,
      normalized.replace(/^\/api\/v4/, ""),
    ];
  } else {
    candidates = [
      `/content/api/v4${normalized}`,
      `/api/v4${normalized}`,
      normalized,
    ];
  }

  const dedup = new Set<string>();
  return candidates.filter((candidate) => {
    if (!candidate || candidate === "/" || dedup.has(candidate)) return false;
    dedup.add(candidate);
    return true;
  });
};

const RETRYABLE_PATH_ERROR_TYPES = new Set(["invalid_path", "not_found"]);

const isRetryablePathPayload = (data: unknown) =>
  isRecord(data) &&
  typeof data.type === "string" &&
  RETRYABLE_PATH_ERROR_TYPES.has(data.type);

const toErrorPayload = (data: unknown) => {
  if (typeof data === "string") return data.slice(0, 300);
  if (data == null) return "No response body";
  try {
    return JSON.stringify(data).slice(0, 300);
  } catch {
    return "Unable to stringify error payload";
  }
};

const getAccessToken = async (scope: QuranFoundationScope): Promise<string> => {
  const cached = tokenCache.get(scope);
  const now = Date.now();
  if (cached && cached.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return cached.accessToken;
  }

  const pending = tokenRequestCache.get(scope);
  if (pending) {
    return pending;
  }

  const request: Promise<string> = (async (): Promise<string> => {
    const tokenUrl = getTokenUrl();
    const clientId = getRequiredEnv("QF_CLIENT_ID");
    const clientSecret = getRequiredEnv("QF_CLIENT_SECRET");

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope,
    });
    const basicAuth =
      typeof btoa === "function" ? btoa(`${clientId}:${clientSecret}`) : null;
    if (!basicAuth) {
      body.set("client_id", clientId);
      body.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        ...(basicAuth ? { authorization: `Basic ${basicAuth}` } : {}),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: body.toString(),
    });

    const tokenPayload = await parseJsonOrText(response);
    if (!response.ok) {
      throw new Error(
        `QF token request failed (${response.status}): ${toErrorPayload(tokenPayload)}`,
      );
    }

    const accessToken =
      tokenPayload &&
      typeof tokenPayload === "object" &&
      "access_token" in tokenPayload
        ? tokenPayload.access_token
        : null;

    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("QF token response missing access_token");
    }

    const expiresInSeconds =
      tokenPayload &&
      typeof tokenPayload === "object" &&
      "expires_in" in tokenPayload &&
      typeof tokenPayload.expires_in === "number"
        ? tokenPayload.expires_in
        : TOKEN_DEFAULT_TTL_MS / 1000;
    const expiresAt =
      Date.now() + Math.max(expiresInSeconds * 1000, TOKEN_REFRESH_BUFFER_MS);
    tokenCache.set(scope, { accessToken, expiresAt });
    return accessToken;
  })();

  tokenRequestCache.set(scope, request);
  try {
    return await request;
  } finally {
    tokenRequestCache.delete(scope);
  }
};

export const proxyGet = action({
  args: {
    scope: SCOPE_VALIDATOR,
    path: v.string(),
    query: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const clientId = getRequiredEnv("QF_CLIENT_ID");
    const accessToken = await getAccessToken(args.scope);
    const baseUrl = getApiBaseUrl();
    const pathCandidates = buildPathCandidates(args.path);
    let lastFailure: { status: number; path: string; payload: unknown } | null =
      null;

    for (const path of pathCandidates) {
      const url = buildUrl(baseUrl, path, args.query);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-client-id": clientId,
          "x-auth-token": accessToken,
        },
      });

      const data = await parseJsonOrText(response);
      if (response.ok) {
        return data;
      }

      lastFailure = { status: response.status, path, payload: data };
      if (!isRetryablePathPayload(data)) {
        throw new Error(
          `QF API request failed (${response.status}) [scope=${args.scope} path=${path}]: ${toErrorPayload(data)}`,
        );
      }
    }

    if (lastFailure) {
      throw new Error(
        `QF API request failed (${lastFailure.status}) [scope=${args.scope} path=${lastFailure.path}]: ${toErrorPayload(lastFailure.payload)}`,
      );
    }
    throw new Error(
      `QF API request failed [scope=${args.scope} path=${args.path}]: unknown error`,
    );
  },
});
