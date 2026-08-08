import { FeedbackContactCard } from "@/components/feedback";
import {
  HomeHeader,
  JourneyHeroCard,
  JourneyProgressCard,
  JourneyTimelineCard,
  PermissionsCard,
  SetupCard,
} from "@/components/home";
import { colors } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import { useHomeScreen } from "@/hooks/home";
import { RefreshControl, ScrollView, View } from "react-native";

const HomeScreen = () => {
  const funnelText = useFunnelText();
  const vm = useHomeScreen();

  return (
    <View className="flex-1 bg-background py-safe">
      <ScrollView
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vm.flags.refreshing}
            onRefresh={vm.actions.refreshHome}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <HomeHeader
          greeting={vm.header.greeting}
          name={vm.header.displayName}
          onOpenSettings={vm.actions.openSettings}
        />

        <JourneyHeroCard
          title={vm.journey.title}
          subtitle={vm.journey.subtitle}
          progressPercent={vm.journey.progressPercent}
          pagesRead={vm.journey.pagesRead}
          pagesTotal={vm.journey.pagesTotal}
          requiredMinutes={vm.journey.requiredMinutes}
          onPressRead={vm.actions.openQuran}
        />

        <PermissionsCard
          needsScreenTime={vm.flags.needsScreenTime}
          needsNotifications={vm.flags.needsNotifications}
          requestingScreenTime={vm.flags.requestingScreenTime}
          onRequestScreenTime={vm.actions.requestScreenTime}
          onRequestNotifications={vm.actions.requestNotifications}
        />

        {vm.flags.showSetupApps && (
          <SetupCard
            icon="apps-outline"
            iconColor={colors.warning}
            iconBackground={colors.warning + "22"}
            title="Select apps to block"
            description={funnelText.home.setupAppsDescription}
            ctaLabel="Open settings"
            onPress={vm.actions.openSettingsForApps}
          />
        )}

        {vm.flags.showSetupTimes && (
          <SetupCard
            icon="time-outline"
            iconColor={colors.secondary}
            iconBackground={colors.secondary + "22"}
            title="Add focus times"
            description={funnelText.home.setupTimesDescription}
            ctaLabel="Set times"
            onPress={vm.actions.openFocusTimes}
          />
        )}

        <FeedbackContactCard source="home" />

        {vm.flags.showTimeline && (
          <JourneyTimelineCard
            items={vm.timeline.items}
            isBlockingPaused={vm.timeline.isBlockingPaused}
            nextFocusLabel={vm.timeline.nextFocusLabel}
            onManageTimes={vm.actions.openFocusTimes}
            onToggleBlockingPause={vm.actions.toggleBlockingPause}
            pauseButtonLabel={vm.timeline.pauseButtonLabel}
          />
        )}

        <JourneyProgressCard
          days={vm.streak.days}
          completedThisWeek={vm.streak.completedThisWeek}
          currentStreakCount={vm.streak.currentStreakCount}
          unlockSessions={vm.snapshot.unlockSessions}
          totalMinutesWithAllah={vm.snapshot.totalMinutesWithAllah}
          pagesRead={vm.journey.pagesRead}
          pagesTotal={vm.journey.pagesTotal}
        />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
