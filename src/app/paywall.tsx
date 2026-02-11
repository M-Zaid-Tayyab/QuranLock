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
import { Pressable, Text, View } from "react-native";
import { PACKAGE_TYPE, PurchasesPackage } from "react-native-purchases";

type PlanOption = "weekly" | "annual";
type PlanProduct = PurchasesPackage["product"] & {
  pricePerWeekString?: string;
  introPrice?: unknown;
};

export default function PaywallScreen() {
  const router = useRouter();
  const setIsPremium = useUserStore((s) => s.setIsPremium);

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
    const timer = setTimeout(() => setShowClose(true), 5000);
    return () => clearTimeout(timer);
  }, []);

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
    const trialAvailable = product?.introPrice != null;
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
        ) : trialAvailable ? (
          <View className="mt-3 self-start rounded-full bg-primary/20 px-3 py-1">
            <Text className="text-[10px] font-sfPro-semibold text-primary">
              Trial
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const showTrial =
    (selectedPackage?.product as { introPrice?: unknown } | undefined)
      ?.introPrice != null;
  const actionLabel = showTrial ? "Start free trial" : "Continue";

  return (
    <View className="flex-1 bg-background py-safe">
      <View className="flex-1 px-6">
        <View className="flex-1 justify-between pb-4 pt-4">
          <View className="gap-4">
            <View className="items-center">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <Ionicons
                  name="sparkles-outline"
                  size={22}
                  color={colors.accent}
                />
              </View>
              <Text className="mt-4 text-center text-3xl font-sfPro-bold text-foreground">
                Begin your journey
              </Text>
            </View>

            <View className="rounded-3xl border border-outline bg-surface px-5 py-5">
              <Text className="text-base font-sfPro-semibold text-foreground">
                Trial timeline
              </Text>
              <View className="mt-4 gap-2">
                <View className="flex-row items-start gap-4 py-1">
                  <View className="items-center">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-accent/20">
                      <Ionicons
                        name="lock-closed-outline"
                        size={16}
                        color={colors.accent}
                      />
                    </View>
                    <View className="mt-1 h-6 w-[2px] bg-accent/30" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-sfPro-semibold text-foreground">
                      Today
                    </Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <Ionicons
                        name="lock-open-outline"
                        size={14}
                        color={colors.muted}
                      />
                      <Text className="text-sm font-sfPro text-muted">
                        Full access
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-start gap-4 py-1">
                  <View className="items-center">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary/20">
                      <Ionicons
                        name="notifications-outline"
                        size={16}
                        color={colors.secondary}
                      />
                    </View>
                    <View className="mt-1 h-6 w-[2px] bg-secondary/30" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-sfPro-semibold text-foreground">
                      In 2 days
                    </Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <Ionicons
                        name="notifications-outline"
                        size={14}
                        color={colors.muted}
                      />
                      <Text className="text-sm font-sfPro text-muted">
                        Reminder sent
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-start gap-4 py-1">
                  <View className="items-center">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/20">
                      <Ionicons
                        name="trophy-outline"
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-sfPro-semibold text-foreground">
                      In 3 days
                    </Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={14}
                        color={colors.muted}
                      />
                      <Text className="text-sm font-sfPro text-muted">
                        Continue or cancel
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <Text className="text-center text-sm font-sfPro-semibold text-muted">
              No commitment · Cancel anytime
            </Text>

            <View className="flex-row gap-3">
              {renderPlan(
                "weekly",
                weeklyPackage,
                "Perfect for a short commitment.",
              )}
              {renderPlan(
                "annual",
                annualPackage,
                "Best value for long-term consistency.",
                "Best value",
              )}
            </View>
          </View>

          <View className="gap-3">
            {offeringError && (
              <Text className="text-center text-sm font-sfPro text-error">
                {offeringError}
              </Text>
            )}

            <PrimaryButton
              title={actionLabel}
              isLoading={loading || purchasing}
              disabled={!selectedPackage}
              onPress={handlePurchase}
              className="w-full"
            />

            <Pressable
              onPress={handleRestore}
              className="self-center rounded-full border border-outline bg-surface px-4 py-2"
            >
              <Text className="text-sm font-sfPro-semibold text-foreground">
                Restore
              </Text>
            </Pressable>

            <View className="flex-row items-center justify-center gap-2">
              <Pressable>
                <Text className="text-xs font-sfPro text-muted">
                  Privacy Policy
                </Text>
              </Pressable>
              <Text className="text-xs font-sfPro text-muted">•</Text>
              <Pressable>
                <Text className="text-xs font-sfPro text-muted">Terms</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

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
