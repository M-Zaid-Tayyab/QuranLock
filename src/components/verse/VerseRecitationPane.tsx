import { useVerseRecitation } from "@/hooks/verse/useVerseRecitation";
import { useVerseStore } from "@/store/verse";
import { useEffect } from "react";
import { VerseRecitationControls } from "./VerseRecitationControls";

interface VerseRecitationPaneProps {
  visible: boolean;
  verseKeys: string[];
  onSelectVerse: (verseKey: string) => void;
  onRequestNextPageVerse: () => Promise<string | null>;
  onPlayingChange: (isPlaying: boolean) => void;
}

export function VerseRecitationPane({
  visible,
  verseKeys,
  onSelectVerse,
  onRequestNextPageVerse,
  onPlayingChange,
}: VerseRecitationPaneProps) {
  useEffect(() => {
    if (!visible) {
      onPlayingChange(false);
    }
  }, [onPlayingChange, visible]);

  if (!visible) return null;

  return (
    <VisibleRecitationPane
      verseKeys={verseKeys}
      onSelectVerse={onSelectVerse}
      onRequestNextPageVerse={onRequestNextPageVerse}
      onPlayingChange={onPlayingChange}
    />
  );
}

interface VisibleRecitationPaneProps {
  verseKeys: string[];
  onSelectVerse: (verseKey: string) => void;
  onRequestNextPageVerse: () => Promise<string | null>;
  onPlayingChange: (isPlaying: boolean) => void;
}

function VisibleRecitationPane({
  verseKeys,
  onSelectVerse,
  onRequestNextPageVerse,
  onPlayingChange,
}: VisibleRecitationPaneProps) {
  const selectedVerseKey = useVerseStore((s) => s.selectedVerseKey);
  const recitation = useVerseRecitation({
    verseKeys,
    selectedVerseKey,
    onSelectVerse,
    onRequestNextPageVerse,
  });

  useEffect(() => {
    onPlayingChange(recitation.isPlaying);
  }, [onPlayingChange, recitation.isPlaying]);

  useEffect(() => {
    return () => {
      onPlayingChange(false);
    };
  }, [onPlayingChange]);

  return (
    <VerseRecitationControls
      selectedVerseKey={selectedVerseKey}
      isLoadingAudio={recitation.isLoadingAudio}
      isPlaying={recitation.isPlaying}
      error={recitation.error}
      canGoNext={recitation.canGoNext}
      canGoPrevious={recitation.canGoPrevious}
      positionLabel={recitation.positionLabel}
      durationLabel={recitation.durationLabel}
      onTogglePlayback={recitation.actions.togglePlayback}
      onPlayNext={recitation.actions.playNext}
      onPlayPrevious={recitation.actions.playPrevious}
    />
  );
}
