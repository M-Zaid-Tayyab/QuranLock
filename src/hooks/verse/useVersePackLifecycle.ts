import {
  deleteQuranPack,
  ensureQuranPack,
  getPackInfo,
  getQuranPage,
  prefetchQuranPages,
  pruneQuranCache,
  resetPrefetchQueue,
  type QuranPageData,
} from "@/services/quranPack";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Animated, Easing } from "react-native";

type PackState = "checking" | "missing" | "downloading" | "ready" | "error";

interface UseVersePackLifecycleArgs {
  currentPage: number;
  setLastReadPage: (page: number) => void;
  translationEnabledRef: RefObject<boolean>;
  enableAutoDownload: boolean;
}

export const useVersePackLifecycle = ({
  currentPage,
  setLastReadPage,
  translationEnabledRef,
  enableAutoDownload,
}: UseVersePackLifecycleArgs) => {
  const [packState, setPackState] = useState<PackState>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [packError, setPackError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [autoDownloadAttempted, setAutoDownloadAttempted] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;
  const requestIdRef = useRef(0);

  const checkPack = useCallback(async () => {
    try {
      const info = await getPackInfo();
      setPackState(info.exists ? "ready" : "missing");
      if (!info.exists) {
        setPackError(null);
      }
    } catch (error) {
      setPackError(
        error instanceof Error ? error.message : "Unable to read Quran pack",
      );
      setPackState("error");
    }
  }, []);

  const downloadPack = useCallback(async () => {
    setPackError(null);
    setPackState("downloading");
    setDownloadProgress(0);
    try {
      await ensureQuranPack((progress) => setDownloadProgress(progress));
      setPackState("ready");
    } catch (error) {
      setPackError(error instanceof Error ? error.message : "Download failed");
      setPackState("error");
    }
  }, []);

  useEffect(() => {
    void checkPack();
  }, [checkPack]);

  useEffect(() => {
    if (enableAutoDownload && packState === "missing" && !autoDownloadAttempted) {
      setAutoDownloadAttempted(true);
      void downloadPack();
    }
  }, [autoDownloadAttempted, downloadPack, enableAutoDownload, packState]);

  const loadPage = useCallback(
    async (page: number) => {
      const requestId = ++requestIdRef.current;
      resetPrefetchQueue();
      setLoadingPage(true);
      setPageError(null);
      setPageData(null);
      transition.setValue(0);
      try {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Loading timed out")), 8000);
        });
        const data = await Promise.race([
          getQuranPage(page, {
            priority: "high",
            shouldAbort: () => requestId !== requestIdRef.current,
          }),
          timeout,
        ]);
        if (requestId !== requestIdRef.current) return;
        setPageData(data);
        setLastReadPage(page);
        pruneQuranCache(page, 2);
        const prefetchRadius = translationEnabledRef.current ? 1 : 2;
        const pagesToPrefetch =
          prefetchRadius === 1
            ? [page - 1, page + 1]
            : [page - 2, page - 1, page + 1, page + 2];
        prefetchQuranPages(pagesToPrefetch);
        if (!data) {
          setPageError("Pack missing or corrupted. Please redownload.");
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setPageError(
          error instanceof Error ? error.message : "Unable to load page",
        );
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoadingPage(false);
      }
    },
    [setLastReadPage, transition, translationEnabledRef],
  );

  useEffect(() => {
    if (packState === "ready") {
      void loadPage(currentPage);
    }
  }, [currentPage, loadPage, packState]);

  useEffect(() => {
    if (!pageData || loadingPage) return;
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [loadingPage, pageData, transition]);

  const redownloadPack = useCallback(async () => {
    setPackError(null);
    setPageError(null);
    setPackState("downloading");
    setDownloadProgress(0);
    await deleteQuranPack();
    try {
      await ensureQuranPack((progress) => setDownloadProgress(progress));
      setPackState("ready");
    } catch (error) {
      setPackError(error instanceof Error ? error.message : "Download failed");
      setPackState("error");
    }
  }, []);

  const setPageErrorMessage = useCallback((message: string | null) => {
    setPageError(message);
  }, []);

  return {
    packState,
    downloadProgress,
    packError,
    pageData,
    loadingPage,
    pageError,
    transition,
    actions: {
      downloadPack,
      redownloadPack,
      setPageErrorMessage,
    },
  };
};
