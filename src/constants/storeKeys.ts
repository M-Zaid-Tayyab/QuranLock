export const STORE_KEYS = {
  APP_CONFIG_STORE: "app-config-store",
  BLOCKING_STORE: "blocking-store",
  USER_STORE: "user-store",
  VERSE_STORE: "verse-store",
} as const;

export type StoreKeys = keyof typeof STORE_KEYS;
