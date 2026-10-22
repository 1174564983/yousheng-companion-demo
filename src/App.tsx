import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  MapPin,
  MessageCircle,
  NotebookText,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  currentEventFor,
  emotionAfterEvent,
  hydrateCharacterState,
  moodLabel,
  shiftWorldClock,
  upcomingEventsFor,
  worldTimeAt,
} from "./data";
import { getModelStatus, requestModelReply } from "./api";
import { generateReply, starterMessages } from "./chatEngine";
import {
  decisionConsequence,
  findDecisionAdvice,
  trustLabel,
} from "./lifeStory";
import {
  analyzeRecentInteraction,
  applyInteractionAnalysis,
} from "./conversationDynamics";
import { auditDraftReply } from "./responseAudit";
import {
  applyCharacterProfile,
  characterProfiles,
} from "./characterProfiles";
import type {
  CharacterGender,
  CharacterState,
  Memory,
  Message,
  ModelStatus,
  UserProfile,
} from "./types";

type Tab = "chat" | "life" | "memory";

type StoredData = {
  profile: UserProfile;
  state: CharacterState;
  memories: Memory[];
  messages: Message[];
  unansweredMessages?: Message[];
};

const STORAGE_KEY = "yousheng-romance-demo-v1";

const defaultProfile: UserProfile = {
  name: "",
  supportStyle: "listen",
  onboarded: false,
};

const buildInitialMemories = (profile: UserProfile): Memory[] => {
  const styleText =
    profile.supportStyle === "direct"
      ? "情绪低落时，你更希望我直接说出问题和建议。"
      : profile.supportStyle === "space"
        ? "情绪低落时，你需要一点空间，不喜欢被追问。"
        : "情绪低落时，你希望我先听你把话说完。";

  return [
    {
      id: "mem-style",
      kind: "boundary",
      text: styleText,
      createdAt: Date.now(),
      source: "onboarding",
    },
    {
      id: "mem-name",
      kind: "relationship",
      text: `你叫${profile.name || "这位恋人"}，我们已经确定恋爱关系，刚在一起不久。`,
      createdAt: Date.now() + 1,
      source: "onboarding",
    },
  ];
};

const loadStored = (): StoredData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredData) : null;
  } catch {
    return null;
  }
};

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const extractName = (text: string) => {
  const match = text.match(
    /(?:我叫|叫我)[\s，,:：]*(?!什么|啥|哪|谁|多少)([\u4e00-\u9fa5A-Za-z0-9_·]{2,16})/,
  );
  const name = match?.[1]?.trim();
  return name &&
    !/^(什么|啥|什么名字|谁|哪里|多少)/.test(name)
    ? name
    : null;
};

const memoriesFromText = (text: string): Memory[] => {
  const result: Memory[] = [];
  const name = extractName(text);
  if (name) {
    result.push({
      id: makeId("mem-name"),
      kind: "relationship",
      text: `你叫${name}。`,
      createdAt: Date.now(),
      source: "chat",
    });
  }

  const withoutName = name
    ? text.replace(
        /(?:我叫|叫我)[\s，,:：]*(?!什么|啥|哪|谁|多少)[\u4e00-\u9fa5A-Za-z0-9_·]{2,16}/,
        "",
      )
    : text;
  const genericText = withoutName.replace(
    /(?:你)?记住了?(?:吗|没|没有)?/g,
    "",
  );
  const explicitlyRemembered = /记住/.test(withoutName);

  if (
    /[？?]\s*$/.test(genericText) ||
    /(你还记得|记不记得)/.test(genericText) ||
    (!explicitlyRemembered &&
      !/(我最近|我喜欢|我不喜欢|我在做|我正在|我喝|我吃|我住在|我的名字|我希望)/.test(
        genericText,
      ))
  ) {
    return result;
  }

  const cleaned = genericText
    .replace(/^请?你?记住[，,:：]?/, "")
    .replace(/[。；;，,\s]+$/, "")
    .trim()
    .slice(0, 80);

  if (cleaned) {
    result.push({
      id: makeId("mem"),
      kind: "user",
      text: cleaned,
      createdAt: Date.now(),
      source: "chat",
    });
  }

  return result;
};

const memoryMerge = (current: Memory[], incoming: Memory[]) => {
  const next = [...current];
  for (const memory of incoming) {
    const incomingName = memory.text.match(/你叫([^，。；\s]+)/)?.[1];
    if (incomingName) {
      const existingIndex = next.findIndex(
        (item) =>
          item.kind === "relationship" &&
          item.text.match(/你叫([^，。；\s]+)/)?.[1],
      );
      if (existingIndex >= 0) {
        const existingName = next[existingIndex].text.match(
          /你叫([^，。；\s]+)/,
        )?.[1];
        if (existingName !== incomingName) {
          next.splice(existingIndex, 1, memory);
        }
        continue;
      }
    }
    const duplicate = next.some(
      (item) => {
        const sameText =
          item.text.replace(/[。；;，,\s]+$/, "") ===
          memory.text.replace(/[。；;，,\s]+$/, "");
        const existingName = item.text.match(/你叫([^，。；\s]+)/)?.[1];
        return (
          sameText ||
          Boolean(
            incomingName &&
              existingName &&
              incomingName === existingName &&
              item.kind === "relationship" &&
              memory.kind === "relationship",
          )
        );
      },
    );
    if (!duplicate) next.push(memory);
  }
  return next;
};

const backfillMemories = (
  storedMemories: Memory[] | undefined,
  messages: Message[] | undefined,
): Memory[] => {
  const base = (storedMemories ?? []).filter(
    (memory) => {
      if (memory.kind !== "relationship") return true;
      const storedName = memory.text.match(/你叫([^，。；\s]+)/)?.[1];
      return !(
        /你叫(什么|啥|哪|谁)/.test(memory.text) ||
        (storedName && storedName.length < 2)
      );
    },
  );
  const latestName = [...(messages ?? [])]
    .reverse()
    .filter((message) => message.role === "user")
    .map((message) => extractName(message.text))
    .find(Boolean);

  if (!latestName) return base;
  const hasName = base.some(
    (memory) =>
      memory.kind === "relationship" && memory.text.includes(latestName),
  );
  if (hasName) return base;

  return [
    ...base,
    {
      id: makeId("mem-name"),
      kind: "relationship",
      text: `你叫${latestName}。`,
      createdAt: Date.now(),
      source: "chat",
    },
  ];
};

const timeLabel = (hour: number, minute = 0) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const availabilityLabel = (availability?: string) => {
  if (availability === "busy") return "正在忙";
  if (availability === "resting") return "在休息";
  return "有空聊";
};

const stanceLabel = (stance?: string) => {
  if (stance === "disagree") return "没有顺着你";
  if (stance === "boundary") return "保留自己的安排";
  if (stance === "safety") return "安全优先";
  if (stance === "reflect") return "记忆引用";
  return "先听你说";
};

const emotionSummary = (state: CharacterState) => {
  if (state.emotions.socialBattery < 22) return "社交电量偏低，只会简短回应";
  if (state.emotions.stress > 72) return "压力偏高，表达会更短、更直";
  if (state.emotions.energy < 32) return "有点累，主动性会下降";
  if (state.emotions.valence > 1) return "心情不错，愿意分享细节";
  return "情绪平稳，愿意听你说话";
};

