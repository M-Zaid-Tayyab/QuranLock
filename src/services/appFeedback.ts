import * as Application from "expo-application";
import * as StoreReview from "expo-store-review";
import { Linking, Platform, Share } from "react-native";

const APP_NAME = "QuranLock";
const FALLBACK_IOS_APP_STORE_URL =
  "https://apps.apple.com/kn/app/quran-lock-ramadan-focus/id6758984483";

const getAndroidStoreUrl = () => {
  const packageName = (Application.applicationId ?? "").trim();
  if (!packageName) return "";
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`;
};

const getStoreUrl = () => {
  const configuredUrl = StoreReview.storeUrl() ?? "";
  if (configuredUrl) return configuredUrl;
  return Platform.OS === "ios" ? FALLBACK_IOS_APP_STORE_URL : getAndroidStoreUrl();
};

const appendQueryParam = (url: string, key: string, value: string) => {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

export const canOpenStoreReviewPage = () => Boolean(getStoreUrl());

export const canShareApp = () => Boolean(getStoreUrl());

export const openStoreReviewPage = async () => {
  const storeUrl = getStoreUrl();
  if (!storeUrl) return false;

  const reviewUrl =
    Platform.OS === "ios"
      ? appendQueryParam(storeUrl, "action", "write-review")
      : appendQueryParam(storeUrl, "showAllReviews", "true");

  try {
    await Linking.openURL(reviewUrl);
    return true;
  } catch {
    return false;
  }
};

export const shareApp = async () => {
  const storeUrl = getStoreUrl();
  if (!storeUrl) return false;

  const message = `Build more Quran consistency with ${APP_NAME}. ${storeUrl}`;

  try {
    await Share.share(
      Platform.OS === "ios"
        ? {
            message,
            url: storeUrl,
          }
        : {
            message,
          },
      {
        dialogTitle: `Share ${APP_NAME}`,
      },
    );
    return true;
  } catch {
    return false;
  }
};
