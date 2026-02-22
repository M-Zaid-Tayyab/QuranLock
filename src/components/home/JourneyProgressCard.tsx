import { colors } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import { getDateKey } from "@/utils/scheduleEngine";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";

export interface JourneyProgressDay {
  date: string;
  dayLabel: string;
  completed: boolean;
}

interface JourneyProgressCardProps {
  days?: JourneyProgressDay[];
  completedThisWeek: number;
  currentStreakCount: number;
  unlockSessions: number;
  totalMinutesWithAllah: number;
  pagesRead: number;
  pagesTotal: number;
}

function getDefaultDays(): JourneyProgressDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: getDateKey(d),
      dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      completed: false,
    };
  });
}

export function JourneyProgressCard({
  days,
  completedThisWeek,
  currentStreakCount,
  unlockSessions,
  totalMinutesWithAllah,
  pagesRead,
  pagesTotal,
}: JourneyProgressCardProps) {
  const funnelText = useFunnelText();
  const data = useMemo(() => days ?? getDefaultDays(), [days]);
  const todayKey = getDateKey(new Date());
  const clampedTotalPages = Math.max(1, pagesTotal);
  const clampedReadPages = Math.min(clampedTotalPages, Math.max(0, pagesRead));
  const pagesLeft = Math.max(0, clampedTotalPages - clampedReadPages);
  const pagesProgressPercent = Math.round((clampedReadPages / clampedTotalPages) * 100);

  const lifetimeHours = Math.floor(totalMinutesWithAllah / 60);
  const lifetimeMinutes = totalMinutesWithAllah % 60;
  const lifetimeLabel =
    lifetimeHours > 0
      ? `${lifetimeHours}h ${lifetimeMinutes.toString().padStart(2, "0")}m`
      : `${Math.max(0, totalMinutesWithAllah)}m`;

  return (
    <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
      <View className="items-center justify-center">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accent + "22" }}
        >
          <Ionicons name="flame-outline" size={24} color={colors.accent} />
        </View>
        <Text className="mt-2 text-lg font-sfPro-semibold text-foreground">
          {currentStreakCount} Day Streak
        </Text>
        <Text className="mt-1 text-xs font-sfPro text-muted">
          {completedThisWeek}/7 days this week
        </Text>
      </View>

      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => {
          const isToday = item.date === todayKey;
          return (
            <View className="mr-3 items-center">
              <View
                className={`h-11 w-11 items-center justify-center rounded-full border ${
                  isToday
                    ? "border-accent/40 bg-accent/10"
                    : item.completed
                      ? "border-primary bg-primary/20"
                      : "border-outline bg-backgroundElevated"
                }`}
              >
                {item.completed ? (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={isToday ? colors.accent : colors.primary}
                  />
                ) : (
                  <Text
                    className={`text-xs font-sfPro-semibold ${
                      isToday ? "text-accent" : "text-muted"
                    }`}
                  >
                    {item.dayLabel}
                  </Text>
                )}
              </View>
              <Text className="mt-1 text-xs font-sfPro text-muted">
                {item.date.slice(8)}
              </Text>
            </View>
          );
        }}
        className="mt-4"
      />

      <View className="mt-5 border-t border-outline pt-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
          <Text className="text-lg font-sfPro-semibold text-foreground">
            {funnelText.home.progressTitle}
          </Text>
        </View>

        <View className="mt-3 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="moon-outline" size={14} color={colors.secondary} />
                <Text className="text-[11px] font-sfPro-semibold tracking-widest text-muted">
                  TIME WITH ALLAH
                </Text>
              </View>
              <Text className="mt-1 text-2xl font-sfPro-bold text-foreground">
                {lifetimeLabel}
              </Text>
              <Text className="mt-1 text-xs font-sfPro text-muted">
                {funnelText.home.totalTimeDescription}
              </Text>
            </View>
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.secondary + "22" }}
            >
              <Ionicons name="book-outline" size={22} color={colors.secondary} />
            </View>
          </View>

          <View className="mt-4 rounded-xl border border-outline bg-surface/60 px-3 py-3">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="bookmarks-outline" size={13} color={colors.accent} />
              <Text className="text-xs font-sfPro text-foreground">
                "My Lord, increase me in knowledge."
              </Text>
            </View>
            <Text className="mt-1 text-[11px] font-sfPro text-muted">
              Qur'an 20:114
            </Text>
          </View>
        </View>

        <View className="mt-3 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="library-outline" size={14} color={colors.primary} />
              <Text className="text-[11px] font-sfPro-semibold tracking-widest text-muted">
                {funnelText.home.pageJourneyLabel}
              </Text>
            </View>
            <Text className="text-xs font-sfPro-semibold text-foreground">
              {pagesProgressPercent}%
            </Text>
          </View>
          <View className="mt-2 h-2 rounded-full bg-surface">
            <View
              className="h-2 rounded-full bg-primary"
              style={{
                width: `${Math.min(100, Math.max(0, pagesProgressPercent))}%`,
              }}
            />
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs font-sfPro text-muted">
              Read {clampedReadPages}/{clampedTotalPages} pages
            </Text>
            <Text className="text-xs font-sfPro text-muted">{pagesLeft} pages left</Text>
          </View>
        </View>

        <View className="mt-3 rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="lock-open-outline" size={13} color={colors.secondary} />
            <Text className="text-[10px] font-sfPro-semibold tracking-widest text-muted">
              UNLOCK SESSIONS
            </Text>
          </View>
          <Text className="mt-1 text-base font-sfPro-bold text-foreground">
            {unlockSessions}
          </Text>
        </View>
      </View>
    </View>
  );
}
