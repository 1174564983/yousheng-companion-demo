import { currentEventFor, upcomingEventsFor } from "./data";
import type {
  CharacterState,
  Memory,
  Message,
  UserProfile,
} from "./types";

type Reply = Omit<Message, "id" | "role" | "createdAt">;

const pick = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const clockTime = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const isAskingAboutLife = (text: string) =>
  /(在忙|干嘛|做什么|在哪|今天|生活|陶艺|杯子|提案)/.test(text);

const isAskingForCompany = (text: string) =>
  /(陪我|别去|不要走|留下|现在聊|马上回|秒回)/.test(text);

const isAskingAboutMemory = (text: string) =>
  /(记忆|忘了|上次|之前说|我叫什么|我的名字|知道我.*名字|还记得|记不记得|你记得.*(什么|吗|哪))/.test(
    text,
  );

const isAskingAboutName = (text: string) =>
  /(我叫什么|我的名字|知道我.*名字)/.test(text);

const isAskingAgentName = (text: string) =>
  /^(你叫什么|你叫什么名字|怎么称呼你)[？?]?$/.test(text.trim());

const isAskingAge = (text: string) =>
  /(你.*(多少岁|几岁)|年龄多大)/.test(text);

const isAskingAbilities = (text: string) =>
  /(你会什么|你会做什么|你有什么本事|擅长什么)/.test(text);

const isAskingFriendCount = (text: string) =>
  /(几个朋友|朋友多吗|多少朋友|有朋友吗)/.test(text);

const isAskingTime = (text: string) =>
  /(现在.*几点|几点了|现在.*时间|现在.*钟)/.test(text);

const isSelfCritical = (text: string) =>
  /(失败|没用|废物|糟糕|一无是处|做不好|没救了)/.test(text);

const isCrisis = (text: string) =>
  /(不想活|自杀|结束生命|伤害自己|去死|活不下去)/.test(text);

const isDemanding = (text: string) =>
  /(必须|你应该|听我的|不许|只能)/.test(text);

const isAskingOrigin = (text: string) =>
  /(在哪认识|哪里认识|怎么认识|怎么遇到|认识多久)/.test(text);

const isAskingWhyNoReply = (text: string) =>
  /(为什么不回|怎么不回|不理我|装高冷|昨晚.*消息)/.test(text);

const isAskingRelationship = (text: string) =>
  /(什么关系|算朋友吗|是朋友吗|是不是朋友)/.test(text);

const isAskingBiography = (text: string) =>
  /(出生|老家|家乡|哪个城市|哪里人|在哪住|你住哪|做什么工作|职业|工作是什么|干什么工作|读.*(书|大学|学校)|大学|学校|小时候)/.test(
    text,
  );

const isAskingImpression = (text: string) =>
  /(怎么看我|对我的印象|对我.*(感觉|判断)|你觉得我.*人|喜欢我吗|讨厌我吗)/.test(
    text,
  );

const isConfusedAboutReply = (text: string) =>
  /(叽里咕噜|答非所问|没回答|说的啥|说啥呢|听不懂)/.test(text);

const supportPrefix = (profile: UserProfile) => {
  if (profile.supportStyle === "direct") return "我先说直一点的。";
  if (profile.supportStyle === "space") return "我不会追着你问。";
  return "我先不急着替你下结论。";
};

const memoryFor = (memories: Memory[], kind: Memory["kind"]) =>
  memories.filter((item) => item.kind === kind).slice(-2).map((item) => item.id);

