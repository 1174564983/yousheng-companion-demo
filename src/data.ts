import type {
  CharacterGender,
  CharacterState,
  Emotions,
  LifeEvent,
  WorldClock,
  WorldTime,
} from "./types";
import {
  characterProfiles,
  profileBiography,
  profileDecisions,
} from "./characterProfiles";

const event = (
  id: string,
  day: number,
  startHour: number,
  endHour: number,
  title: string,
  detail: string,
  place: string,
  cause: string,
  mood: number,
  goalId?: string,
  shareable = true,
  chatAvailability: LifeEvent["chatAvailability"] = "busy",
): LifeEvent => ({
  id,
  day,
  startHour,
  endHour,
  title,
  detail,
  place,
  cause,
  mood,
  goalId,
  shareable,
  chatAvailability,
});

export const initialEvents: LifeEvent[] = [
  event(
    "d1-0900",
    1,
    9,
    12,
    "赶一份空间改造提案",
    "把社区旧仓库的动线重画了一遍，还是觉得入口太挤。",
    "工作室",
    "周三要交第一版，想留出修改时间",
    1,
    "proposal",
    false,
  ),
  event(
    "d1-1800",
    1,
    18,
    20,
    "陶艺课：第四次拉坯",
    "杯子又塌了，但这次杯壁比上周均匀。老师让我别急着追求圆。",
    "城南陶艺教室",
    "想把注意力放回手上，而不是一直盯屏幕",
    2,
    "pottery",
    true,
    "busy",
  ),
  event(
    "d1-2200",
    1,
    22,
    23,
    "回家路上给妈妈回电话",
    "聊了十五分钟，她又问我要不要换一份更稳定的工作。",
    "公交车上",
    "答应过妈妈这周会回电话",
    -1,
    "family",
  ),
  event(
    "d2-1000",
    2,
    10,
    12,
    "和同事争论入口方案",
    "对方想加一块很大的导视牌，我觉得会挡住老墙。最后决定各做一版。",
    "工作室",
    "希望保留仓库原来的质感",
    0,
    "proposal",
  ),
  event(
    "d2-1900",
    2,
    19,
    20,
    "夜跑三公里",
    "比计划少跑了两公里，膝盖有点紧。决定不硬撑。",
    "河堤",
    "五公里跑还在准备，但今天身体更重要",
    1,
    "run",
    true,
    "busy",
  ),
  event(
    "d3-0900",
    3,
    9,
    13,
    "修改方案，推翻自己的第一版",
    "把入口往后挪了半米，突然顺了很多。中午才想起来没吃饭。",
    "工作室",
    "不想为了赶上进度交一个自己都不相信的方案",
    1,
    "proposal",
  ),
  event(
    "d3-1400",
    3,
    14,
    17,
    "和大学室友小满喝咖啡",
    "小满说她下个月要搬去成都。我嘴上说挺好，心里有点空。",
    "桥下咖啡店",
    "很久没见，也想问问她最近怎么样",
    -1,
    "friends",
  ),
  event(
    "d3-1900",
    3,
    19,
    21,
    "陶艺课：给杯子上釉",
    "选了很深的青灰色。老师说烧出来可能会更冷，也可能完全不是我想的那样。",
    "城南陶艺教室",
    "上次的杯坯终于干到可以上釉",
    2,
    "pottery",
  ),
  event(
    "d3-2140",
    3,
    21,
    23,
    "在家听唱片，没有继续加班",
    "把提案留在明天。给今天设了一个不太体面的结束。",
    "家",
    "今天已经处理了足够多的事",
    1,
    "rest",
    false,
    "free",
  ),
  event(
    "d4-1000",
    4,
    10,
    12,
    "第二版提案内部评审",
    "入口方案通过了，但预算被砍掉一截。需要重做材料表。",
    "工作室",
    "要给团队一个能落地的版本",
    0,
    "proposal",
  ),
  event(
    "d4-1600",
    4,
    16,
    17,
    "把跑鞋带去修鞋摊",
    "鞋底还能补，修鞋师傅说再跑一个秋天没问题。",
    "巷口修鞋摊",
    "暂时不想买新的，也想把旧的用久一点",
    1,
    "run",
    false,
    "free",
  ),
  event(
    "d5-1030",
    5,
    10,
    12,
    "一个人去看建筑展",
    "在一组关于旧厂房改造的模型前站了很久。",
    "市立美术馆",
    "想看看别人怎么处理‘保留’和‘改变’",
    2,
    "pottery",
    true,
    "free",
  ),
  event(
    "d5-2000",
    5,
    20,
    21,
    "和小满视频",
    "她问我搬走以后会不会联系变少。我没法保证，只说会认真试。",
    "家",
    "不想把还没发生的事说成承诺",
    0,
    "friends",
  ),
  event(
    "d6-0900",
    6,
    9,
    11,
    "修改预算表",
    "材料替换后，方案没有原来漂亮，但落地性更强。",
    "工作室",
    "必须把预算压回可执行范围",
    1,
    "proposal",
  ),
  event(
    "d6-1800",
    6,
    18,
    20,
    "陶艺课：开窑",
    "杯子的釉色比想象中浅，杯口还有一点歪。我居然挺喜欢。",
    "城南陶艺教室",
    "第一次完整做完一只杯子",
    3,
    "pottery",
  ),
  event(
    "d7-1500",
    7,
    15,
    16,
    "带那只杯子去河边坐了一会儿",
    "没有发朋友圈，也没有想好要不要把它拿去办公室用。",
    "河堤",
    "想单独保留一件不为了给谁看的东西",
    2,
    "rest",
    false,
    "free",
  ),
];

