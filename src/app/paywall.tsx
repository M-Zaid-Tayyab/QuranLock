import { PrimaryButton } from "@/components/common/PrimaryButton";
import { colors } from "@/constants/colors";
import {
  getCurrentOffering,
  pickPackage,
  purchaseSelectedPackage,
  restorePurchases,
} from "@/services/revenueCat";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { PACKAGE_TYPE, PurchasesPackage } from "react-native-purchases";

type PlanOption = "weekly" | "annual";
type PlanProduct = PurchasesPackage["product"] & {
  pricePerWeekString?: string;
};

export default function PaywallScreen() {
  const router = useRouter();
  const setIsPremium = useUserStore((s) => s.setIsPremium);
  const normalizeExternalUrl = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };
  const privacyUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_PRIVACY_URL);
  const termsUrl = normalizeExternalUrl(process.env.EXPO_PUBLIC_TERMS_URL);

  const [loading, setLoading] = useState(true);
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [weeklyPackage, setWeeklyPackage] = useState<PurchasesPackage | null>(
    null,
  );
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>("annual");
  const [purchasing, setPurchasing] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const selectedPackage = useMemo(
    () => (selectedPlan === "annual" ? annualPackage : weeklyPackage),
    [annualPackage, weeklyPackage, selectedPlan],
  );

  useEffect(() => {
    setLoading(true);
    getCurrentOffering()
      .then((offering) => {
        if (!offering) {
          setOfferingError("No offerings available yet.");
          return;
        }
        const weekly = pickPackage(offering, PACKAGE_TYPE.WEEKLY);
        const annual = pickPackage(offering, PACKAGE_TYPE.ANNUAL);
        setWeeklyPackage(weekly);
        setAnnualPackage(annual);
        setOfferingError(null);
      })
      .catch((error) => {
        console.error(error);
        setOfferingError("Unable to load subscriptions.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowClose(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (selectedPlan === "annual" && !annualPackage && weeklyPackage) {
      setSelectedPlan("weekly");
      return;
    }
    if (selectedPlan === "weekly" && !weeklyPackage && annualPackage) {
      setSelectedPlan("annual");
    }
  }, [annualPackage, selectedPlan, weeklyPackage]);

  const handlePurchase = useCallback(async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    try {
      const info = await purchaseSelectedPackage(selectedPackage);
      const entitlementId =
        process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";
      const customerInfo = "customerInfo" in info ? info.customerInfo : info;
      const isActive = Boolean(customerInfo.entitlements.active[entitlementId]);
      setIsPremium(isActive);
      if (isActive) {
        router.back();
      }
    } catch {
      // user cancelled or failed
    } finally {
      setPurchasing(false);
    }
  }, [router, selectedPackage, setIsPremium]);

  const handleRestore = useCallback(async () => {
    try {
      const info = await restorePurchases();
      const entitlementId =
        process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";
      const isActive = Boolean(info.entitlements.active[entitlementId]);
      setIsPremium(isActive);
      if (isActive) {
        router.back();
      }
    } catch {
      // ignore
    }
  }, [router, setIsPremium]);

  const openLink = useCallback((url: string, label: string) => {
    if (!url) {
      Alert.alert(`${label} unavailable`, "This link is not configured yet.");
      return;
    }
    Linking.openURL(url).catch(() => undefined);
  }, []);

  const renderPlan = (
    id: PlanOption,
    pkg: PurchasesPackage | null,
    description: string,
    badge?: string,
  ) => {
    const isSelected = selectedPlan === id;
    const product = pkg?.product as PlanProduct | undefined;
    const price = product?.priceString ?? "--";
    const perWeek = product?.pricePerWeekString ?? "";

    return (
      <Pressable
        onPress={() => setSelectedPlan(id)}
        className={`flex-1 rounded-2xl border px-4 py-4 ${
          isSelected
            ? "border-accent bg-accent/10"
            : "border-outline bg-surface"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-sfPro-semibold text-foreground">
            {id === "annual" ? "Yearly" : "Weekly"}
          </Text>
          <View
            className={`h-5 w-5 items-center justify-center rounded-full border ${
              isSelected ? "border-accent" : "border-outline"
            }`}
          >
            {isSelected && <View className="h-3 w-3 rounded-full bg-accent" />}
          </View>
        </View>
        <Text className="mt-2 text-3xl font-sfPro-bold text-foreground">
          {price}
        </Text>
        {perWeek ? (
          <Text className="mt-1 text-sm font-sfPro text-muted">
            {perWeek} per week
          </Text>
        ) : null}
        <Text className="mt-3 text-sm font-sfPro text-muted">
          {description}
        </Text>
        {badge ? (
          <View className="mt-3 self-start rounded-full bg-accent/20 px-3 py-1">
            <Text className="text-[10px] font-sfPro-semibold text-accent">
              {badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-12 items-center">
          <View className="mt-3 flex-row flex-wrap justify-center">
            {["It's", "time", "to", "invest", "in", "your", "Akhirah."].map(
              (word, index) => (
                <Text
                  key={`${word}-${index}`}
                  className="text-center text-4xl font-sfPro-bold leading-tight"
                  style={{
                    color:
                      word === "invest" || word === "Akhirah."
                        ? colors.accent
                        : colors.foreground,
                  }}
                >
                  {word}
                  {index < 6 ? " " : ""}
                </Text>
              ),
            )}
          </View>
        </View>

        <View className="mt-14 gap-4">
          <View className="flex-row items-center gap-3">
            <Ionicons
              name="shield-checkmark-outline"
              size={23}
              color={colors.primary}
            />
            <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
              Block distractions in every focus window
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons name="book-outline" size={23} color={colors.accent} />
            <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
              Replace scrolling urges with Quran
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons
              name="notifications-outline"
              size={23}
              color={colors.secondary}
            />
            <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
              Stay consistent with timely reminders
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons name="time-outline" size={23} color={colors.primary} />
            <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
              Protect your time before regret starts
            </Text>
          </View>
        </View>

        <View className="mt-14">
          <View className="flex-row items-center justify-between">
            <Text className="mt-1 text-2xl font-sfPro-bold text-foreground">
              Choose your plan
            </Text>
            <Text className="mt-1 text-sm font-sfPro-semibold text-muted">
              Cancel anytime
            </Text>
          </View>

          <View className="mt-7 gap-3">
            {!loading && !weeklyPackage && !annualPackage ? (
              <Text className="text-sm font-sfPro text-muted">
                Subscription plans are not available right now.
              </Text>
            ) : (
              <View className="flex-row gap-3">
                {(loading || weeklyPackage) &&
                  renderPlan(
                    "weekly",
                    weeklyPackage,
                    "Flexible commitment billed weekly.",
                  )}
                {(loading || annualPackage) &&
                  renderPlan(
                    "annual",
                    annualPackage,
                    "Lower weekly cost for long-term consistency.",
                    "Best value",
                  )}
              </View>
            )}
          </View>
        </View>

        <View className="mt-5 gap-3">
          {offeringError && (
            <Text className="text-center text-sm font-sfPro text-error">
              {offeringError}
            </Text>
          )}

          <PrimaryButton
            title="Connect with Allah"
            isLoading={loading || purchasing}
            disabled={!selectedPackage}
            onPress={handlePurchase}
            className="w-full mt-4"
          />

          <Pressable
            onPress={handleRestore}
            className="self-center rounded-full border border-outline bg-surface px-4 py-2 my-2"
          >
            <Text className="text-sm font-sfPro-semibold text-foreground">
              Restore purchases
            </Text>
          </Pressable>

          <View className="flex-row items-center justify-center gap-2">
            <Pressable
              onPress={() => openLink(privacyUrl, "Privacy Policy")}
              hitSlop={8}
            >
              <Text className="text-xs font-sfPro-semibold text-foreground">
                Privacy Policy
              </Text>
            </Pressable>
            <Text className="text-xs font-sfPro text-muted">•</Text>
            <Pressable onPress={() => openLink(termsUrl, "Terms")} hitSlop={8}>
              <Text className="text-xs font-sfPro-semibold text-foreground">
                Terms
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {showClose && (
        <Pressable
          onPress={() => router.replace("/home")}
          className="absolute right-6 top-safe h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
        >
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
