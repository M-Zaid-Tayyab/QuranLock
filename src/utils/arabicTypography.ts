import { Platform, type TextStyle } from "react-native";

const IOS_ARABIC_LINE_HEIGHT = 1.72;
const ANDROID_ARABIC_LINE_HEIGHT = 1.68;

export const getArabicLineHeight = (fontSize: number) =>
  Math.round(
    fontSize *
      (Platform.OS === "ios" ? IOS_ARABIC_LINE_HEIGHT : ANDROID_ARABIC_LINE_HEIGHT),
  );

export const getArabicTextStyle = (
  fontSize: number,
  lineHeight: number,
): TextStyle => ({
  fontSize,
  lineHeight,
  paddingVertical: Platform.OS === "ios" ? 2 : 1,
  writingDirection: "rtl",
  textAlign: "right",
  letterSpacing: 0,
  ...(Platform.OS === "android" ? { includeFontPadding: true } : {}),
});
