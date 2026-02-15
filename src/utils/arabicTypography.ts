import fonts from "@/constants/fonts";
import { Platform, type TextStyle } from "react-native";

const IOS_ARABIC_LINE_HEIGHT = 1.72;
const ANDROID_ARABIC_LINE_HEIGHT = 1.68;
const DEFAULT_QURAN_FONT_FAMILY = String(fonts.quranArabic ?? "");
const IOS_QURAN_FONT_FAMILY =
  process.env.EXPO_PUBLIC_QURAN_ARABIC_FONT_IOS ?? DEFAULT_QURAN_FONT_FAMILY;
const ANDROID_QURAN_FONT_FAMILY =
  process.env.EXPO_PUBLIC_QURAN_ARABIC_FONT_ANDROID ??
  DEFAULT_QURAN_FONT_FAMILY;

export const getArabicLineHeight = (fontSize: number) =>
  Math.round(
    fontSize *
      (Platform.OS === "ios"
        ? IOS_ARABIC_LINE_HEIGHT
        : ANDROID_ARABIC_LINE_HEIGHT),
  );

export const getQuranArabicFontFamily = () =>
  Platform.select({
    ios: IOS_QURAN_FONT_FAMILY,
    android: ANDROID_QURAN_FONT_FAMILY,
    default: undefined,
  });

export const getArabicTextStyle = (
  fontSize: number,
  lineHeight: number,
): TextStyle => ({
  fontFamily: getQuranArabicFontFamily(),
  fontSize,
  lineHeight,
  paddingVertical: Platform.OS === "ios" ? 2 : 1,
  writingDirection: "rtl",
  textAlign: "right",
  letterSpacing: 0,
  ...(Platform.OS === "android" ? { includeFontPadding: true } : {}),
});
