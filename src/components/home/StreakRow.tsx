import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";

export interface StreakDay {
  date: string;
  dayLabel: string;
  completed: boolean;
}

interface StreakRowProps {
  days?: StreakDay[];
}

function getDefaultDays(): StreakDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().slice(0, 10),
      dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      completed: false,
    };
  });
}

export function StreakRow({ days }: StreakRowProps) {
  const data = useMemo(() => days ?? getDefaultDays(), [days]);
  const completedCount = data.filter((d) => d.completed).length;
  const currentStreak = (() => {
    let count = 0;
    for (let i = data.length - 1; i >= 0; i -= 1) {
      if (!data[i].completed) break;
      count += 1;
    }
    return count;
  })();

  return (
    <View className="rounded-2xl border border-outline bg-surface px-5 py-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.accent + "22" }}
          >
            <Ionicons name="flame-outline" size={24} color={colors.accent} />
          </View>
          <View>
            <Text className="text-lg font-sfPro-semibold text-foreground">
              {currentStreak} Day Streak
            </Text>
            <Text className="mt-1 text-sm font-sfPro text-muted">
              {completedCount} day{completedCount === 1 ? "" : "s"} this week
            </Text>
          </View>
        </View>
        <Text className="text-xs font-sfPro text-muted">
          This week
        </Text>
      </View>

      <View className="mt-4 rounded-2xl border border-outline bg-backgroundElevated px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
            REMINDER
          </Text>
        </View>
        <Text className="mt-2 text-base font-sfPro text-foreground">
          “Surely, in the remembrance of Allah do hearts find rest.”
        </Text>
        <Text className="mt-1 text-xs font-sfPro text-muted">
          Qur’an 13:28
        </Text>
      </View>

      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View className="mr-3 items-center">
            <View
              className={`h-11 w-11 items-center justify-center rounded-full border ${
                item.completed
                  ? "border-primary bg-primary/20"
                  : "border-outline bg-backgroundElevated"
              }`}
            >
              <Text
                className={`text-xs font-sfPro-semibold ${
                  item.completed ? "text-foreground" : "text-muted"
                }`}
              >
                {item.dayLabel}
              </Text>
            </View>
            <Text className="mt-1 text-xs font-sfPro text-muted">
              {item.date.slice(8)}
            </Text>
          </View>
        )}
        className="mt-5"
      />
    </View>
  );
}
