import { PrimaryButton } from "@/components/common/PrimaryButton";
import { FeedbackContactCard } from "@/components/feedback";
import { colors } from "@/constants/colors";
import {
  PAYWALL_COMPACT_VIEWPORT_HEIGHT,
  PAYWALL_SPACING,
} from "@/constants/paywall";
import { useFunnelText } from "@/hooks/app";
import {
  getCurrentOffering,
  pickPackage,
  purchaseSelectedPackage,
  restorePurchases,
} from "@/services/revenueCat";
import { useUserStore } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PACKAGE_TYPE,
  type PurchasesPackage,
} from "react-native-purchases";

type PlanOption = "weekly" | "annual";
type PlanProduct = PurchasesPackage["product"] & {
  pricePerWeekString?: string;
};

const periodToDays = (unit: string, value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (unit.toUpperCase()) {
    case "DAY":
      return Math.round(value);
    case "WEEK":
      return Math.round(value * 7);
    case "MONTH":
      return Math.round(value * 30);
    case "YEAR":
      return Math.round(value * 365);
    default:
      return 0;
  }
};

const getFreeTrialDays = (pkg: PurchasesPackage | null) => {
  if (!pkg) return 0;

  const introPrice = pkg.product.introPrice;
  if (!introPrice || introPrice.price !== 0) return 0;

  const cycles = introPrice.cycles > 0 ? introPrice.cycles : 1;
  return periodToDays(
    introPrice.periodUnit,
    introPrice.periodNumberOfUnits * cycles,
  );
};

const getOfferDebugSnapshot = (pkg: PurchasesPackage | null) => {
  if (!pkg) return null;
  const intro = pkg.product.introPrice;

  return {
    packageIdentifier: pkg.identifier,
    packageType: pkg.packageType,
    productIdentifier: pkg.product.identifier,
    price: pkg.product.priceString,
    subscriptionPeriod: pkg.product.subscriptionPeriod,
    introPrice: intro
      ? {
          price: intro.price,
          priceString: intro.priceString,
          periodUnit: intro.periodUnit,
          periodNumberOfUnits: intro.periodNumberOfUnits,
          cycles: intro.cycles,
        }
      : null,
    computedFreeTrialDays: getFreeTrialDays(pkg),
  };
};