export const createInitialState = (
  gender: CharacterGender = "female",
): CharacterState => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const profile = characterProfiles[gender];

  return {
    name: profile.name,
    gender,
    pronoun: profile.pronoun,
    age: 28,
    role: profile.role,
    day: 3,
    hour,
    minute,
    mood: 1,
    energy: 70,
    emotions: {
      valence: 1,
      stress: 32,
      energy: 70,
      socialBattery: 78,
    },
    userImpression: {
      warmth: 50,
      respect: 50,
      predictability: 50,
      currentRead: "刚在一起不久，还在适应你表达关心的方式。",
      updatedAt: Date.now(),
    },
    manualEmotionOverride: false,
    trust: 38,
    goals: [
      { id: "proposal", label: "完成旧仓库改造提案", progress: 56 },
      { id: "pottery", label: "做完第一只自己的杯子", progress: 72 },
      { id: "run", label: "连续八周跑完五公里", progress: 31 },
    ],
    events: initialEvents,
    biography: profileBiography(gender),
    decisions: profileDecisions(gender),
    currentCity: "杭州",
    clock: {
      anchorRealMs: now.getTime(),
      anchorDay: 3,
      anchorHour: hour,
      anchorMinute: minute,
      minutesPerRealSecond: 1 / 60,
      paused: false,
    },
  };
};

const hydrateDecisions = (
  storedDecisions: CharacterState["decisions"] | undefined,
  gender: CharacterGender,
) => {
  const defaults = profileDecisions(gender);
  if (!storedDecisions) return defaults;
  return storedDecisions.map((decision) => {
    const decisionDefaults = defaults.find(
      (item) => item.id === decision.id,
    );
    const normalized = decisionDefaults
      ? {
          ...decisionDefaults,
          ...decision,
          options: decisionDefaults.options,
        }
      : decision;
    if (!normalized.adviceSummary) return normalized;
    const adviceStillRelevant = normalized.options.some((option) =>
      option.keywords.some((keyword) =>
        normalized.adviceSummary?.includes(keyword),
      ),
    );
    return adviceStillRelevant
      ? normalized
      : { ...normalized, adviceSummary: undefined };
  });
};

