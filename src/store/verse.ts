import { STORE_KEYS } from "@/constants/storeKeys";
import { zustandStorage } from "@/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReadingMode = "mushaf" | "study";

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
  recitationVisible: false,
  selectedVerseKey: null,
  hasMigratedFromUserStore: false,
};

export const useVerseStore = create<VerseState & VerseActions>()(
  persist(
    (set) => ({
      ...initialState,

      hydrateFromUserTranslation: (translationEnabled) =>
        set((state) => {
          if (state.hasMigratedFromUserStore) return state;
          return { translationEnabled, hasMigratedFromUserStore: true };
        }),
      setTranslationEnabled: (translationEnabled) =>
        set({ translationEnabled }),
      toggleTranslationEnabled: () =>
        set((state) => ({ translationEnabled: !state.translationEnabled })),
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
