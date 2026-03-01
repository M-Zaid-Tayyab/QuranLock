import { useUserStore } from "@/store/user";
import { Redirect, type Href } from "expo-router";
import { useShallow } from "zustand/react/shallow";

export default function Index() {
  const { onboardingComplete, isPremium } = useUserStore(
    useShallow((s) => ({
      onboardingComplete: s.onboardingComplete,
      isPremium: s.isPremium,
    })),
  );

  if (!onboardingComplete) {
    return <Redirect href={"/welcome" as Href} />;
  }

  if (!isPremium) {
    return (
      <Redirect
        href={{
          pathname: "/paywall",
          params: { entry: "app_launch" },
        }}
      />
    );
  }

  return <Redirect href={"/home" as Href} />;
}
