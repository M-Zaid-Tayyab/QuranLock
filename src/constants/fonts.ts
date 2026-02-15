import { platformSelect } from "nativewind/theme";

const quranArabic = {
  ios: "Al Majeed Quranic Font",
  android: "Al-Majeed-Quranic-Font-shiped",
};

const fonts = {
  sfPro: platformSelect({
    ios: "SFProText-Regular",
    android: "SF-Pro-Text-Regular",
  }),
  "sfPro-medium": platformSelect({
    ios: "SFProText-Medium",
    android: "SF-Pro-Text-Medium",
  }),
  "sfPro-bold": platformSelect({
    ios: "SFProText-Bold",
    android: "SF-Pro-Text-Bold",
  }),
  "sfPro-semibold": platformSelect({
    ios: "SFProText-Semibold",
    android: "SF-Pro-Text-Semibold",
  }),
  quranArabic: platformSelect(quranArabic),
};

module.exports = fonts;

export default fonts;