const isDirectFactQuestion = (text: string) =>
  /(我叫什么|我的名字|你叫什么|多少岁|几岁|做什么工作|职业|哪个城市|哪里人|住哪|现在.*几点|几点了|大学|学校|读书|上学|小时候|你会什么|你会做什么|几个朋友|朋友多吗|多少朋友|有朋友吗|你今天在忙什么|在忙什么|你在干嘛|现在在做什么|此刻在哪|你(?:现在)?在哪(?!个城市))/.test(
    text,
  ) &&
  !/(为什么|怎么办|建议|觉得|怎么想)/.test(text);

const isShortCasualMessage = (text: string) =>
  /^(在吗|在不在|嗯+|哦+|哎+|唉+|哈+|好|好吧|行|行吧|晚安|早|早上好|刚到家|到家了|知道了|谢谢|谢谢你|明天见|我去睡了|准备睡了)[。！？!?\s]*$/.test(
    text,
  ) &&
  !isDirectFactQuestion(text) &&
  !/([？?]|吗|呢|什么|怎么|为什么|累|难受|失败|担心|想你|不想说|安排|尊重)/.test(
    text,
  );

const firstSentence = (text: string) => {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[。！？!?]/);
  return (match?.[0] || trimmed).trim();
};

const fitReplyToInput = (reply: string, userText: string) => {
  const userLength = userText.replace(/[\s，。！？!?、；;：:]/g, "").length;
  const maxLength = Math.max(
    24,
    Math.min(220, Math.ceil(userLength * 1.5) + 8),
  );
  if (reply.length <= maxLength) return reply;

  const parts = reply.match(/[^。！？!?]+[。！？!?]?/g) || [reply];
  let fitted = "";
  for (const part of parts) {
    if ((fitted + part).length > maxLength) break;
    fitted += part;
  }
  if (fitted.trim()) return fitted.trim();
  return `${reply.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
};

const splitReplyForDelivery = (
  text: string,
  directFact: boolean,
  shortCasual: boolean,
) => {
  const trimmed = text.trim();
  if (!trimmed || directFact || shortCasual) return [trimmed];

  const paragraphs = trimmed
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const units =
    paragraphs.length > 1
      ? paragraphs
      : trimmed.match(/[^。！？!?]+[。！？!?]?/g)?.map((part) => part.trim()) ||
        [trimmed];

  if (units.length <= 1) {
    if (trimmed.length <= 55) return [trimmed];
    const clauses =
      trimmed
        .match(/[^，,；;。！？!?]+[，,；;。！？!?]?/g)
        ?.map((part) => part.trim())
        .filter(Boolean) || [];
    if (clauses.length > 1) {
      const middle = Math.ceil(clauses.length / 2);
      return [
        clauses.slice(0, middle).join(""),
        clauses.slice(middle).join(""),
      ].filter(Boolean);
    }
    return [trimmed];
  }
  if (units.length <= 3) return units.filter(Boolean);
  return [
    ...units.slice(0, 2),
    units.slice(2).join("").trim(),
  ].filter(Boolean);
};

function App() {
  const testMode =
    new URLSearchParams(window.location.search).get("test") === "1";
  const stored = useMemo(loadStored, []);
  const hydratedState = useMemo(() => {
    const base = hydrateCharacterState(stored?.state);
    if (stored?.state?.userImpression || !stored?.messages?.length) {
      return base;
    }
    return applyInteractionAnalysis(
      base,
      analyzeRecentInteraction(stored.messages, base.gender),
    );
  }, [stored]);
  const hydratedMemories = useMemo(
    () => backfillMemories(stored?.memories, stored?.messages),
    [stored],
  );
  const [profile, setProfile] = useState<UserProfile>(
    stored?.profile ?? defaultProfile,
  );
  const [state, setState] = useState<CharacterState>(hydratedState);
  const [memories, setMemories] = useState<Memory[]>(
    hydratedMemories,
  );
  const [messages, setMessages] = useState<Message[]>(
    stored?.messages ?? starterMessages(hydratedState),
  );
  const [unansweredMessages, setUnansweredMessages] = useState<Message[]>(
    stored?.unansweredMessages ?? [],
  );
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGender, setSetupGender] =
    useState<CharacterGender>("female");
  const [setupStyle, setSetupStyle] =
    useState<UserProfile["supportStyle"]>("listen");
  const [adult, setAdult] = useState(false);
  const [showContext, setShowContext] = useState<string | null>(null);
  const [showEmotionPanel, setShowEmotionPanel] = useState(false);
  const [toast, setToast] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [queueSeenAt, setQueueSeenAt] = useState(Date.now());
  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    configured: false,
    provider: "local",
    model: "规则引擎",
  });
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const autoReplyInFlight = useRef(false);
  const queuedAckRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    getModelStatus().then(setModelStatus);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile,
        state,
        memories,
        messages,
        unansweredMessages,
      }),
    );
  }, [profile, state, memories, messages, unansweredMessages]);

  useEffect(() => {
    let secondFrame = 0;
    let settleTimer = 0;
    const scrollToLatest = () => {
      const list = messageListRef.current;
      if (!list) return;
      const previousBehavior = list.style.scrollBehavior;
      list.style.scrollBehavior = "auto";
      list.scrollTop = list.scrollHeight;
      window.requestAnimationFrame(() => {
        list.style.scrollBehavior = previousBehavior;
      });
    };
    const firstFrame = window.requestAnimationFrame(() => {
      scrollToLatest();
      secondFrame = window.requestAnimationFrame(() => {
        scrollToLatest();
      });
      settleTimer = window.setTimeout(() => {
        scrollToLatest();
      }, 180);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
    };
  }, [messages, pending]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const worldTime = worldTimeAt(state.clock, nowMs);
  const resolvedGender = state.gender ?? "female";
  const resolvedProfile = characterProfiles[resolvedGender];
  const liveState: CharacterState = {
    ...state,
    ...worldTime,
    name: state.name || resolvedProfile.name,
    gender: resolvedGender,
    pronoun: state.pronoun || resolvedProfile.pronoun,
    role: state.role || resolvedProfile.role,
  };
  const activeProfile = characterProfiles[liveState.gender];
  const selectedProfile = characterProfiles[setupGender];
  const current = currentEventFor(liveState);
  const upcoming = upcomingEventsFor(liveState, 1)[0];
  const todayEvents = liveState.events.filter(
    (item) => item.day === liveState.day,
  );
  const currentMinuteOfDay = liveState.hour * 60 + liveState.minute;
  const isCurrentEventActive =
    currentMinuteOfDay >= current.startHour * 60 &&
    currentMinuteOfDay < current.endHour * 60;
  const currentDisplayTitle =
    current.title === "已经睡了"
      ? current.title
      : isCurrentEventActive
        ? current.title
        : upcoming
          ? "下一件事之前，留了一段空档"
          : "今天的事情已经告一段落";
  const currentDisplayDetail =
    current.title === "已经睡了" || isCurrentEventActive
      ? current.detail
      : upcoming
        ? `下一件事是 ${timeLabel(
            upcoming.startHour,
          )} 的“${upcoming.title}”。现在${activeProfile.pronoun}可以自由安排这一小段。`
        : `没有下一件既定的事，${activeProfile.pronoun}正在把今天慢慢收尾。`;
  const currentDisplayPlace =
    current.title === "已经睡了" || isCurrentEventActive
      ? current.place
      : upcoming
        ? "日程空隙"
        : "家 / 路上";
  const currentGoal = liveState.goals.find(
    (goal) =>
      goal.id === (isCurrentEventActive ? current.goalId : upcoming?.goalId),
  );
  const rawAvailability =
    current.title === "已经睡了"
      ? "resting"
      : isCurrentEventActive
        ? current.chatAvailability === "free"
          ? "free"
          : "busy"
        : liveState.emotions.energy < 18
          ? "resting"
          : "free";
  const emotionallyWithdrawn =
    liveState.emotions.stress >= 85 &&
    /(攻击|试探|审问|替.*决定|越界|不想继续)/.test(
      liveState.userImpression.currentRead,
    );
  const currentAvailability = emotionallyWithdrawn
    ? "resting"
    : rawAvailability;
  const wantsToTalk = currentAvailability === "free";

  useEffect(() => {
    if (
      !unansweredMessages.length ||
      wantsToTalk ||
      current.title === "已经睡了"
    ) {
      queuedAckRef.current = false;
      return;
    }

    setQueueSeenAt(Date.now());
    const timer = window.setInterval(
      () => setQueueSeenAt(Date.now()),
      2 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [unansweredMessages.length, wantsToTalk, current.title]);

  useEffect(() => {
    if (
      state.manualEmotionOverride ||
      current.id === state.lastEmotionEventId
    ) {
      return;
    }

    setState((currentState) => {
      if (current.title === "已经睡了") {
        return {
          ...currentState,
          emotions: {
            ...currentState.emotions,
            stress: Math.max(8, currentState.emotions.stress - 12),
            energy: Math.min(96, currentState.emotions.energy + 16),
            socialBattery: Math.min(
              96,
              currentState.emotions.socialBattery + 10,
            ),
          },
          lastEmotionEventId: current.id,
        };
      }

      const nextEmotions = emotionAfterEvent(
        currentState.emotions,
        current,
      );
      return {
        ...currentState,
        emotions: nextEmotions,
        mood: Math.round(nextEmotions.valence),
        energy: Math.round(nextEmotions.energy),
        lastEmotionEventId: current.id,
      };
    });
  }, [
    current.id,
    current.title,
    state.lastEmotionEventId,
    state.manualEmotionOverride,
  ]);

  const finishOnboarding = () => {
    if (!adult || !setupName.trim()) return;
    const nextProfile: UserProfile = {
      name: setupName.trim(),
      supportStyle: setupStyle,
      onboarded: true,
    };
    const nextMemories = buildInitialMemories(nextProfile);
    const nextState = applyCharacterProfile(
      { ...liveState, clock: state.clock },
      setupGender,
    );
    setProfile(nextProfile);
    setMemories(nextMemories);
    setState(nextState);
    setMessages(starterMessages(nextState));
    setUnansweredMessages([]);
  };

  async function respondToBatch(batch: Message[], deferred: boolean) {
    if (!batch.length) return;
    const combinedText = batch.map((message) => message.text).join("\n");
    const forceShortLocal =
      isDirectFactQuestion(combinedText) ||
      /^[?？]+$/.test(combinedText.trim());
    const batchIds = new Set(batch.map((message) => message.id));
    const history = messages.filter((message) => !batchIds.has(message.id));
    const interaction = analyzeRecentInteraction(
      [...history, ...batch],
      liveState.gender,
    );
    const responseState = applyInteractionAnalysis(liveState, interaction);
    const heuristicMemories = memoriesFromText(combinedText);
    const detectedName = extractName(combinedText);
    const contextProfile = detectedName
      ? { ...profile, name: detectedName }
      : profile;
    const contextMemories = memoryMerge(memories, heuristicMemories);
    const newMemories: Memory[] = [...heuristicMemories];
    let reply: Omit<Message, "id" | "role" | "createdAt"> | null = null;
    const sentTime = batch[0]?.worldTime;
    const adviceMatch = findDecisionAdvice(
      combinedText,
      liveState.decisions,
    );
    const adviceEligible = Boolean(
      adviceMatch &&
        responseState.trust >= adviceMatch.decision.trustRequired,
    );
    const deferredNote = deferred
      ? `用户在${
          sentTime
            ? `第 ${sentTime.day} 天 ${timeLabel(
                sentTime.hour,
                sentTime.minute,
              )}`
            : "之前"
        }连续留下了 ${batch.length} 条消息。${liveState.name}当时在忙或已经睡了，所以没有立即回复。其中“你先睡”“去忙吧”等是在对${liveState.name}说，不是用户自己的状态。现在是 ${timeLabel(
          liveState.hour,
          liveState.minute,
        )}，${liveState.pronoun}已经醒来或忙完，应主动回应这些留言，不要要求用户再问一遍，也不要误解用户是在说自己要睡觉。`
      : "";
    const adviceNote = adviceMatch
      ? `用户正在建议${liveState.name}在“${adviceMatch.decision.title}”中选择“${
          adviceMatch.decision.options.find(
            (option) => option.id === adviceMatch.optionId,
          )?.label
        }”。当前关系信任 ${responseState.trust}，门槛 ${
          adviceMatch.decision.trustRequired
        }；${
          adviceEligible
            ? `已经达到门槛，${liveState.pronoun}可以因为这段建议调整决定，回复中要承认用户意见对自己的影响。`
            : `还没有达到门槛，${liveState.pronoun}会认真听，但不应马上把决定完全交给用户。`
        }`
      : "";
    const contextNote = [deferredNote, adviceNote, interaction.modelNote]
      .filter(Boolean)
      .join("\n");

    if (modelStatus.configured && !forceShortLocal) {
      try {
        const modelReply = await requestModelReply({
          state: responseState,
          profile: contextProfile,
          memories: contextMemories,
          messages: history,
          userText: combinedText,
          contextNote,
        });
        const asksName = /(我叫什么|我的名字|知道我.*名字)/.test(
          combinedText,
        );
        const nameMemory = contextMemories.find(
          (memory) =>
            memory.kind === "relationship" &&
            contextProfile.name &&
            memory.text.includes(contextProfile.name),
        );
        if (
          asksName &&
          nameMemory &&
          !modelReply.reply.includes(contextProfile.name)
        ) {
          throw new Error("模型没有回答用户询问的名字");
        }
        const asksOrigin =
          /(在哪认识|哪里认识|怎么认识|怎么遇到|认识多久)/.test(
            combinedText,
          );
        if (
          asksOrigin &&
          !/(有生|demo|这里|线上|第一次对话)/i.test(modelReply.reply)
        ) {
          throw new Error("模型没有正面回答认识来源");
        }
        const asksWhyNoReply =
          /(为什么不回|怎么不回|不理我|装高冷|昨晚.*消息)/.test(
            combinedText,
          );
        if (
          asksWhyNoReply &&
          !/(睡|忙|没看到|延迟|现在才|消息)/.test(modelReply.reply)
        ) {
          throw new Error("模型没有解释延迟回复");
        }
        const asksCareer =
          /(做什么工作|职业|工作是什么|干什么工作)/.test(combinedText);
        if (
          asksCareer &&
          !/(空间|改造|事务|建筑|设计)/.test(modelReply.reply)
        ) {
          throw new Error("模型没有回答职业问题");
        }
        const asksCurrentActivity =
          /(在忙|干嘛|做什么|你(?:现在)?在哪|当前在哪|此刻在哪|今天.*什么)/.test(
            combinedText,
          ) && !asksCareer;
        if (
          asksCurrentActivity &&
          !modelReply.reply.includes(currentDisplayTitle) &&
          !modelReply.reply.includes(currentDisplayPlace) &&
          !modelReply.reply.includes("现在")
        ) {
          throw new Error("模型没有回答当前的行动状态");
        }
        const asksRecall =
          /(记忆|上次|之前说|还记得|记不记得|你记得.*(什么|吗|哪))/.test(
            combinedText,
          ) &&
          !asksName;
        if (
          asksRecall &&
          contextMemories.length > 0 &&
          modelReply.used_memory_ids.length === 0 &&
          !/(不记得|没有.*记忆|不确定)/.test(modelReply.reply)
        ) {
          throw new Error("模型没有检索相关记忆");
        }
        const normalizedReply = modelReply.reply
          .replace(/[\s，。！？!?、；;：:]/g, "")
          .slice(0, 120);
        const repeated = history
          .filter((message) => message.role === "assistant")
          .slice(-4)
          .some(
            (message) =>
              message.text
                .replace(/[\s，。！？!?、；;：:]/g, "")
                .slice(0, 120) === normalizedReply,
          );
        if (repeated) {
          throw new Error("模型重复了上一轮回复");
        }
        const validMemoryIds = new Set(
          contextMemories.map((item) => item.id),
        );
        reply = {
          text: modelReply.reply,
          meta: {
            availability: currentAvailability,
            stance: modelReply.stance,
            usedMemoryIds: modelReply.used_memory_ids.filter((id) =>
              validMemoryIds.has(id),
            ),
            activity: currentDisplayTitle,
            source: "model",
          },
        };
        if (modelReply.memory_candidate?.text) {
          const candidateName =
            modelReply.memory_candidate.kind === "relationship"
              ? modelReply.memory_candidate.text.match(
                  /你叫([^，。；\s]+)/,
                )?.[1]
              : undefined;
          if (!candidateName || candidateName.length >= 2) {
            newMemories.push({
              id: makeId("mem"),
              kind: modelReply.memory_candidate.kind,
              text: modelReply.memory_candidate.text,
              createdAt: Date.now(),
              source: "chat",
            });
          }
        }
      } catch (error) {
        setToast(
          `模型请求失败，已切回本地模式：${
            error instanceof Error ? error.message.slice(0, 80) : "未知错误"
          }`,
        );
      }
    }

    if (!reply) {
      const localReply = generateReply(
        combinedText,
        responseState,
        contextMemories,
        contextProfile,
        deferred,
      );
      reply = {
        ...localReply,
        meta: localReply.meta
          ? { ...localReply.meta, source: "local" }
          : undefined,
      };
    }

    if (reply && reply.meta?.stance !== "safety") {
      reply = {
        ...reply,
        text: fitReplyToInput(reply.text, combinedText),
      };
    }
    if (reply && isShortCasualMessage(combinedText) && reply.text.length > 32) {
      reply = {
        ...reply,
        text: fitReplyToInput(firstSentence(reply.text), combinedText),
      };
    }

    if (reply) {
      const audit = auditDraftReply({
        text: reply.text,
        userText: combinedText,
        state: responseState,
        memories: contextMemories,
        profileName: contextProfile.name,
        recentMessages: history,
      });
      if (!audit.pass) {
        if (audit.reason === "duplicate") {
          const localReply = generateReply(
            combinedText,
            responseState,
            contextMemories,
            contextProfile,
            deferred,
          );
          reply = {
            ...localReply,
            meta: localReply.meta
              ? { ...localReply.meta, source: "local" }
              : undefined,
          };
        } else {
          reply = { ...reply, text: audit.text };
        }
      }
    }

    const replyParts = splitReplyForDelivery(
      reply.text,
      forceShortLocal,
      isShortCasualMessage(combinedText),
    );
    for (let index = 0; index < replyParts.length; index += 1) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, index === 0 ? 900 : 650),
      );
      setMessages((items) => [
        ...items,
        {
          id: makeId("assistant"),
          role: "assistant",
          createdAt: Date.now(),
          worldTime: {
            day: liveState.day,
            hour: liveState.hour,
            minute: liveState.minute,
          },
          ...reply,
          text: replyParts[index],
          meta: index === 0 ? reply.meta : undefined,
        },
      ]);
    }
    setPending(false);

    setState((currentState) => {
      let nextState = applyInteractionAnalysis(currentState, interaction);
      if (adviceMatch) {
        const canChange =
          nextState.trust >= adviceMatch.decision.trustRequired;
        const chosenOption = adviceMatch.decision.options.find(
          (option) => option.id === adviceMatch.optionId,
        );
        const decisions = nextState.decisions.map((decision) =>
          decision.id === adviceMatch.decision.id
            ? {
                ...decision,
                status: canChange ? ("decided" as const) : decision.status,
                chosenOptionId: canChange
                  ? adviceMatch.optionId
                  : decision.chosenOptionId,
                influencedByUser: canChange
                  ? true
                  : decision.influencedByUser,
                adviceSummary: combinedText.slice(0, 120),
              }
            : decision,
        );
        const consequence =
          canChange && chosenOption
            ? decisionConsequence(
                adviceMatch.decision,
                chosenOption.id,
                {
                  name: liveState.name,
                  pronoun: liveState.pronoun,
                },
              )
            : null;
        nextState = {
          ...nextState,
          decisions,
          trust: Math.min(100, nextState.trust + (canChange ? 3 : 1)),
          events: consequence
            ? nextState.events.some(
                (event) => event.id === consequence.id,
              )
              ? nextState.events
              : [...nextState.events, consequence]
            : nextState.events,
        };
      } else {
        nextState = {
          ...nextState,
          trust: Math.min(
            100,
            nextState.trust + (newMemories.length ? 2 : 0.5),
          ),
        };
      }
      return nextState;
    });

    if (adviceMatch) {
      if (adviceEligible) {
        const chosenLabel = adviceMatch.decision.options.find(
          (option) => option.id === adviceMatch.optionId,
        )?.label;
        newMemories.push({
          id: makeId("mem-decision"),
          kind: "relationship",
          text: `你曾建议${liveState.name}“${chosenLabel}”，${liveState.pronoun}因此调整了关于“${adviceMatch.decision.title}”的决定。`,
          createdAt: Date.now(),
          source: "chat",
        });
        setToast(
          `你的建议改变了${liveState.pronoun}的决定：${chosenLabel}`,
        );
      }
    }

    if (detectedName && detectedName !== profile.name) {
      setProfile(contextProfile);
    }

    if (newMemories.length) {
      setMemories((items) => {
        return memoryMerge(items, newMemories);
      });
    }
  }

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if (!text) return;
    const userMessage: Message = {
      id: makeId("user"),
      role: "user",
      text,
      createdAt: Date.now(),
      worldTime: {
        day: liveState.day,
        hour: liveState.hour,
        minute: liveState.minute,
      },
    };

    if (pending) {
      setMessages((items) => [...items, userMessage]);
      setUnansweredMessages((items) => [...items, userMessage]);
      setDraft("");
      setToast(
        `又收到一条。等${liveState.pronoun}回完当前这轮，再接着看后面的话。`,
      );
      return;
    }

    setMessages((items) => [...items, userMessage]);
    setDraft("");
    setPending(true);

    const crisis = /(不想活|自杀|结束生命|伤害自己|去死|活不下去)/.test(
      text,
    );
    const canAnswerDirectFact =
      (isDirectFactQuestion(text) || /^[?？]+$/.test(text)) &&
      current.title !== "已经睡了" &&
      (!isCurrentEventActive || current.chatAvailability === "free");
    if (!crisis && !wantsToTalk && !canAnswerDirectFact) {
      const alreadyQueued = unansweredMessages.length > 0;
      setUnansweredMessages((items) => [...items, userMessage]);
      setQueueSeenAt(Date.now());
      if (
        !alreadyQueued &&
        !queuedAckRef.current &&
        current.title !== "已经睡了"
      ) {
        queuedAckRef.current = true;
        const holdingMessage: Message = {
          id: makeId("assistant-seen"),
          role: "assistant",
          text: emotionallyWithdrawn
            ? `我在。先让我缓一下，晚点再认真回你。`
            : `看到啦。我在${currentDisplayPlace}，忙完来找你。`,
          createdAt: Date.now(),
          worldTime: {
            day: liveState.day,
            hour: liveState.hour,
            minute: liveState.minute,
          },
          meta: {
            availability: currentAvailability,
            stance: "boundary",
            usedMemoryIds: [],
            activity: currentDisplayTitle,
          },
        };
        setMessages((items) => [...items, holdingMessage]);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setPending(false);
      setToast(
        current.title === "已经睡了"
          ? `${liveState.name}已经睡了。消息会留到${liveState.pronoun}醒来后主动回复。`
          : emotionallyWithdrawn
            ? `${liveState.pronoun}现在不想展开聊，消息会留到情绪缓下来。`
            : `${liveState.name}现在在${currentDisplayPlace}，空下来后会主动回你。`,
      );
      return;
    }

    await respondToBatch([userMessage], false);
  };

  useEffect(() => {
    if (
      !unansweredMessages.length ||
      !wantsToTalk ||
      pending ||
      autoReplyInFlight.current
    ) {
      return;
    }

    const batch = unansweredMessages;
    autoReplyInFlight.current = true;
    setUnansweredMessages([]);
    setPending(true);
    void respondToBatch(batch, true).finally(() => {
      autoReplyInFlight.current = false;
    });
  }, [
    unansweredMessages,
    wantsToTalk,
    pending,
    liveState.day,
    liveState.hour,
  ]);

  const toggleWorldClock = () => {
    const now = Date.now();
    setState((currentState) => {
      const instant = worldTimeAt(currentState.clock, now);
      return {
        ...currentState,
        ...instant,
        clock: {
          ...currentState.clock,
          paused: !currentState.clock.paused,
          anchorRealMs: now,
          anchorDay: instant.day,
          anchorHour: instant.hour,
          anchorMinute: instant.minute,
        },
      };
    });
    setNowMs(now);
  };

  const updateEmotion = (
    key: keyof CharacterState["emotions"],
    value: number,
  ) => {
    setState((currentState) => {
      const emotions = {
        ...currentState.emotions,
        [key]: value,
      };
      return {
        ...currentState,
        emotions,
        mood:
          key === "valence"
            ? Math.round(value)
            : currentState.mood,
        energy:
          key === "energy"
            ? Math.round(value)
            : currentState.energy,
        manualEmotionOverride: true,
      };
    });
  };

  const updateTrust = (value: number) => {
    setState((currentState) => ({
      ...currentState,
      trust: value,
    }));
  };

  const applyEmotionPreset = (
    preset: "steady" | "low" | "stress" | "quiet" | "angry",
  ) => {
    const values = {
      steady: { valence: 1, stress: 30, energy: 70, socialBattery: 70 },
      low: { valence: -2, stress: 48, energy: 38, socialBattery: 45 },
      stress: { valence: 0, stress: 88, energy: 42, socialBattery: 28 },
      quiet: { valence: 0, stress: 52, energy: 28, socialBattery: 12 },
      angry: { valence: -2, stress: 92, energy: 45, socialBattery: 35 },
    }[preset];

    setState((currentState) => ({
      ...currentState,
      emotions: values,
      mood: values.valence,
      energy: values.energy,
      manualEmotionOverride: true,
      userImpression:
        preset === "angry"
          ? {
              ...currentState.userImpression,
              currentRead: `${currentState.pronoun || "她"}觉得你刚才的话有点越界，暂时不想继续聊。`,
            }
          : currentState.userImpression,
    }));
    setToast("已应用到测试状态；事件暂时不会覆盖这组数值。");
  };

  const restoreEventEmotions = () => {
    setState((currentState) => ({
      ...currentState,
      manualEmotionOverride: false,
      lastEmotionEventId: undefined,
    }));
    setToast("已恢复事件驱动，下一次状态更新会按当前生活事件计算。");
  };

  const advanceTime = (hours: number) => {
    const now = Date.now();
    setState((currentState) => {
      const shifted = shiftWorldClock(currentState.clock, hours, now);
      const nextMoment = worldTimeAt(shifted.clock, now);
      const nextLiveState = { ...currentState, ...nextMoment };
      const nextEvent = currentEventFor(nextLiveState);
      return {
        ...nextLiveState,
        mood: nextEvent.mood,
        energy: Math.max(24, currentState.energy - Math.ceil(hours / 2)),
        clock: shifted.clock,
      };
    });
    setNowMs(now);
    setToast(
      `世界向前推进了。对话会读取${liveState.pronoun}新的当前状态。`,
    );
  };

  const removeMemory = (id: string) => {
    setMemories((items) => items.filter((item) => item.id !== id));
    setToast(
      `这条记忆已删除。${liveState.name}之后不会再主动提起。`,
    );
  };

  const resetDemo = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  if (!profile.onboarded) {
    return (
      <main className="setup-shell">
        <div className="setup-orbit setup-orbit-one" />
        <div className="setup-orbit setup-orbit-two" />
        <section className="setup-card">
          <div className="eyebrow">YŎU SHĒNG · PRIVATE DEMO</div>
          <div className="setup-mark">{selectedProfile.glyph}</div>
          <h1>
            {selectedProfile.pronoun}有自己的日子。
            <br />
            也会认真和你谈恋爱。
          </h1>
          <p className="setup-lede">
            你和{selectedProfile.name}已经确定恋爱关系，但才在一起不久。
            {selectedProfile.pronoun}会有自己的安排、情绪和判断，也会忙，会拒绝，会在第二天改变主意。恋爱不会让
            {selectedProfile.pronoun}变成随叫随到的人。
          </p>

          <div className="setup-trustline">
            <span>AI 模拟</span>
            <span>记忆可查看、删除</span>
            <span>18+</span>
          </div>
          <details className="setup-disclosure">
            <summary>
              体验前，请知道这几件事
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="setup-rules">
              <div>
                <span>01</span>
                <p>这是一段与 AI 的模拟关系，不是现实人类。</p>
              </div>
              <div>
                <span>02</span>
              <p>这段恋爱里的记忆可以查看、修改和删除，不会偷偷替你决定。</p>
              </div>
              <div>
                <span>03</span>
                <p>本 demo 仅面向 18 岁以上体验者。</p>
              </div>
            </div>
          </details>

          <div className="setup-fields">
            <div className="gender-picker">
              <span>选择你的恋人</span>
              <div className="gender-options">
                {(
                  [
                    ["female", "女性", "岚", "安静、慢热、有一点冷幽默"],
                    ["male", "男性", "川", "直率、稳重、偶尔有点闷"],
                  ] as const
                ).map(([value, label, glyph, description]) => (
                  <button
                    key={value}
                    className={setupGender === value ? "selected" : ""}
                    onClick={() => setSetupGender(value)}
                  >
                    <i>{glyph}</i>
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span>我该怎么称呼你</span>
              <input
                value={setupName}
                onChange={(event) => setSetupName(event.target.value)}
                placeholder="输入名字或昵称"
                maxLength={18}
              />
            </label>
            <div className="support-picker">
              <span>难受时，你更需要哪一种回应？</span>
              <div className="support-options">
                {[
                  ["listen", "先听我说"],
                  ["direct", "直接说问题"],
                  ["space", "给我一点空间"],
                ].map(([value, label]) => (
                  <button
                    className={setupStyle === value ? "selected" : ""}
                    key={value}
                    onClick={() =>
                      setSetupStyle(
                        value as UserProfile["supportStyle"],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="adult-check">
              <input
                type="checkbox"
                checked={adult}
                onChange={(event) => setAdult(event.target.checked)}
              />
              <span>我已年满 18 岁，并理解这是 AI 模拟体验。</span>
            </label>
          </div>

          <button
            className="primary-button setup-start"
            onClick={finishOnboarding}
            disabled={!adult || !setupName.trim()}
          >
            开始和{selectedProfile.name}恋爱
            <span>→</span>
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-seal">{activeProfile.glyph}</div>
          <div>
            <strong>有生</strong>
            <span>relationships with a life of their own</span>
          </div>
        </div>
        <div className="demo-badge">
          <i />
          {state.clock.paused
            ? "世界已暂停"
            : "世界正在继续"}
        </div>
        <div className="topbar-actions">
          {testMode && (
            <button
              className="text-button test-control-button"
              onClick={() => setShowEmotionPanel(true)}
            >
              <Settings2 size={16} aria-hidden="true" />
              测试调参
            </button>
          )}
          <button className="text-button reset-button" onClick={resetDemo}>
            <RotateCcw size={15} aria-hidden="true" />
            重新开始
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="profile-column">
          <section className="identity-card">
            <div className="portrait">
              <div className="portrait-sun" />
              <span>{activeProfile.glyph}</span>
            </div>
            <div className="identity-copy">
              <div className="identity-line">
                <h1>{liveState.name}</h1>
                <span>28</span>
              </div>
              <p>你的恋人 · {liveState.role}</p>
            </div>
            <div className="availability-pill">
              <i />
              {availabilityLabel(currentAvailability)}
            </div>
          </section>

          <section className="now-card">
            <div className="section-kicker">
              <span>此刻</span>
              <span>
                DAY {liveState.day} ·{" "}
                {timeLabel(liveState.hour, liveState.minute)}
              </span>
            </div>
            <h2>{currentDisplayTitle}</h2>
            <p>{currentDisplayDetail}</p>
            <div className="location-line">
              <MapPin size={14} aria-hidden="true" />
              {currentDisplayPlace}
            </div>
            {currentGoal && (
              <div className="goal-note">
                <span>正在推进</span>
                <strong>{currentGoal.label}</strong>
                <div className="progress-track">
                  <i style={{ width: `${currentGoal.progress}%` }} />
                </div>
              </div>
            )}
          </section>

          <details className="inner-card" open={testMode || undefined}>
            <summary className="state-toggle">
              <span>她现在怎么样</span>
              <strong>{emotionSummary(liveState)}</strong>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="state-details">
              <div className="state-grid">
                <div>
                  <span>心情</span>
                  <strong>
                    {moodLabel(liveState.emotions.valence)}
                  </strong>
                </div>
                <div>
                  <span>压力</span>
                  <strong>{liveState.emotions.stress}%</strong>
                </div>
                <div>
                  <span>精力</span>
                  <strong>{liveState.emotions.energy}%</strong>
                </div>
                <div>
                  <span>社交电量</span>
                  <strong>{liveState.emotions.socialBattery}%</strong>
                </div>
              </div>
              <p className="emotion-summary">
                {emotionSummary(liveState)}
              </p>
              <p className="trust-summary">
                与你的关系：{trustLabel(liveState.trust)} ·{" "}
                {Math.round(liveState.trust)}/100
              </p>
              <div className="judgment-summary">
                <span>{activeProfile.pronoun}怎么看你</span>
                <p>{liveState.userImpression.currentRead}</p>
                <div>
                  <small>好感 {liveState.userImpression.warmth}</small>
                  <small>尊重 {liveState.userImpression.respect}</small>
                  <small>
                    可预测 {liveState.userImpression.predictability}
                  </small>
                </div>
              </div>
            </div>
          </details>

          {testMode && (
            <>
              <div className="time-actions">
                <button onClick={toggleWorldClock}>
                  {state.clock.paused ? "继续世界" : "暂停世界"}
                </button>
                <button onClick={() => advanceTime(1)}>测试：+1 小时</button>
                <button onClick={() => advanceTime(8)}>测试：+8 小时</button>
              </div>
              <p className="fine-print">
                测试模式：现实一分钟，{activeProfile.pronoun}
                的世界也过一分钟。时间按钮仅用于验证延迟回复和情绪变化。
              </p>
            </>
          )}
        </aside>

        <section className="main-column">
          <nav className="tabbar" aria-label="主要导航">
            <button
              className={tab === "chat" ? "active" : ""}
              onClick={() => setTab("chat")}
            >
              <span>对话</span>
              <small>现在</small>
            </button>
            <button
              className={tab === "life" ? "active" : ""}
              onClick={() => setTab("life")}
            >
              <span>{activeProfile.pronoun}的人生</span>
              <small>
                {state.biography.length} 段过去 · {state.decisions.filter(
                  (decision) => decision.status === "open",
                ).length}{" "}
                个选择
              </small>
            </button>
            <button
              className={tab === "memory" ? "active" : ""}
              onClick={() => setTab("memory")}
            >
              <span>共同记忆</span>
              <small>{memories.length} 条</small>
            </button>
          </nav>

          {tab === "chat" && (
            <section className="chat-panel panel-enter">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    <span>和{liveState.name}说话</span>
                    <span>不是随时在线，但会认真看</span>
                  </div>
                  <h2>
                    {current.title === "已经睡了"
                      ? "她已经睡了，消息明早再看。"
                      : currentAvailability === "free"
                        ? "刚好赶上她的一段空闲。"
                        : "她手头有事，但会看见你的话。"}
                  </h2>
                </div>
                <div className="today-chip">
                  <span>
                    {timeLabel(liveState.hour, liveState.minute)}
                  </span>
                  <strong>{currentDisplayTitle}</strong>
                </div>
              </div>

              <div className="prompt-ribbon">
                <span>试一句</span>
                {[
                  "你今天在忙什么？",
                  "刚下班，有点累",
                  "你还记得我希望你怎么回应吗？",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>

              {unansweredMessages.length > 0 && (
                <div className="delivery-queue">
                  <span>
                    {unansweredMessages.length} 条消息留给她
                  </span>
                  {current.title === "已经睡了"
                    ? `她已经睡了，明早会主动看消息，不用再问一次。`
                    : `她现在在${currentDisplayPlace}，忙完会主动回你，不用再问一次。`}
                  <small className="delivery-seen">
                    <i />
                    {current.title === "已经睡了"
                      ? "她睡着时不会自动回复"
                      : nowMs - queueSeenAt < 15_000
                        ? "她刚抽空看了一眼"
                        : `她 ${Math.max(
                            1,
                            Math.ceil((nowMs - queueSeenAt) / 60_000),
                          )} 分钟前抽空看了一眼`}
                  </small>
                </div>
              )}

              <div className="message-list" ref={messageListRef}>
                {messages.some((message) => !message.worldTime) && (
                  <div className="history-note">
                    这些消息来自旧版本，尚未记录世界时间。新的对话会明确标注
                    {liveState.name}当时所处的时间。
                  </div>
                )}
                {messages.map((message) => (
                  <article
                    className={`message-row ${message.role}`}
                    key={message.id}
                  >
                    {message.role === "assistant" && (
                      <div className="mini-avatar">{activeProfile.glyph}</div>
                    )}
                    <div className="message-content">
                      <div className="message-bubble">{message.text}</div>
                      {message.worldTime && (
                        <div className="message-world-time">
                          D{message.worldTime.day} ·{" "}
                          {timeLabel(
                            message.worldTime.hour,
                            message.worldTime.minute,
                          )}
                        </div>
                      )}
                      {message.role === "assistant" && message.meta && (
                        <div className="message-meta">
                          <button
                            onClick={() =>
                              setShowContext(
                                showContext === message.id
                                  ? null
                                  : message.id,
                              )
                            }
                          >
                            为什么这么说
                          </button>
                        </div>
                      )}
                      {showContext === message.id &&
                        message.role === "assistant" &&
                        message.meta && (
                          <div className="context-card">
                            <div>
                              <span>当时在做什么</span>
                              <strong>{message.meta.activity}</strong>
                            </div>
                            <div>
                              <span>调用了哪些记忆</span>
                              <strong>
                                {message.meta.usedMemoryIds.length
                                  ? `${message.meta.usedMemoryIds.length} 条`
                                  : "没有足够确定的记忆"}
                              </strong>
                            </div>
                            <div>
                              <span>{activeProfile.pronoun}的回应策略</span>
                              <strong>
                                {stanceLabel(message.meta.stance)}
                              </strong>
                            </div>
                          </div>
                        )}
                    </div>
                  </article>
                ))}

                {pending && (
                  <article className="message-row assistant">
                    <div className="mini-avatar">{activeProfile.glyph}</div>
                    <div className="message-content">
                      <div className="message-bubble typing">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </article>
                )}
              </div>

              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`说点什么，或者告诉${activeProfile.pronoun}一件事……`}
                  aria-label="输入消息"
                />
                <button
                  type="submit"
                  aria-label="发送消息"
                  disabled={!draft.trim()}
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
              </form>
              <div className="composer-note">
                <span>
                  AI 模拟
                  {testMode && modelStatus.configured
                    ? ` · ${modelStatus.provider} / ${modelStatus.model}`
                    : ""}
                </span>
                <span>
                  {unansweredMessages.length
                    ? `${unansweredMessages.length} 条消息等${activeProfile.pronoun}忙完`
                    : "她会按自己的生活节奏回复"}
                </span>
              </div>
            </section>
          )}

          {tab === "life" && (
            <section className="life-panel panel-enter">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    <span>{activeProfile.pronoun}的人生</span>
                    <span>过去先于聊天存在</span>
                  </div>
                  <h2>{activeProfile.pronoun}不是从认识你那天才出生。</h2>
                </div>
                <div className="week-stamp">
                  <strong>07</strong>
                  <span>天生活轨迹</span>
                </div>
              </div>

              <section className="biography-section">
                <div className="life-section-title">
                  <span>人生底稿</span>
                  <strong>现居 {state.currentCity}</strong>
                </div>
                <div className="biography-track">
                  {state.biography.map((chapter, index) => (
                    <details
                      className="biography-card"
                      key={chapter.id}
                      open={index === state.biography.length - 1}
                    >
                      <summary>
                        <div className="biography-meta">
                          <span>{chapter.years}</span>
                          <span>{chapter.age}</span>
                        </div>
                        <h3>{chapter.title}</h3>
                        <strong>{chapter.place}</strong>
                        <ChevronDown
                          className="biography-chevron"
                          size={16}
                          aria-hidden="true"
                        />
                      </summary>
                      <p>{chapter.summary}</p>
                      <small>{chapter.impact}</small>
                    </details>
                  ))}
                </div>
              </section>

              <section className="decision-section">
                <div className="life-section-title">
                  <span>正在形成的选择</span>
                  <strong>
                    关系信任 {trustLabel(state.trust)} ·{" "}
                    {Math.round(state.trust)}/100
                  </strong>
                </div>
                <p className="decision-help">
                  在聊天里直接给{activeProfile.pronoun}建议。关系信任达到门槛后，你的意见可以改变选择和后续生活。
                </p>
                <div className="decision-list">
                  {state.decisions.map((decision) => {
                    const chosen = decision.options.find(
                      (option) => option.id === decision.chosenOptionId,
                    );
                    return (
                      <article
                        className={`decision-card ${decision.status}`}
                        key={decision.id}
                      >
                        <div className="decision-topline">
                          <span>
                            {decision.status === "decided"
                              ? decision.influencedByUser
                                ? "因你而改变"
                                : "已经决定"
                              : `第 ${decision.deadlineDay} 天前决定`}
                          </span>
                          <strong>
                            门槛 {decision.trustRequired}
                          </strong>
                        </div>
                        <h3>{decision.title}</h3>
                        <p className="decision-question">
                          {decision.question}
                        </p>
                        <p>{decision.context}</p>
                        <div className="decision-options">
                          {decision.options.map((option) => (
                            <span
                              className={
                                option.id === decision.chosenOptionId
                                  ? "chosen"
                                  : ""
                              }
                              key={option.id}
                            >
                              {option.label}
                            </span>
                          ))}
                        </div>
                        {decision.adviceSummary && (
                          <div className="decision-advice">
                            <span>你的建议</span>
                            {decision.adviceSummary}
                          </div>
                        )}
                        {decision.status === "decided" && chosen && (
                          <div className="decision-result">
                            <span>{activeProfile.pronoun}的选择</span>
                            {chosen.label}
                            {decision.influencedByUser
                              ? "，这次选择受到了你的影响。"
                              : "。"}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="goal-row">
                {state.goals.map((goal) => (
                  <div className="goal-card" key={goal.id}>
                    <span>{goal.label}</span>
                    <div>
                      <i style={{ width: `${goal.progress}%` }} />
                    </div>
                    <strong>{goal.progress}%</strong>
                  </div>
                ))}
              </div>

              <div className="timeline">
                {state.events.map((item) => (
                  <article
                    className={`timeline-item ${
                      item.id === current.id && isCurrentEventActive
                        ? "current"
                        : ""
                    }`}
                    key={item.id}
                  >
                    <div className="timeline-time">
                      <span>D{item.day}</span>
                      <strong>{timeLabel(item.startHour)}</strong>
                    </div>
                    <div className="timeline-dot">
                      <i />
                    </div>
                    <div className="timeline-card">
                      <div className="event-topline">
                        <span>{item.place}</span>
                        {item.id === current.id && isCurrentEventActive && (
                          <b>此刻</b>
                        )}
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                      <div className="cause">
                        <span>为什么发生</span>
                        {item.cause}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "memory" && (
            <section className="memory-panel panel-enter">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    <span>共同记忆</span>
                    <span>不是黑箱</span>
                  </div>
                  <h2>被记住，也可以被忘记。</h2>
                </div>
                <div className="week-stamp">
                  <strong>{memories.length}</strong>
                  <span>条正在生效</span>
                </div>
              </div>

              <div className="memory-principle">
                <div className="memory-glyph">记</div>
                <div>
                  <strong>记忆不是越像你越好。</strong>
                  <p>
                    {liveState.name}只保留能让关系更准确、更安全的内容。你删除一条记忆后，
                    {activeProfile.pronoun}不会把它换一种说法继续使用。
                  </p>
                </div>
              </div>

              <div className="memory-list">
                {memories.length ? (
                  memories.map((memory, index) => (
                    <article className="memory-card" key={memory.id}>
                      <div className="memory-number">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="memory-body">
                        <span>
                          {memory.kind === "boundary"
                            ? "沟通边界"
                            : memory.kind === "relationship"
                              ? "关系记忆"
                              : "关于你"}
                        </span>
                        <p>{memory.text}</p>
                        <small>
                          来源：
                          {memory.source === "onboarding"
                            ? "初次见面"
                            : "对话中主动记录"}
                        </small>
                      </div>
                      <button
                        className="delete-memory"
                        aria-label={`删除记忆：${memory.text}`}
                        onClick={() => removeMemory(memory.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        <span>删除</span>
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-memory">
                    <strong>现在没有正在生效的记忆。</strong>
                    <p>下一次对话会从你此刻说的话重新开始。</p>
                  </div>
                )}
              </div>

              <div className="memory-add-note">
                <span>记忆规则</span>
                <p>
                  在对话里说“记住……”或“我最近……”，下一条消息后会出现一条可删除的记忆。
                </p>
              </div>
            </section>
          )}
        </section>
      </main>

      <nav className="mobile-nav" aria-label="移动端导航">
        {[
          { value: "chat" as Tab, label: "对话", Icon: MessageCircle },
          { value: "life" as Tab, label: "人生", Icon: BookOpen },
          { value: "memory" as Tab, label: "记忆", Icon: NotebookText },
        ].map(({ value, label, Icon }) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            <span>
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {showEmotionPanel && (
        <div
          className="emotion-overlay"
          role="presentation"
          onClick={() => setShowEmotionPanel(false)}
        >
          <section
            className="emotion-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emotion-panel-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="emotion-panel-head">
              <div>
                <div className="section-kicker">
                  <span>TEST CONTROL</span>
                  <span>
                    {state.manualEmotionOverride
                      ? "手动接管中"
                      : "事件驱动中"}
                  </span>
                </div>
                <h2 id="emotion-panel-title">
                  调整{activeProfile.pronoun}此刻的状态
                </h2>
              </div>
              <button
                className="panel-close"
                aria-label="关闭测试调参"
                onClick={() => setShowEmotionPanel(false)}
              >
                ×
              </button>
            </div>

            <p className="emotion-panel-note">
              拖动后会让事件暂时停止覆盖情绪，便于稳定测试回复风格、主动性和延迟回复。当前判断为：
              <strong>
                {availabilityLabel(currentAvailability)}
              </strong>
              。
            </p>
            <div className="judgment-panel-read">
              <span>{activeProfile.pronoun}目前怎么看你</span>
              <strong>{liveState.userImpression.currentRead}</strong>
            </div>

            <div className="emotion-controls">
              {(
                [
                  [
                    "valence",
                    "心情",
                    -3,
                    3,
                    moodLabel(liveState.emotions.valence),
                  ],
                  [
                    "stress",
                    "压力",
                    0,
                    100,
                    `${liveState.emotions.stress}%`,
                  ],
                  [
                    "energy",
                    "精力",
                    0,
                    100,
                    `${liveState.emotions.energy}%`,
                  ],
                  [
                    "socialBattery",
                    "社交电量",
                    0,
                    100,
                    `${liveState.emotions.socialBattery}%`,
                  ],
                ] as const
              ).map(([key, label, min, max, valueLabel]) => (
                <label className="emotion-slider" key={key}>
                  <span>
                    {label}
                    <strong>{valueLabel}</strong>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={liveState.emotions[key]}
                    onChange={(event) =>
                      updateEmotion(key, Number(event.target.value))
                    }
                    aria-label={label}
                  />
                </label>
              ))}
              <label className="emotion-slider trust-slider">
                <span>
                  关系信任
                  <strong>
                    {trustLabel(liveState.trust)} ·{" "}
                    {Math.round(liveState.trust)}%
                  </strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(liveState.trust)}
                  onChange={(event) =>
                    updateTrust(Number(event.target.value))
                  }
                  aria-label="关系信任"
                />
              </label>
            </div>

            <div className="emotion-presets">
              <span>快速状态</span>
              <button onClick={() => applyEmotionPreset("steady")}>
                平稳
              </button>
              <button onClick={() => applyEmotionPreset("low")}>
                低落
              </button>
              <button onClick={() => applyEmotionPreset("stress")}>
                高压力
              </button>
              <button onClick={() => applyEmotionPreset("quiet")}>
                低电量
              </button>
              <button onClick={() => applyEmotionPreset("angry")}>
                有点生气
              </button>
              <button onClick={() => updateTrust(80)}>
                信任加深
              </button>
            </div>

            <div className="emotion-panel-footer">
              <div>
                <span>回复倾向</span>
                <strong>{emotionSummary(liveState)}</strong>
              </div>
              <button
                className="restore-emotions"
                onClick={restoreEventEmotions}
                disabled={!state.manualEmotionOverride}
              >
                恢复事件驱动
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