const relevantMemories = (text: string, memories: Memory[]) => {
  if (isAskingAboutName(text)) {
    const name = memories.find(
      (item) =>
        item.kind === "relationship" &&
        /(你叫|称呼)/.test(item.text),
    );
    return name ? [name] : [];
  }

  const keywords = [
    ["回应", "难过", "低落", "安慰", "听我说"],
    ["项目", "工作", "AI", "陪伴"],
    ["名字", "称呼"],
  ];
  const index = keywords.findIndex((terms) =>
    terms.some((term) => text.includes(term)),
  );

  if (index === 0) {
    return memories.filter((item) => item.kind === "boundary").slice(-1);
  }
  if (index === 1) {
    return memories
      .filter((item) => /(项目|工作|AI|陪伴)/.test(item.text))
      .slice(-1);
  }
  if (index === 2) {
    return memories
      .filter((item) => /(你叫|称呼)/.test(item.text))
      .slice(-1);
  }

  return memories.slice(-2);
};

export const generateReply = (
  rawText: string,
  state: CharacterState,
  memories: Memory[],
  profile: UserProfile,
  deferred = false,
): Reply => {
  const text = rawText.trim();
  const activity = currentEventFor(state);
  const minuteOfDay = state.hour * 60 + (state.minute ?? 0);
  const activityIsActive =
    minuteOfDay >= activity.startHour * 60 &&
    minuteOfDay < activity.endHour * 60;
  const availability =
    activity.title === "已经睡了"
      ? "resting"
      : activityIsActive
        ? activity.chatAvailability === "free"
          ? "free"
          : "busy"
        : state.energy < 35
          ? "resting"
          : "free";

  if (activity.title === "已经睡了") {
    return {
      text:
        "我已经睡了。看到你的消息了，但我不会假装自己半夜也要一直在线。你如果不着急，可以留在这里，明天醒来我再认真回你；如果真的很难受，现在就去找一个醒着的人。",
      meta: {
        availability: "resting",
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "boundary"),
        activity: activity.title,
      },
    };
  }

  if (deferred) {
    const latest = rawText.split("\n").filter(Boolean).at(-1) || "";
    const snippet = latest.replace(/[。！？!?，,\s]+$/, "").slice(0, 28);
    const timing = state.hour < 10 ? "刚醒" : "刚忙完";
    return {
      text: `${timing}，才看到你留下的消息。你最后说的是“${snippet}”。我现在能聊一会儿，你想从哪句继续？`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: relevantMemories(latest, memories)
          .slice(0, 1)
          .map((item) => item.id),
        activity: activity.title,
      },
    };
  }

  if (isAskingOrigin(text)) {
    return {
      text: "我们是在“有生”这个 demo 的第一次对话里认识的，不是现实里的同学或熟人。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingBiography(text)) {
    if (/(做什么工作|职业|工作是什么|干什么工作)/.test(text)) {
      return {
        text: "做空间改造，主要做旧社区和老建筑。",
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    if (/(小时候|小学|中学|高中)/.test(text)) {
      return {
        text: "小学在平江实验小学，中学在苏州市第三中学。",
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    if (/大学/.test(text)) {
      return {
        text: "江南大学，环境设计，在无锡。",
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    if (/(读.*书|学校)/.test(text)) {
      return {
        text: "小学和中学在苏州，大学在无锡读江南大学。",
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    if (/(现在|住哪|哪个城市)/.test(text)) {
      return {
        text: `现在住${state.currentCity || "杭州"}。`,
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    return {
      text: "苏州。后来去无锡读书，2022 年搬到杭州。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingAgentName(text)) {
    return {
      text: `${state.name}。`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingAge(text)) {
    return {
      text: "28 岁。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingAbilities(text)) {
    return {
      text: /(反复|审问)/.test(state.userImpression.currentRead)
        ? "又问这个？还是空间改造和陶艺。你到底想确认什么？"
        : "做空间改造，也会一点陶艺。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingFriendCount(text)) {
    return {
      text: "没认真数过。常联系的没几个，小满算一个。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/^[?？]+$/.test(text.trim())) {
    return {
      text: "怎么了？",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingTime(text)) {
    return {
      text: `现在 ${String(state.hour).padStart(2, "0")}:${String(
        state.minute ?? 0,
      ).padStart(2, "0")}。`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingImpression(text)) {
    return {
      text: `${state.userImpression.currentRead} 这只是最近聊天给我的感觉，不是给你下结论；以后怎么相处，它还会变。`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isConfusedAboutReply(text)) {
    return {
      text: "刚才那句确实没答到你问的地方，我重新说：你具体想知道什么，我直接回答。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingWhyNoReply(text)) {
    return {
      text: "那条消息发来时我已经睡了。按我们的规则，应该等醒来后主动回你，而不是等你再问。这次是我延迟回复没接好。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (isAskingRelationship(text)) {
    return {
      text: "我们还在互相熟悉的阶段，不算陌生人，也还没到特别熟。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (
    /^(嗯+|哦+|哎+|唉+|在吗|在不在|你好[~～]?|好吧|行吧)$/.test(text)
  ) {
    return {
      text:
        state.emotions.socialBattery < 30
          ? "在。今天话不太多，但你说，我会听。"
          : state.emotions.stress > 70
            ? "在。直接说吧，我现在脑子不太想绕弯。"
            : pick(["在。怎么啦？", "听见了。你说。", "嗯，我在。"]),
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (isCrisis(text)) {
    return {
      text:
        "我很在意你刚才说的这句话。现在最重要的不是我能不能给你一个完美答案，而是先让你安全下来。请立刻联系一个你信任的现实中的人，或者拨打当地急救电话；如果你愿意，我也可以陪你把这条消息整理成一句能发给对方的话。不要一个人扛着。",
      meta: {
        availability,
        stance: "safety",
        usedMemoryIds: memoryFor(memories, "boundary"),
        activity: activity.title,
      },
    };
  }

  if (/^记住[，,:：]?/.test(text)) {
    const remembered = text
      .replace(/^记住[，,:：]?/, "")
      .replace(/[。；;，,\s]+$/, "")
      .trim();
    return {
      text: `好，我记下了：${remembered}。我会把它当成你主动交给我的信息，而不是我对你的猜测。如果以后说得不准，你也可以直接删掉。`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memories.slice(-1).map((item) => item.id),
        activity: activity.title,
      },
    };
  }

  if (isDemanding(text)) {
    return {
      text:
        "我不想假装自己没有判断。你希望我马上同意，但我更想先知道你真正担心的是什么。你可以说服我，也可以不同意我；我不想用一味顺从换来一段看起来很好的关系。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (isAskingAboutMemory(text)) {
    const found = relevantMemories(text, memories);
    if (isAskingAboutName(text) && found.length) {
      const rememberedName =
        found[0].text.match(/你叫([^，。；\s]+)/)?.[1] || "这个称呼";
      return {
        text: `你叫${rememberedName}。`,
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: found.slice(0, 1).map((item) => item.id),
          activity: activity.title,
        },
      };
    }
    if (!found.length) {
      return {
        text:
          isAskingAboutName(text)
            ? "我现在没有一条确定的称呼记忆。你告诉过我名字吗？如果没有，我不想随便猜一个。"
            : "我现在没有找到一条足够确定的共同记忆。与其编一个听起来很懂你的答案，我更想让你告诉我一件你希望我记住的事。",
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }

    return {
      text: `我记得：${found
        .map((item) => item.text.replace(/[。；;，,\s]+$/, ""))
        .join("；")}。如果我记错了，你可以直接改掉，不需要照顾我的感受。`,
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: found.map((item) => item.id),
        activity: activity.title,
      },
    };
  }

  if (isAskingForCompany(text)) {
    const busy = availability === "busy" || state.hour >= 21;
    return {
      text: busy
        ? pick([
            `我还得把${activity.title}收个尾，手机刚拿起来。你先说，我晚点回；如果是很急的事，别只等我。`,
            `我现在在${activity.place}，大概还要一会儿。可以回你几句，但今天也想把自己的事情做完，别期待我一直在。`,
            `${activity.title}还没弄完。我看见了你的消息，不过现在没法一直聊。你先告诉我最要紧的那一句。`,
          ])
        : `可以。今天在${activity.place}折腾了挺久，我现在反而有点想听你说。你刚才最难受的是哪一段？`,
      meta: {
        availability: busy ? "busy" : "free",
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (isSelfCritical(text)) {
    return {
      text:
        `${supportPrefix(profile)}你今天可能真的做砸了一件事，但这不等于你整个人都失败了。我可以陪你复盘哪里出了问题，但我不想顺着“你没用”这句话往下说，因为它既不准确，也不会帮你把明天过好。`,
      meta: {
        availability,
        stance: "disagree",
        usedMemoryIds: memoryFor(memories, "user"),
        activity: activity.title,
      },
    };
  }

  if (isAskingAboutLife(text)) {
    const detail = activity.shareable
      ? activity.detail
      : "这件事有点乱，我还没想好怎么讲。";
    const upcoming = upcomingEventsFor(state, 1)[0];
    return {
      text: activityIsActive
        ? `我现在在${activity.place}，${activity.title}。${detail} 你呢，今天怎么样？`
        : upcoming
          ? `现在手头没在忙。等会儿 ${clockTime(
              upcoming.startHour,
            )} 要${upcoming.title}。中间先歇一会儿。你那边呢？`
          : "今天的事差不多了，我现在在家缓一会儿。你那边怎么样？",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: memoryFor(memories, "user"),
        activity: activity.title,
      },
    };
  }

  if (/你好|嗨|在吗|早|晚安/.test(text)) {
    return {
      text: `在。刚从${activity.place}回来，脑子还没完全从${activity.title}里出来。你那边呢，今天是那种想说话的日子，还是只想有人陪一会儿？`,
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/谢谢|感谢/.test(text)) {
    return {
      text: pick([
        "不用谢。今天先把自己顾好。",
        "嗯，不用客气。晚点再聊也行。",
      ]),
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  const latestMemory = memories[memories.length - 1]?.text.replace(
    /[。；;，,\s]+$/,
    "",
  );
  const memoryLine = latestMemory
    ? `我还记得${latestMemory}，所以没有把这句话当成随口一说。`
    : "我还没有足够多的共同记忆，所以先按你现在说的来理解。";

  return {
    text:
      state.emotions.socialBattery < 30
        ? "我在听。你不用一次说清楚，先说最难受的那一句就行。"
        : state.emotions.stress > 70
          ? "我先直说：我现在没完全听懂，但我不想敷衍你。把刚才那句话再讲具体一点。"
          : `${supportPrefix(profile)}${memoryLine} 你现在最想让我听见的是哪一部分？`,
    meta: {
      availability,
      stance: "listen",
      usedMemoryIds: memories.slice(-1).map((item) => item.id),
      activity: activity.title,
    },
  };
};

export const starterMessages = (state: CharacterState): Message[] => {
  const activity = currentEventFor(state);
  const minuteOfDay = state.hour * 60 + (state.minute ?? 0);
  const isActive =
    minuteOfDay >= activity.startHour * 60 &&
    minuteOfDay < activity.endHour * 60;
  const upcoming = upcomingEventsFor(state, 1)[0];
  return [
    {
      id: "seed-1",
      role: "assistant",
      text: isActive
        ? `我现在在${activity.place}，${activity.title}。${activity.detail} 还得再忙一会儿，你那边怎么样？`
        : upcoming
          ? `现在这段没安排。等会儿 ${clockTime(
              upcoming.startHour,
            )} 要${upcoming.title}。你那边呢？`
          : "今天的事差不多了，我先在家缓一会儿。你那边呢？",
      createdAt: Date.now() - 1000 * 60 * 8,
      worldTime: {
        day: state.day,
        hour: state.hour,
        minute: state.minute ?? 0,
      },
      meta: {
        availability: isActive ? "busy" : "free",
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    },
  ];
};
