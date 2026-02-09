import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

export const getRevenueCatApiKey = () => {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  }
  return null;
};

export const configureRevenueCat = async (appUserId?: string) => {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return false;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  await Purchases.configure(
    appUserId ? { apiKey, appUserID: appUserId } : { apiKey },
  );
  return true;
};

export const getCurrentOffering = async (): Promise<PurchasesOffering | null> => {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
};

export const pickPackage = (
  offering: PurchasesOffering | null,
  type: PACKAGE_TYPE,
) => offering?.availablePackages.find((pkg) => pkg.packageType === type) ?? null;

export const purchaseSelectedPackage = async (pkg: PurchasesPackage) =>
  Purchases.purchasePackage(pkg);

export const restorePurchases = async () => Purchases.restorePurchases();

export const getEntitlementActive = (
  entitlements: Record<string, unknown> | undefined,
  entitlementId: string,
) => Boolean(entitlements && entitlements[entitlementId]);
