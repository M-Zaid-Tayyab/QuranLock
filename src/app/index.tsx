import { useUserStore } from "@/store/user";
import { Redirect, type Href } from "expo-router";

export default function Index() {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);

  if (!onboardingComplete) {
    return <Redirect href={"/welcome" as Href} />;
  }

  return <Redirect href={"/home" as Href} />;
}