export const hydrateCharacterState = (
  storedState?: CharacterState,
): CharacterState => {
  if (!storedState) return createInitialState();
  const gender = storedState.gender ?? "female";
  const profile = characterProfiles[gender];

  if (storedState.clock) {
    return {
      ...storedState,
      name: storedState.name || profile.name,
      gender,
      pronoun: storedState.pronoun || profile.pronoun,
      role: storedState.role || profile.role,
      minute: storedState.minute ?? 0,
      emotions: storedState.emotions ?? {
        valence: storedState.mood,
        stress: 32,
        energy: Math.max(storedState.energy, 65),
        socialBattery: 72,
      },
      userImpression: storedState.userImpression ?? {
        warmth: 50,
        respect: 50,
        predictability: 50,
        currentRead: "刚在一起不久，还在适应你表达关心的方式。",
        updatedAt: Date.now(),
      },
      biography: storedState.biography ?? profileBiography(gender),
      decisions: hydrateDecisions(storedState.decisions, gender),
      currentCity: storedState.currentCity ?? "杭州",
      manualEmotionOverride:
        storedState.manualEmotionOverride ?? false,
      clock: {
        ...storedState.clock,
        paused: storedState.clock.paused ?? false,
        minutesPerRealSecond: 1 / 60,
      },
    };
  }

  return {
    ...storedState,
    name: storedState.name || profile.name,
    gender,
    pronoun: storedState.pronoun || profile.pronoun,
    role: storedState.role || profile.role,
    minute: storedState.minute ?? 0,
    emotions: storedState.emotions ?? {
      valence: storedState.mood,
      stress: 32,
      energy: Math.max(storedState.energy, 65),
      socialBattery: 72,
    },
    userImpression: storedState.userImpression ?? {
      warmth: 50,
      respect: 50,
      predictability: 50,
      currentRead: "刚在一起不久，还在适应你表达关心的方式。",
      updatedAt: Date.now(),
    },
    biography: storedState.biography ?? profileBiography(gender),
    decisions: hydrateDecisions(storedState.decisions, gender),
    currentCity: storedState.currentCity ?? "杭州",
    manualEmotionOverride:
      storedState.manualEmotionOverride ?? false,
    clock: {
      anchorRealMs: Date.now(),
      anchorDay: storedState.day,
      anchorHour: storedState.hour,
      anchorMinute: storedState.minute ?? 0,
      minutesPerRealSecond: 1 / 60,
      paused: false,
    },
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const emotionAfterEvent = (
  emotions: Emotions,
  event: LifeEvent,
): Emotions => {
  const duration = Math.max(1, event.endHour - event.startHour);
  const socialEvent =
    event.goalId === "friends" ||
    event.place.includes("咖啡") ||
    event.place.includes("陶艺");
  const quietRest =
    event.title.includes("唱片") ||
    event.title.includes("河边") ||
    event.title.includes("一个人");

  return {
    valence: clamp(emotions.valence * 0.55 + event.mood * 1.2, -3, 3),
    stress: clamp(
      emotions.stress +
        (event.mood < 0 ? 12 : event.mood === 0 ? 4 : -6) +
        duration,
      8,
      95,
    ),
    energy: clamp(
      emotions.energy -
        duration * 2 +
        (quietRest ? 16 : 0) -
        (socialEvent ? 5 : 0),
      12,
      96,
    ),
    socialBattery: clamp(
      emotions.socialBattery +
        (quietRest ? 10 : 0) -
        (socialEvent ? 6 : 2),
      8,
      96,
    ),
  };
};

const clockToMinutes = (clock: WorldClock) =>
  ((clock.anchorDay - 1) * 24 + clock.anchorHour) * 60 +
  clock.anchorMinute;

export const worldTimeAt = (
  clock: WorldClock,
  nowMs = Date.now(),
): WorldTime => {
  if (clock.paused) {
    return {
      day: clock.anchorDay,
      hour: clock.anchorHour,
      minute: clock.anchorMinute,
    };
  }

  const elapsedRealSeconds = Math.max(0, nowMs - clock.anchorRealMs) / 1000;
  const simulatedMinutes =
    elapsedRealSeconds * clock.minutesPerRealSecond;
  const totalMinutes = Math.floor(clockToMinutes(clock) + simulatedMinutes);
  const day = Math.floor(totalMinutes / (24 * 60)) + 1;
  const minuteOfDay = totalMinutes % (24 * 60);
  return {
    day,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
};

export const shiftWorldClock = (
  clock: WorldClock,
  hours: number,
  nowMs = Date.now(),
): { clock: WorldClock; time: WorldTime } => {
  const current = worldTimeAt(clock, nowMs);
  const shiftedMinutes =
    ((current.day - 1) * 24 + current.hour) * 60 +
    current.minute +
    Math.round(hours * 60);
  const day = Math.floor(shiftedMinutes / (24 * 60)) + 1;
  const minuteOfDay =
    ((shiftedMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return {
    time: { day, hour, minute },
    clock: {
      ...clock,
      anchorRealMs: nowMs,
      anchorDay: day,
      anchorHour: hour,
      anchorMinute: minute,
      paused: clock.paused,
    },
  };
};

export const currentEventFor = (state: CharacterState) => {
  const minuteOfDay = state.hour * 60 + (state.minute ?? 0);
  const startMinute = Math.floor(minuteOfDay / 60) * 60;

  if (minuteOfDay >= 23 * 60 || minuteOfDay < 8 * 60) {
    return event(
      `sleep-${state.day}-${state.hour}`,
      state.day,
      minuteOfDay >= 23 * 60 ? 23 : 0,
      minuteOfDay >= 23 * 60 ? 24 : 8,
      "已经睡了",
      "今天没有继续回消息。手机被放到一边，准备留到醒来再处理。",
      "家",
      "今天已经结束，明天还有自己的安排",
      0,
      "rest",
      false,
    );
  }

  const exact = state.events.find(
    (item) =>
      item.day === state.day &&
      minuteOfDay >= item.startHour * 60 &&
      minuteOfDay < item.endHour * 60,
  );

  if (exact) return exact;

  const previous = state.events
    .filter(
      (item) =>
        item.day < state.day ||
        (item.day === state.day && item.endHour * 60 <= minuteOfDay),
    )
    .sort((a, b) => b.day - a.day || b.endHour - a.endHour);

  const next = state.events
    .filter(
      (item) =>
        item.day > state.day ||
        (item.day === state.day &&
          item.startHour * 60 >= startMinute),
    )
    .sort((a, b) => a.day - b.day || a.startHour - b.startHour);

  return previous[0] ?? next[0] ?? state.events[0];
};

export const upcomingEventsFor = (state: CharacterState, limit = 3) =>
  state.events
    .filter(
      (item) =>
        item.day > state.day ||
        (item.day === state.day && item.startHour > state.hour),
    )
    .sort((a, b) => a.day - b.day || a.startHour - b.startHour)
    .slice(0, limit);

export const moodLabel = (mood: number) => {
  if (mood >= 3) return "明亮";
  if (mood >= 1) return "平稳";
  if (mood >= -1) return "有点疲惫";
  return "低落";
};
