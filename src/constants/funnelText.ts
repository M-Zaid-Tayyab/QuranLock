export const FUNNEL_VARIANTS = {
  REGULAR: "REGULAR",
  RAMADAN: "RAMADAN",
} as const;

export type FunnelVariant =
  (typeof FUNNEL_VARIANTS)[keyof typeof FUNNEL_VARIANTS];

export const DEFAULT_FUNNEL_VARIANT = FUNNEL_VARIANTS.REGULAR;

interface FunnelText {
  welcome: {
    heroText: string;
    highlightedWords: string[];
  };
  onboarding: {
    introTitles: string[];
    stepSubtitles: Partial<Record<number, string>>;
    quranFrequencyQuestion: string;
    quranFrequencySubtitle: string;
    reasonsQuestion: string;
    screenTimeShieldBody: string;
    screenTimeFirstBullet: string;
    selectAppsDescription: string;
    focusEmptyState: string;
    focusNotificationDescription: string;
  };
  paywall: {
    headlineWords: string[];
    headlineHighlightedWords: string[];
    featureLines: [string, string, string, string];
    ctaTitle: string;
  };
  home: {
    setupAppsDescription: string;
    setupTimesDescription: string;
    journeyTitleActive: string;
    journeyTitleIdle: string;
    timelineTitle: string;
    progressTitle: string;
    totalTimeDescription: string;
    pageJourneyLabel: string;
  };
}

export const FUNNEL_TEXT_BY_VARIANT: Record<FunnelVariant, FunnelText> = {
  REGULAR: {
    welcome: {
      heroText:
        "Reconnect with Allah, step away from endless scrolling, and sit with his talk to you again.",
      highlightedWords: ["allah", "talk"],
    },
    onboarding: {
      introTitles: [
        "It's simple. Read Quran once a day to unlock your apps.",
        "Your focus time is protected until you reconnect with Allah.",
        "Less scrolling. More remembrance and peace.",
      ],
      stepSubtitles: {
        7: "We use Screen Time to protect your focus window and pause distracting apps.",
        8: "Choose the apps that tend to pull your attention away.",
        9: "Pick prayer times and set a Quran completion goal.",
      },
      quranFrequencyQuestion: "How often do you read the Quran?",
      quranFrequencySubtitle: "This helps us tailor your experience",
      reasonsQuestion: "What keeps you from staying connected with Allah?",
      screenTimeShieldBody:
        "Screen Time powers a gentle shield. When it appears, open QuranLock and read to unlock your apps.",
      screenTimeFirstBullet: "Shield appears only in your scheduled focus times",
      selectAppsDescription:
        "We’ll only block the apps you select during focus time.",
      focusEmptyState: "Select a prayer time or add a custom time to continue.",
      focusNotificationDescription:
        "We will remind you to open QuranLock when the shield appears.",
    },
    paywall: {
      headlineWords: ["It's", "time", "to", "invest", "in", "your", "Akhirah."],
      headlineHighlightedWords: ["invest", "akhirah"],
      featureLines: [
        "Block distractions in every focus window",
        "Replace scrolling urges with Quran",
        "Stay consistent with timely reminders",
        "Protect your time before regret starts",
      ],
      ctaTitle: "Connect with Allah",
    },
    home: {
      setupAppsDescription:
        "Choose the apps you want paused during focus time.",
      setupTimesDescription:
        "Set prayer or custom times so your journey stays consistent.",
      journeyTitleActive: "Unlock in progress",
      journeyTitleIdle: "Today's journey",
      timelineTitle: "Today's timeline",
      progressTitle: "Overall progress",
      totalTimeDescription: "Total time spent in focused Qur'an journey",
      pageJourneyLabel: "PAGE JOURNEY",
    },
  },
  RAMADAN: {
    welcome: {
      heroText:
        "Reconnect this Ramadan, step away from endless scrolling, and sit with His words to you again.",
      highlightedWords: ["ramadan", "words"],
    },
    onboarding: {
      introTitles: [
        "It's simple. Read Quran once a day to protect Ramadan focus.",
        "Your Ramadan time is protected until you reconnect with Allah.",
        "Less scrolling. More remembrance this Ramadan.",
      ],
      stepSubtitles: {
        7: "We use Screen Time to protect your Ramadan focus window and pause apps.",
        8: "Choose the apps that pull your attention away in Ramadan.",
        9: "Pick prayer times and set a Ramadan Quran goal.",
      },
      quranFrequencyQuestion: "How often will you read Quran in Ramadan?",
      quranFrequencySubtitle: "This helps us tailor your Ramadan journey",
      reasonsQuestion: "What pulls you away from Allah in Ramadan?",
      screenTimeShieldBody:
        "Screen Time powers a gentle shield. When it appears, open QuranLock and read to reset in Ramadan.",
      screenTimeFirstBullet:
        "Shield appears only in your scheduled Ramadan focus times",
      selectAppsDescription:
        "We’ll only block the apps you select during Ramadan focus time.",
      focusEmptyState:
        "Select a prayer time or add a custom Ramadan time to continue.",
      focusNotificationDescription:
        "We will remind you to open QuranLock when the Ramadan shield appears.",
    },
    paywall: {
      headlineWords: [
        "This",
        "Ramadan,",
        "invest",
        "deeply",
        "in",
        "your",
        "Akhirah.",
      ],
      headlineHighlightedWords: ["ramadan", "akhirah"],
      featureLines: [
        "Block distractions in every Ramadan focus window",
        "Replace scrolling urges with Quran this Ramadan",
        "Stay consistent with timely reminders all Ramadan",
        "Protect your time before Ramadan slips away",
      ],
      ctaTitle: "Commit This Ramadan",
    },
    home: {
      setupAppsDescription:
        "Choose the apps you want paused during Ramadan focus time.",
      setupTimesDescription:
        "Set prayer or custom times so your Ramadan journey stays consistent.",
      journeyTitleActive: "Unlock in Ramadan",
      journeyTitleIdle: "Ramadan journey",
      timelineTitle: "Ramadan timeline",
      progressTitle: "Ramadan progress",
      totalTimeDescription: "Total time spent in Ramadan Qur'an journey",
      pageJourneyLabel: "RAMADAN PAGES",
    },
  },
};
