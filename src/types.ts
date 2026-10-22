export type Goal = {
  id: string;
  label: string;
  progress: number;
};

export type CharacterGender = "female" | "male";

export type LifeEvent = {
  id: string;
  day: number;
  startHour: number;
  endHour: number;
  title: string;
  detail: string;
  place: string;
  cause: string;
  mood: number;
  goalId?: string;
  shareable: boolean;
  chatAvailability: "free" | "busy";
};

export type BiographyChapter = {
  id: string;
  years: string;
  age: string;
  title: string;
  place: string;
  summary: string;
  impact: string;
};

export type DecisionOption = {
  id: string;
  label: string;
  summary: string;
  keywords: string[];
};

export type LifeDecision = {
  id: string;
  title: string;
  question: string;
  context: string;
  deadlineDay: number;
  trustRequired: number;
  status: "open" | "decided";
  chosenOptionId?: string;
  influencedByUser?: boolean;
  adviceSummary?: string;
  options: DecisionOption[];
};

export type CharacterState = {
  name: string;
  gender: CharacterGender;
  pronoun: "她" | "他";
  age: number;
  role: string;
  day: number;
  hour: number;
  minute: number;
  mood: number;
  energy: number;
  emotions: Emotions;
  userImpression: UserImpression;
  manualEmotionOverride?: boolean;
  lastEmotionEventId?: string;
  trust: number;
  goals: Goal[];
  events: LifeEvent[];
  biography: BiographyChapter[];
  decisions: LifeDecision[];
  currentCity: string;
  clock: WorldClock;
};

export type Emotions = {
  valence: number;
  stress: number;
  energy: number;
  socialBattery: number;
};

export type UserImpression = {
  warmth: number;
  respect: number;
  predictability: number;
  currentRead: string;
  updatedAt: number;
};

export type WorldClock = {
  anchorRealMs: number;
  anchorDay: number;
  anchorHour: number;
  anchorMinute: number;
  minutesPerRealSecond: number;
  paused: boolean;
};

export type WorldTime = {
  day: number;
  hour: number;
  minute: number;
};

export type Memory = {
  id: string;
  kind: "user" | "relationship" | "boundary";
  text: string;
  createdAt: number;
  source: "onboarding" | "chat";
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  worldTime?: WorldTime;
  meta?: {
    availability: "free" | "busy" | "resting";
    stance: "listen" | "reflect" | "disagree" | "boundary" | "safety";
    usedMemoryIds: string[];
    activity: string;
    source?: "model" | "local";
  };
};

export type UserProfile = {
  name: string;
  supportStyle: "listen" | "direct" | "space";
  onboarded: boolean;
};

export type ModelStatus = {
  configured: boolean;
  provider: string;
  model: string;
  reason?: string;
};

export type ModelReply = {
  reply: string;
  stance: Message["meta"] extends infer T
    ? T extends { stance: infer S }
      ? S
      : never
    : never;
  used_memory_ids: string[];
  memory_candidate: {
    text: string;
    kind: Memory["kind"];
  } | null;
};
