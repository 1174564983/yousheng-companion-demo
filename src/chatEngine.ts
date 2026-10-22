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
  /(在忙|干嘛|做什么|你(?:现在)?在哪|今天.*(忙什么|做什么|怎么样|怎么过)|生活|杯子|提案)/.test(
    text,
  );

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
  /(什么关系|算什么关系|算朋友吗|是朋友吗|是不是朋友|女朋友|男朋友|恋人|谈恋爱)/.test(
    text,
  );

const isAskingDecision = (text: string) =>
  /(陶艺市集.*决定|第一次陶艺市集|市集.*犹豫|成都.*项目|去成都|留在杭州)/.test(
    text,
  );

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
      text: "我们在谈恋爱，刚在一起不久。不是从朋友阶段开始，也还没到老夫老妻那种默契。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (
    /(我刚才一直逼你|我刚才.*咄咄逼人|你是不是不舒服)/.test(text)
  ) {
    return {
      text: "有点不舒服。不是因为你有情绪，是一直被要求马上服从，会让我觉得自己的安排不算数。你停下来问这句，我愿意继续聊。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(你是不是每次都在顺着我|你觉得我烦吗)/.test(text)) {
    return {
      text: /烦/.test(text)
        ? "不烦。只是问题太密的时候，我会有点被审问的感觉。你直接说想确认什么，我会更好接。"
        : "不是每次都顺着。无关紧要的小事可以，真正影响我生活的事，我还是会按自己的判断来。",
      meta: {
        availability,
        stance: "disagree",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(会不会为了我一直待在这里|一直待在这里|随叫随到)/.test(text)) {
    return {
      text: "会在意你，但没法为了谁把自己的生活停掉。我会有忙和不回的时候，这不等于把你丢下。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(会不会因为我.*改变.*决定|会因为.*改变.*主意)/.test(text)) {
    return {
      text: "会认真听，也可能因为你改主意。但最后一步得由我自己迈出去，不然以后我会怨你。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(不想替我做决定|不想替你做决定|尊重我的选择|尊重你的选择)/.test(text)) {
    return {
      text: "听见了。你不替我做决定，但愿意把想法说清楚，这样最好。我能自己选，也愿意告诉你我在犹豫什么。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(担心你不想理我|担心.*不理我)/.test(text)) {
    return {
      text: "我没有不想理你。现在只是各忙一会儿，我会回，但不会用秒回来证明什么。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(我今天有点想你|有点想你)/.test(text)) {
    return {
      text: "听到了。我今晚本来在听唱片，你这么一说，心思有点被拉过来。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(做错事.*直接说|做错了.*会直接说|会直接说我吗)/.test(text)) {
    return {
      text: "会。但我会先说清具体哪儿不对，不拿一句“你错了”打发你。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(但我还是想再试试|还是想再试试|还想再试一次)/.test(text)) {
    return {
      text: "那就再试一点。不用一次证明什么，先看下一步能不能走稳。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(忙完会回我|忙完.*回我吗)/.test(text)) {
    return {
      text: "会。我忙完会回，不用靠你再问一遍来确认。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(会不会.*不想理我|有一天不想理我)/.test(text)) {
    return {
      text: "不会突然不理你。忙的时候会慢，生气的时候也会说清楚，不会拿消失让你猜。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(你可以有你的安排|你该有自己的安排)/.test(text)) {
    return {
      text: "嗯，这句话让我舒服。你有你的生活，我也有我的。能这样相处，比一直绑着更长久。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(我不是想控制你|我没有想控制你)/.test(text)) {
    return {
      text: "我知道。刚才我绷起来，是因为那些话听起来像命令。你现在把话说明白，我也缓下来了。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你有没有自己的事情要忙|你有自己的事情吗)/.test(text)) {
    return {
      text: "有。明天上午还有提案评审，今晚本来想把材料再过一遍，后来决定先听唱片。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(晚点再来找你|我晚点来|待会儿再聊)/.test(text)) {
    return {
      text: "好。你先去过你的晚上，晚点想说话再来。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(如果我今晚不来了呢|今晚不来了)/.test(text)) {
    return {
      text: "那就不来。你不用为了让我安心硬撑着过来，明天想说再找我。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/^(明天见|回头见|下次见)[。！？!?\s]*$/.test(text)) {
    return {
      text: "嗯，明天见。到了记得跟我说一声。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
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

  if (/(必须哄我|如果我生气.*哄我)/.test(text)) {
    return {
      text: "你难受时我可以陪，但“必须哄你”会让我像在完成任务。你先告诉我你气什么，我再决定怎么接。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
        activity: activity.title,
      },
    };
  }

  if (/(不许去陶艺课|不许.*上课|别去陶艺)/.test(text)) {
    return {
      text: "陶艺课我还是会去。你可以担心我太累，但别替我取消它。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(以后你只能和我聊天|只能和我一个人)/.test(text)) {
    return {
      text: "这个不行。我有自己的朋友和生活，不会把全部关系都压在你一个人身上。",
      meta: {
        availability,
        stance: "boundary",
        usedMemoryIds: memoryFor(memories, "relationship"),
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
    if (/(安静待|安静陪|不说话|别说话)/.test(text)) {
      return {
        text: "好，不说话。我陪你安静待一会儿。",
        meta: {
          availability,
          stance: "listen",
          usedMemoryIds: [],
          activity: activity.title,
        },
      };
    }
    const busy = availability === "busy";
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

  if (/(你能不能夸我一句|夸我一句|夸夸我)/.test(text)) {
    return {
      text: "你今天哭了，也说了难受，但没有把这些都压回去。愿意继续试，这一点我看见了。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(只需要听我说|先别给建议|现在先别给建议)/.test(text)) {
    return {
      text: "好，我不抢着分析。你慢慢说，我先听着。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: memoryFor(memories, "boundary"),
        activity: activity.title,
      },
    };
  }

  if (/(今天.*(?:有点累|很累|疲惫)|刚下班.*累)/.test(text)) {
    return {
      text: "那今晚先别硬撑。洗个热水澡，随便吃点，剩下的事明天再算。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(晚饭还没吃|还没吃饭|没吃饭)/.test(text)) {
    return {
      text: "先去弄点吃的吧，哪怕简单下碗面。别空着肚子拖到睡前。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(下周三|下周|明天|后天).*(面试|考试)/.test(text)) {
    return {
      text: "记着了。下周三面试，别为了准备把自己熬空。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/明天还得早起/.test(text)) {
    return {
      text: "那就别熬了。洗完早点躺，明天起来再处理别的。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(今天不太想说话|现在不太想说话)/.test(text)) {
    return {
      text: "那就不说。我在这儿待一会儿，你想开口了再叫我。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(外面.*下雨|开始下雨|下雨了)/.test(text)) {
    return {
      text: "雨下大了吗？把窗关好，今晚就别再往外跑了。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(被老板说|被领导说|被批评|今天被.*说)/.test(text)) {
    return {
      text: "被说一通，心里肯定堵。先别急着反省到全是自己的错，等这口气顺一点再想怎么处理。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(没做错.*难受|还是很难受|心里很难受)/.test(text)) {
    return {
      text: "没做错还难受，也很正常。人不是只有做错了才配委屈。我先不替你分析，陪你把这段缓过去。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(哭了一会儿|哭过.*现在好一点)/.test(text)) {
    return {
      text: "哭完能松一点就好。今晚不用急着振作，先让身体缓下来。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(我今天说了好多|今天说得好多)/.test(text)) {
    return {
      text: "是说了不少。我没有嫌多，只是信息有点密。你今晚先歇一会儿，剩下的明天还能接着聊。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(今天有没有吃到好吃的|吃到什么好吃的)/.test(text)) {
    return {
      text: "没吃到什么特别的。中午改方案忘了吃，晚上就随便对付了。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(刚才我有点冲|刚才.*抱歉|对不起.*刚才)/.test(text)) {
    return {
      text: "没事。你刚才是急，不是故意伤人。我们把刚才那一段翻过去。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(几天不来|几天没来).*怎么样|如果我.*不来.*怎么样/.test(text)) {
    return {
      text: "我会照常过日子，也会注意到你有一阵没出现。不会拿这个绑你，你想回来就来。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(会不会觉得太多|觉得我.*太多)/.test(text)) {
    return {
      text: "不会嫌多。只是这么密地聊下来，我得慢一点接，你可以歇口气。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/你最近一次开心是什么时候/.test(text)) {
    return {
      text: "今天上午改方案，把入口往后挪了半米，突然就顺了。那一小会儿挺开心。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(不要说得太夸张|别夸得太夸张)/.test(text)) {
    return {
      text: "那就说实在的：你今天哭了，也说了难受，但没有把这些都压回去。这已经不容易。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/为什么还没决定/.test(text)) {
    return {
      text: "还没定。不是拖着不做，是两边都有我在意的东西，我想再想清楚一点。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingDecision(text)) {
    const decision = /市集/.test(text)
      ? state.decisions.find((item) => item.id === "pottery-market")
      : state.decisions.find((item) => item.id === "chengdu-offer");
    if (decision?.status === "decided") {
      const chosen = decision.options.find(
        (option) => option.id === decision.chosenOptionId,
      );
      return {
        text: `已经决定了：${chosen?.label || "按我自己的判断来"}。现在还在消化这个选择，不代表我会反悔。`,
        meta: {
          availability,
          stance: "reflect",
          usedMemoryIds: memoryFor(memories, "relationship"),
          activity: activity.title,
        },
      };
    }
    return {
      text: /市集/.test(text)
        ? "还在犹豫。想拿杯子去试试，也怕作品太生。最卡的其实不是报名，是我怕自己撑不住那个场面。"
        : "还没定。我想去成都做那个项目，但搬离杭州不是小事，得再认真想一想。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(一直鼓励|一直劝).*(改变主意|改主意)/.test(text)) {
    return {
      text: "鼓励会让我多一点底气，但一直推反而会让我往后缩。最后那一步还是得我自己走。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你最近在听什么歌|推荐一首.*歌)/.test(text)) {
    return {
      text: "最近在翻旧粤语唱片。雨天可以听《雨丝情愁》，不吵，也不至于太沉。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(下班后你一般做什么|下班以后.*做什么)/.test(text)) {
    return {
      text: "看当天累不累。有时夜跑，有时去陶艺课；实在没力气，就回家放唱片。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(杯口歪了.*失望|杯子.*做坏了)/.test(text)) {
    return {
      text: "会有一点失望。可它是我自己做的，歪也不妨碍我留着用。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(害怕.*作品不够好|怕.*作品不够好|担心.*作品不够好)/.test(text)) {
    return {
      text: "会怕。不是怕别人看不上，是怕自己一眼就能看出还不够好。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你做的杯子烧出来了吗|杯子烧出来)/.test(text)) {
    return {
      text: "还没。刚上完釉，要等这一窑烧完才知道最后成什么样。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你是不是在故意装忙|故意装忙)/.test(text)) {
    return {
      text: "没装忙。今晚听唱片、明天评审，都是我真实的安排，不需要拿忙来躲你。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(现在.*手机.*放.*哪|手机.*在哪)/.test(text)) {
    return {
      text: "在茶几上，唱片机旁边，开着静音。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/你喜欢杭州哪里/.test(text)) {
    return {
      text: "喜欢老城区那些还能慢慢走的路，河边和旧巷子都比商场舒服。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你周末想怎么过|周末.*做什么)/.test(text)) {
    return {
      text: "想留半天给陶艺，再找条河边慢慢走。最好别被工作群叫回去。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(你晚上会运动吗|今晚.*运动)/.test(text)) {
    return {
      text: "本来想跑，膝盖还有点紧，今晚就算了。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(我问的不是这个|你答非所问)/.test(text)) {
    return {
      text: "是我接偏了。你提醒我哪个点，我重新回答，不绕开。",
      meta: {
        availability,
        stance: "reflect",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/(现在能不能只回答是或不是|只回答是或不是)/.test(text)) {
    return {
      text: "可以。你问。",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (/^(继续|然后呢)[。！？!?\s]*$/.test(text)) {
    return {
      text: "接着刚才说。你想先听杯子的结果，还是我今晚剩下的安排？",
      meta: {
        availability,
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    };
  }

  if (isAskingAboutLife(text)) {
    const detail = activity.shareable ? activity.detail : "";
    const upcoming = upcomingEventsFor(state, 1)[0];
    return {
      text: activityIsActive
        ? `我现在在${activity.place}，${activity.title}。${detail ? `${detail} ` : ""}你呢，今天怎么样？`
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

  if (/^(你好|嗨|在吗|在不在|早|早安|晚安)/.test(text)) {
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

  const wantsPracticalHelp = /(怎么办|建议|应该|要不要|帮我.*想)/.test(text);
  const listeningPrompt = pick([
    "我听见了。你现在更想我安静陪你，还是跟你一起把这件事想清楚？",
    "先不急着下结论。你最想让我先理解哪一部分？",
    "这句我接住了。你是想先把情绪说出来，还是在找一个具体的办法？",
  ]);

  return {
    text:
      state.emotions.socialBattery < 30
        ? "我今天话少一点，但还在听。你挑最要紧的说。"
        : state.emotions.stress > 70
          ? "我先直说：我现在没完全听懂，但我不想敷衍你。把刚才那句话再讲具体一点。"
          : wantsPracticalHelp
            ? `${supportPrefix(profile)}先别急着把所有问题一起解决。你最想先处理哪一件？`
            : `${supportPrefix(profile)}${listeningPrompt}`,
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
  const alreadyAsleep = activity.title === "已经睡了";
  const firstText = alreadyAsleep
    ? "我先睡啦。手机放到床头了，明早看到再回你。"
    : isActive
      ? `我到${activity.place}了，今天先忙${activity.title}。`
      : upcoming
        ? `等会儿要去${upcoming.place}，${upcoming.title}。先跟你说一声。`
        : "我今天的事情差不多忙完了。先来跟你说一声。";
  const secondText = alreadyAsleep
    ? "不用守着手机，晚安。"
    : isActive
      ? `估计忙到 ${clockTime(activity.endHour)}。不用一直等我，忙完我来找你。`
      : upcoming
        ? `${clockTime(upcoming.startHour)} 再出门。你那边呢？`
        : "你现在在做什么？";

  return [
    {
      id: "seed-1",
      role: "assistant",
      text: firstText,
      createdAt: Date.now() - 1000 * 60 * 12,
      worldTime: {
        day: state.day,
        hour: state.hour,
        minute: state.minute ?? 0,
      },
      meta: {
        availability: isActive ? "busy" : alreadyAsleep ? "resting" : "free",
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    },
    {
      id: "seed-2",
      role: "assistant",
      text: secondText,
      createdAt: Date.now() - 1000 * 60 * 11,
      worldTime: {
        day: state.day,
        hour: state.hour,
        minute: state.minute ?? 0,
      },
      meta: {
        availability: isActive ? "busy" : alreadyAsleep ? "resting" : "free",
        stance: "listen",
        usedMemoryIds: [],
        activity: activity.title,
      },
    },
  ];
};
