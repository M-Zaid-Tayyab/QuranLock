import { resetAppConfigStore } from "./appConfig";
import { resetBlockingStore } from "./blocking";
import { resetUserStore } from "./user";
import { resetVerseStore } from "./verse";

export { resetAppConfigStore, useAppConfigStore } from "./appConfig";
export { resetBlockingStore, useBlockingStore } from "./blocking";
export type { BlockingState } from "./blocking";
export { resetUserStore, useUserStore } from "./user";
export type { UserState } from "./user";
export { resetVerseStore, useVerseStore } from "./verse";
export type { ReadingMode as VerseReadingMode, VerseState } from "./verse";

export const resetAllStores = () => {
  resetBlockingStore();
  resetVerseStore();
  resetAppConfigStore();
  resetUserStore();
};
