import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReadingMode = "mushaf" | "study";

const TRANSLATION_READING_MODE: ReadingMode = "study";

export interface VerseState {
  translationEnabled: boolean;
  readingMode: ReadingMode;
  recitationVisible: boolean;
  selectedVerseKey: string | null;
  hasMigratedFromUserStore: boolean;
}

interface VerseActions {
  hydrateFromUserTranslation: (value: boolean) => void;
  setTranslationEnabled: (value: boolean) => void;
  toggleTranslationEnabled: () => void;
  setReadingMode: (mode: ReadingMode) => void;
  toggleReadingMode: () => void;
  setRecitationVisible: (value: boolean) => void;
  toggleRecitationVisible: () => void;
  setSelectedVerseKey: (value: string | null) => void;
}

const initialState: VerseState = {
  translationEnabled: false,
  readingMode: "mushaf",
  recitationVisible: true,
  selectedVerseKey: null,
  hasMigratedFromUserStore: false,
};

const createInitialVerseState = (): VerseState => ({
  ...initialState,
});

export const useVerseStore = create<VerseState & VerseActions>()(
  persist(
    (set) => ({
      ...createInitialVerseState(),

      hydrateFromUserTranslation: (translationEnabled) =>
        set((state) => {
          if (state.hasMigratedFromUserStore) return state;
          return { translationEnabled, hasMigratedFromUserStore: true };
        }),
      setTranslationEnabled: (translationEnabled) =>
        set((state) => ({
          translationEnabled,
          readingMode: translationEnabled
            ? TRANSLATION_READING_MODE
            : state.readingMode,
        })),
      toggleTranslationEnabled: () =>
        set((state) => {
          const translationEnabled = !state.translationEnabled;
          return {
            translationEnabled,
            readingMode: translationEnabled
              ? TRANSLATION_READING_MODE
              : state.readingMode,
          };
        }),
      setReadingMode: (readingMode) => set({ readingMode }),
      toggleReadingMode: () =>
        set((state) => ({
          readingMode: state.readingMode === "mushaf" ? "study" : "mushaf",
        })),
      setRecitationVisible: (recitationVisible) => set({ recitationVisible }),
      toggleRecitationVisible: () =>
        set((state) => ({ recitationVisible: !state.recitationVisible })),
      setSelectedVerseKey: (selectedVerseKey) => set({ selectedVerseKey }),
    }),
    {
      name: STORE_KEYS.VERSE_STORE,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export const resetVerseStore = () => {
  useVerseStore.setState(createInitialVerseState());
  void useVerseStore.persist.clearStorage();
};
