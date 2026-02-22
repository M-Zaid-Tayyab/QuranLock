import { Input } from "@/components/common";
import { colors } from "@/constants/colors";
import {
  searchQuranVerses,
  type QuranSearchResult,
} from "@/services/quranFoundation";
import { getArabicLineHeight, getArabicTextStyle } from "@/utils/arabicTypography";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const SEARCH_ARABIC_FONT_SIZE = 22;
const SEARCH_ARABIC_LINE_HEIGHT = getArabicLineHeight(SEARCH_ARABIC_FONT_SIZE);

interface VerseSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onPickResult: (item: QuranSearchResult) => void;
}

export function VerseSearchModal({
  visible,
  onClose,
  onPickResult,
}: VerseSearchModalProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QuranSearchResult[]>([]);
  const searchRequestIdRef = useRef(0);

  const executeSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setError(null);
    try {
      const nextResults = await searchQuranVerses(trimmed, { page: 1, size: 15 });
      if (requestId !== searchRequestIdRef.current) return;
      setResults(nextResults);
    } catch (searchError) {
      if (requestId !== searchRequestIdRef.current) return;
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search right now. Please try again.",
      );
      setResults([]);
    } finally {
      if (requestId !== searchRequestIdRef.current) return;
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      searchRequestIdRef.current += 1;
      setSearching(false);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [executeSearch, query, visible]);

  const handleClose = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearching(false);
    setError(null);
    onClose();
  }, [onClose]);

  const handlePickResult = useCallback(
    (item: QuranSearchResult) => {
      searchRequestIdRef.current += 1;
      setSearching(false);
      setError(null);
      onClose();
      onPickResult(item);
    },
    [onClose, onPickResult],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-background/95"
      >
        <View className="flex-1 px-6 pb-6 pt-safe">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-xl font-sfPro-bold text-foreground">
              Search Quran
            </Text>
            <Pressable
              onPress={handleClose}
              className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search ayah, e.g. sabr, mercy, guidance"
            autoCapitalize="none"
            autoCorrect={false}
            containerClassName="mt-4"
            leftComponent={<Ionicons name="search" size={16} color={colors.muted} />}
          />

          {searching ? (
            <View className="mt-8 items-center">
              <ActivityIndicator color={colors.primary} />
              <Text className="mt-3 text-sm font-sfPro text-muted">Searching...</Text>
            </View>
          ) : null}

          {!searching && error ? (
            <Text className="mt-4 text-sm font-sfPro text-error">{error}</Text>
          ) : null}

          {!searching && !error && results.length === 0 ? (
            <Text className="mt-6 text-sm font-sfPro text-muted">
              Enter at least two characters to search verses.
            </Text>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={(item) => item.verseKey}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
            renderItem={({ item }) => {
              const normalizedArabic = item.arabicText
                ? stripHtml(item.arabicText)
                : "";
              const normalizedHighlighted = stripHtml(item.highlightedText);
              const showHighlighted = Boolean(
                normalizedHighlighted &&
                  normalizedHighlighted !== normalizedArabic,
              );

              return (
                <Pressable
                  onPress={() => handlePickResult(item)}
                  className="mb-3 rounded-2xl border border-outline bg-surface px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-sfPro-semibold text-accent">
                      {item.verseKey}
                    </Text>
                    {item.surahName ? (
                      <Text className="text-xs font-sfPro text-muted">
                        {item.surahName}
                      </Text>
                    ) : null}
                  </View>
                  {normalizedArabic ? (
                    <Text
                      allowFontScaling={false}
                      className="mt-2 text-foreground"
                      style={getArabicTextStyle(
                        SEARCH_ARABIC_FONT_SIZE,
                        SEARCH_ARABIC_LINE_HEIGHT,
                      )}
                    >
                      {normalizedArabic}
                    </Text>
                  ) : null}
                  {showHighlighted ? (
                    <Text className="mt-2 text-sm font-sfPro text-foreground">
                      {normalizedHighlighted}
                    </Text>
                  ) : null}
                  {item.translation ? (
                    <Text className="mt-2 text-sm font-sfPro text-muted">
                      {stripHtml(item.translation)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
