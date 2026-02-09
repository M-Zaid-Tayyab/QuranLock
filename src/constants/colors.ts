export const rgba = (hex: string, opacity: number) => {
  const hexValue = hex.replace("#", "");
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * QuranLock theme: serene, spiritual dark theme.
 * - Background: deep blue-black for calm focus
 * - Primary: emerald green (growth, peace, paradise)
 * - Accent: warm gold for blessing/light
 */
export const colors = {
  background: "#0c1218",
  backgroundElevated: "#111921",
  surface: "#1a2332",
  surfaceContainer: "#151d28",
  primary: "#0d9488",
  onPrimary: "#ffffff",
  primaryForeground: "#ffffff",
  primaryContainer: "#134e4a",
  primaryMuted: "#0f766e",
  primaryVariant: "#14b8a6",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  muted: "#94a3b8",
  placeholder: "#64748b",
  outline: "#334155",
  outlineVariant: "#475569",
  foreground: "#f1f5f9",
  border: "#334155",
  error: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
  white: "#ffffff",
  black: "#000000",
  accent: "#d4a853",
  accentMuted: "#b8923d",
  secondary: "#5eead4",
  yellow: "#fcd34d",
  purple: "#a78bfa",
  orange: "#fb923c",
  tertiary: {
    4: "#475569",
  },
} as const;
