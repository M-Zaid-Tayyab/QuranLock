export type ReadingMode = "mushaf" | "study";
export type PackState = "checking" | "missing" | "downloading" | "ready" | "error";

export interface DisplayVerse {
  key: string;
  arabic: string;
  translation?: string;
}
