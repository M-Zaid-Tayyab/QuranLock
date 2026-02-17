export const STORE_KEYS = {
  BLOCKING_STORE: "blocking-store",
  USER_STORE: "user-store",
  VERSE_STORE: "verse-store",
} as const;

export type StoreKeys = keyof typeof STORE_KEYS;