export default function PaywallScreen() {
  const router = useRouter();
  const funnelText = useFunnelText();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ entry?: string | string[] }>();
  const setIsPremium = useUserStore((s) => s.setIsPremium);
  const paywallEntry =
    typeof params.entry === "string" ? params.entry : params.entry?.[0];

  const exitPaywall = useCallback(() => {
    if (paywallEntry === "onboarding") {
      router.replace("/home");
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, [paywallEntry, router]);

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
  const [introEligibilityByProduct, setIntroEligibilityByProduct] = useState<
    Record<string, INTRO_ELIGIBILITY_STATUS>
  >({});

  const selectedPackage = useMemo(
    () => (selectedPlan === "annual" ? annualPackage : weeklyPackage),
    [annualPackage, weeklyPackage, selectedPlan],
  );
  const selectedTrialDays = useMemo(
    () => getFreeTrialDays(selectedPackage),
    [selectedPackage],
  );

  const hasEligibleFreeTrial = useMemo(() => {
    if (!selectedPackage || selectedTrialDays < 1) return false;
    const status =
      introEligibilityByProduct[selectedPackage.product.identifier];
    return (
      status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
    );
  }, [introEligibilityByProduct, selectedPackage, selectedTrialDays]);

  const purchaseCtaTitle = useMemo(() => {
    if (!hasEligibleFreeTrial) return funnelText.paywall.ctaTitle;
    return `Start ${selectedTrialDays} day${selectedTrialDays === 1 ? "" : "s"} free trial`;
  }, [funnelText.paywall.ctaTitle, hasEligibleFreeTrial, selectedTrialDays]);

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
        console.log("[Paywall] Loaded current offering", {
          offeringIdentifier: offering.identifier,
          availablePackageCount: offering.availablePackages.length,
          availablePackages: offering.availablePackages.map((pkg) => ({
            packageIdentifier: pkg.identifier,
            packageType: pkg.packageType,
            productIdentifier: pkg.product.identifier,
            price: pkg.product.priceString,
          })),
          weekly: getOfferDebugSnapshot(weekly),
          annual: getOfferDebugSnapshot(annual),
        });
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
    if (selectedPlan === "annual" && !annualPackage && weeklyPackage) {
      setSelectedPlan("weekly");
      return;
    }
    if (selectedPlan === "weekly" && !weeklyPackage && annualPackage) {
      setSelectedPlan("annual");
    }
  }, [annualPackage, selectedPlan, weeklyPackage]);

  useEffect(() => {
    const productIds = [
      weeklyPackage?.product.identifier,
      annualPackage?.product.identifier,
    ].filter((id): id is string => Boolean(id));

    if (productIds.length === 0) {
      setIntroEligibilityByProduct({});
      return;
    }

    let isCancelled = false;

    Purchases.checkTrialOrIntroductoryPriceEligibility([...new Set(productIds)])
      .then((result) => {
        if (isCancelled) return;

        const next: Record<string, INTRO_ELIGIBILITY_STATUS> = {};
        for (const [productId, eligibility] of Object.entries(result)) {
          if (typeof eligibility?.status === "number") {
            next[productId] = eligibility.status;
          }
        }
        console.log("[Paywall] Intro eligibility by product", next);
        setIntroEligibilityByProduct(next);
      })
      .catch(() => {
        if (!isCancelled) {
          setIntroEligibilityByProduct({});
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [annualPackage?.product.identifier, weeklyPackage?.product.identifier]);

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
        exitPaywall();
      }
    } catch {
      // user cancelled or failed
    } finally {
      setPurchasing(false);
    }
  }, [exitPaywall, selectedPackage, setIsPremium]);

  const handleRestore = useCallback(async () => {
    try {
      const info = await restorePurchases();
      const entitlementId =
        process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";
      const isActive = Boolean(info.entitlements.active[entitlementId]);
      setIsPremium(isActive);
      if (isActive) {
        exitPaywall();
      }
    } catch {
      // ignore
    }
  }, [exitPaywall, setIsPremium]);

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
        className={`flex-1 rounded-2xl border px-4 py-3.5 ${
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
        <Text className="mt-2 text-sm font-sfPro text-muted">
          {description}
        </Text>
        {badge ? (
          <View className="mt-2.5 self-start rounded-full bg-accent/20 px-3 py-1">
            <Text className="text-[10px] font-sfPro-semibold text-accent">
              {badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const spacing =
    windowHeight < PAYWALL_COMPACT_VIEWPORT_HEIGHT
      ? PAYWALL_SPACING.compact
      : PAYWALL_SPACING.regular;

  return (
    <>
      <Stack.Screen options={{ animation: "fade", gestureEnabled: false }} />
      <View className="flex-1 bg-background pt-safe pb-safe">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center">
            <View
              className={`flex-row flex-wrap justify-center px-4 ${spacing.hero}`}
            >
              {funnelText.paywall.headlineWords.map((word, index) => (
                <Text
                  key={`${word}-${index}`}
                  className="text-center text-4xl font-sfPro-bold leading-tight"
                  style={{
                    color: funnelText.paywall.headlineHighlightedWords.includes(
                      word.replace(/[^a-z]/gi, "").toLowerCase(),
                    )
                      ? colors.accent
                      : colors.foreground,
                  }}
                >
                  {word}
                  {index < funnelText.paywall.headlineWords.length - 1
                    ? " "
                    : ""}
                </Text>
              ))}
            </View>
          </View>

          <View className={spacing.features}>
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="shield-checkmark-outline"
                size={23}
                color={colors.primary}
              />
              <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
                {funnelText.paywall.featureLines[0]}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Ionicons name="book-outline" size={23} color={colors.accent} />
              <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
                {funnelText.paywall.featureLines[1]}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="notifications-outline"
                size={23}
                color={colors.secondary}
              />
              <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
                {funnelText.paywall.featureLines[2]}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Ionicons name="time-outline" size={23} color={colors.primary} />
              <Text className="flex-1 text-lg font-sfPro-semibold leading-7 text-foreground">
                {funnelText.paywall.featureLines[3]}
              </Text>
            </View>
          </View>

          <View className={spacing.planSection}>
            <View className="flex-row items-center justify-between">
              <Text className="mt-1 text-2xl font-sfPro-bold text-foreground">
                Choose your plan
              </Text>
              <Text className="mt-1 text-sm font-sfPro-semibold text-muted">
                Cancel anytime
              </Text>
            </View>

            <View className={spacing.planCards}>
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

          <View className={spacing.checkout}>
            {offeringError && (
              <Text className="text-center text-sm font-sfPro text-error">
                {offeringError}
              </Text>
            )}

            <PrimaryButton
              title={purchaseCtaTitle}
              isLoading={loading || purchasing}
              disabled={!selectedPackage}
              onPress={handlePurchase}
              className={spacing.cta}
            />

            <View className={spacing.footer}>
              <FeedbackContactCard source="paywall" />

              <Pressable onPress={handleRestore} className={spacing.restore}>
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
                <Pressable
                  onPress={() => openLink(termsUrl, "Terms")}
                  hitSlop={8}
                >
                  <Text className="text-xs font-sfPro-semibold text-foreground">
                    Terms
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
