import { colors, rgba } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { heightPercentageToDP } from "react-native-responsive-screen";

interface Review {
  id: string;
  name: string;
  age: string;
  quote: string;
  context: string;
}

const REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Amina",
    age: "17",
    quote:
      "I finally replaced late-night scrolling with reading Quran before sleep.",
    context: "Student",
  },
  {
    id: "r2",
    name: "Maryam",
    age: "21",
    quote:
      "Focus times helped me stay consistent with Quran after each prayer.",
    context: "University",
  },
  {
    id: "r3",
    name: "Hafsa",
    age: "19",
    quote:
      "When apps pause, I remember my intention and open QuranLock instead.",
    context: "College",
  },
  {
    id: "r4",
    name: "Yusuf",
    age: "18",
    quote: "The app keeps me honest. Less reels, more Quran every day.",
    context: "Student",
  },
  {
    id: "r5",
    name: "Ibrahim",
    age: "24",
    quote: "I set my prayer windows and now my screen time has dropped a lot.",
    context: "Working professional",
  },
  {
    id: "r6",
    name: "Omar",
    age: "20",
    quote:
      "This gave me structure. Quran first, then everything else feels easier.",
    context: "Student",
  },
];

function ReviewCard({ review }: { review: Review }) {
  return (
    <View
      className="mb-3 rounded-3xl border px-4 py-4"
      style={{
        borderColor: colors.outline,
        backgroundColor: rgba(colors.surface, 0.95),
      }}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <View>
          <Text className="font-sfPro-semibold text-base text-foreground">
            {review.name}, {review.age}
          </Text>
          <Text className="font-sfPro text-xs text-muted">
            {review.context}
          </Text>
        </View>
        <View className="flex-row items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons
              key={`${review.id}-star-${index}`}
              name="star"
              size={13}
              color={colors.accent}
            />
          ))}
        </View>
      </View>
      <View className="flex-row gap-2">
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={16}
          color={colors.primaryVariant}
        />
        <Text className="flex-1 font-sfPro text-base leading-6 text-muted">
          {review.quote}
        </Text>
      </View>
    </View>
  );
}

function ReviewsTicker({ reviews }: { reviews: Review[] }) {
  const translateY = useSharedValue(0);
  const [singleListHeight, setSingleListHeight] = useState(0);

  useEffect(() => {
    if (singleListHeight <= 0) return;

    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(-singleListHeight, {
        duration: 18000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateY);
    };
  }, [singleListHeight, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      className="overflow-hidden rounded-3xl border px-3 pt-3"
      style={{
        borderColor: rgba(colors.primaryVariant, 0.28),
        backgroundColor: rgba(colors.backgroundElevated, 0.88),
        height: heightPercentageToDP(63),
      }}
    >
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0 z-10 h-10"
        style={{ backgroundColor: rgba(colors.backgroundElevated, 0.85) }}
      />
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0 z-10 h-12"
        style={{ backgroundColor: rgba(colors.backgroundElevated, 0.9) }}
      />

      <Animated.View style={animatedStyle}>
        <View
          onLayout={(event) =>
            setSingleListHeight(event.nativeEvent.layout.height)
          }
        >
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </View>

        <View>
          {reviews.map((review) => (
            <ReviewCard key={`${review.id}-clone`} review={review} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export function ReviewsStep() {
  return (
    <View className="flex-1">
      <ReviewsTicker reviews={REVIEWS} />
    </View>
  );
}
