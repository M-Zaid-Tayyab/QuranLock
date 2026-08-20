import { colors } from "@/constants/colors";
import type { FocusSchedule } from "@/store/user";

export interface OnboardingOption {
  label: string;
  value: string;
  icon: string;
  color: string;
  description?: string;
}

export interface IntroStepData {
  kicker: string;
  title: string;
  highlight: string;
  accent: string;
}

export const TOTAL_STEPS = 12;
export const CONTACT_STEP = 10;
export const REVIEW_STEP = 11;

export const ONBOARDING_CONTACT_MESSAGE =
  "Have an idea, criticism, or something you want changed in QuranLock? Tell me honestly. I read every message myself.";
export const ONBOARDING_CONTACT_HIGHLIGHTED_WORDS = [
  "idea",
  "criticism",
  "honestly",
];
export const ONBOARDING_CONTACT_TYPING_OPTIONS = {
  initialDelayMs: 180,
  charDelayMs: 22,
  durationMs: 160,
  endDelayMs: 140,
} as const;
export const ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS = 260;
export const ONBOARDING_CONTACT_BUTTON_STAGGER_MS = 70;
export const ONBOARDING_CONTACT_BUTTON_COUNT = 4;
export const ONBOARDING_CONTACT_CTA_GAP_MS = 120;

export const STEP_TITLES: Record<number, string> = {
  0: "",
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
  7: "Enable Screen Time",
  8: "Protect your focus",
  9: "Set your daily focus times",
  10: "",
  11: "Help the Ummah complete the Quran",
};

export const STEP_SUBTITLES: Record<number, string> = {
  0: "",
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
  7: "We use Screen Time to protect your focus window and pause distracting apps.",
  8: "Pick what pauses while you read.",
  9: "Pick prayer times and set a Quran completion goal.",
  10: "",
  11: "Read community stories and share your own review.",
};

export const STEP_ICONS: Partial<Record<number, string>> = {};

export const QURAN_FREQUENCY_OPTIONS: OnboardingOption[] = [
  {
    value: "daily",
    label: "Daily",
    description: "I read every day",
    icon: "book-outline",
    color: colors.primary,
  },
  {
    value: "few_times",
    label: "A few times a week",
    description: "Aim for consistency",
    icon: "calendar-outline",
    color: colors.secondary,
  },
  {
    value: "rarely",
    label: "Rarely",
    description: "Trying to build a habit",
    icon: "time-outline",
    color: colors.muted,
  },
  {
    value: "want_to_start",
    label: "I want to start",
    description: "Beginning my journey",
    icon: "flag-outline",
    color: colors.accent,
  },
];

export const REASONS_OPTIONS: OnboardingOption[] = [
  {
    value: "social_media",
    label: "Social media",
    description: "Scrolling takes my time",
    icon: "phone-portrait-outline",
    color: colors.primary,
  },
  {
    value: "work",
    label: "Work",
    description: "Too busy with deadlines",
    icon: "briefcase-outline",
    color: colors.orange,
  },
  {
    value: "distractions",
    label: "Distractions",
    description: "Hard to stay focused",
    icon: "flash-outline",
    color: colors.warning,
  },
  {
    value: "lack_of_time",
    label: "Lack of time",
    description: "Struggle to find time",
    icon: "time-outline",
    color: colors.muted,
  },
  {
    value: "other",
    label: "Other",
    description: "Something else",
    icon: "ellipsis-horizontal",
    color: colors.secondary,
  },
];

export const INTRO_STEPS: IntroStepData[] = [
  {
    kicker: "Purpose",
    title: "It's simple. Read Quran once a day to unlock your apps.",
    highlight: "Read Quran",
    accent: colors.accent,
  },
  {
    kicker: "How It Works",
    title: "Your focus time is protected until you reconnect with Allah.",
    highlight: "protected",
    accent: colors.primary,
  },
  {
    kicker: "Why It Matters",
    title: "Less scrolling. More remembrance and peace.",
    highlight: "remembrance",
    accent: colors.secondary,
  },
];

export const PRAYER_PRESETS = [
  { id: "fajr", label: "Fajr", hour: 5, minute: 0 },
  { id: "dhuhr", label: "Dhuhr", hour: 12, minute: 30 },
  { id: "asr", label: "Asr", hour: 15, minute: 30 },
  { id: "maghrib", label: "Maghrib", hour: 18, minute: 30 },
  { id: "isha", label: "Isha", hour: 20, minute: 0 },
] as const;

export type PrayerPreset = (typeof PRAYER_PRESETS)[number];

export const DURATION_OPTIONS = [15, 30, 45, 60] as const;

export const formatTime = (hour: number, minute: number) => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${suffix}`;
};

export const getNextDuration = (schedules: FocusSchedule[]) => {
  if (!schedules.length) return 30;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sorted = [...schedules].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
  );

  for (const schedule of sorted) {
    const scheduleMinutes = schedule.hour * 60 + schedule.minute;
    if (scheduleMinutes >= currentMinutes) return schedule.durationMinutes;
  }

  return sorted[0]?.durationMinutes ?? 30;
};
