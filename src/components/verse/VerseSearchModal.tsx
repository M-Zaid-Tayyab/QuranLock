import { Input } from "@/components/common";
import { colors } from "@/constants/colors";
import type { QuranSearchResult } from "@/services/quranFoundation";
import { Ionicons } from "@expo/vector-icons";
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

interface VerseSearchModalProps {
  visible: boolean;
  query: string;
  searching: boolean;
  error: string | null;
  results: QuranSearchResult[];
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onPickResult: (item: QuranSearchResult) => void;
}

export function VerseSearchModal({
  visible,
  query,
  searching,
  error,
  results,
  onClose,
  onQueryChange,
  onPickResult,
}: VerseSearchModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
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
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <Input
            value={query}
            onChangeText={onQueryChange}
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
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPickResult(item)}
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
                <Text className="mt-2 text-sm font-sfPro text-foreground">
                  {stripHtml(item.highlightedText)}
                </Text>
                {item.translation ? (
                  <Text className="mt-2 text-sm font-sfPro text-muted">
                    {stripHtml(item.translation)}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
