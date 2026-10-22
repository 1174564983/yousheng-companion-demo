import type { CharacterState, Memory, Message } from "./types";
import { currentEventFor } from "./data";

export type AuditResult = {
  pass: boolean;
  text: string;
  reason?: string;
};

const normalize = (text: string) =>
  text.replace(/[\s，。！？!?、；;：:]/g, "").toLowerCase();

const firstSentence = (text: string) => {
  const trimmed = text.trim();
  return (trimmed.match(/^.*?[。！？!?]/)?.[0] || trimmed).trim();
};

const memoryAsReply = (text: string) =>
  text
    .trim()
    .replace(/^我最近/, "你最近")
    .replace(/^我/, "你")
    .replace(/我的/g, "你的");

const directFactFallback = (
  userText: string,
  state: CharacterState,
  memories: Memory[],
  profileName: string,
) => {
  if (/(我叫什么|我的名字)/.test(userText)) {
    const name =
      memories
        .filter(
          (memory) =>
            memory.kind === "relationship" &&
            memory.text.includes(profileName),
        )
        .map((memory) => memory.text.match(/你叫([^，。；\s]+)/)?.[1])
        .find(Boolean) || profileName;
    return name ? `你叫${name}。` : "我这边没有你的名字记忆。";
  }
  if (/(什么关系|算什么关系|女朋友|男朋友|恋人|谈恋爱)/.test(userText)) {
    return "我们在谈恋爱，刚在一起不久。不是先从朋友做起。";
  }
  if (/你叫什么/.test(userText)) return `${state.name}。`;
  if (/(多少岁|几岁)/.test(userText)) return `${state.age} 岁。`;
  if (/(做什么工作|职业|工作是什么|干什么工作)/.test(userText)) {
    return "做空间改造，主要做旧社区和老建筑。";
  }
  if (/(小时候|小学|中学|高中|学校|读书)/.test(userText)) {
    return "小学在平江实验小学，中学在苏州市第三中学。";
  }
  if (/大学/.test(userText)) return "江南大学，环境设计，在无锡。";
  if (/(哪个城市|哪里人|住哪)/.test(userText)) {
    return `现在住${state.currentCity || "杭州"}。`;
  }
  if (/(几点|什么时间|现在.*时间)/.test(userText)) {
    return `现在是 ${String(state.hour).padStart(2, "0")}:${String(
      state.minute ?? 0,
    ).padStart(2, "0")}。`;
  }
  if (
    /(你今天在忙什么|在忙什么|你在干嘛|现在在做什么|此刻在哪|你(?:现在)?在哪(?!个城市))/.test(
      userText,
    )
  ) {
    const event = currentEventFor(state);
    return `现在在${event.place}，${event.title}。`;
  }
  if (/(你会什么|你会做什么|擅长什么)/.test(userText)) {
    return "做空间改造，也会一点陶艺。";
  }
  if (/(几个朋友|朋友多吗|多少朋友|有朋友吗)/.test(userText)) {
    return "没认真数过。常联系的没几个，小满算一个。";
  }
  return firstSentence(userText);
};

export const auditDraftReply = (input: {
  text: string;
  userText: string;
  state: CharacterState;
  memories: Memory[];
  profileName: string;
  recentMessages: Message[];
}): AuditResult => {
  const text = input.text.trim();
  if (!text) {
    return {
      pass: false,
      text: "我刚才没接准，你再说一遍？",
      reason: "empty",
    };
  }

  if (
    /我在听。你不用一次说清楚，先说最难受的那一句就行。/.test(text)
  ) {
    return {
      pass: false,
      text: directFactFallback(
        input.userText,
        input.state,
        input.memories,
        input.profileName,
      ),
      reason: "legacy-template",
    };
  }

  if (
    /先不急着下结论[\s\S]*最想让我先理解/.test(text) ||
    /我听见了[\s\S]*你现在更想我安静陪你/.test(text)
  ) {
    return {
      pass: false,
      text: /明天见/.test(input.userText)
        ? "嗯，明天见。到了记得跟我说一声。"
        : /今晚不来了/.test(input.userText)
          ? "那就不来。你不用为了让我安心硬撑着过来。"
          : `我没接准。你刚才说的是“${firstSentence(
              input.userText,
            )}”，想让我回应哪一部分？`,
      reason: "generic-fallback",
    };
  }

  if (
    /(根据系统提示|本轮回复预算|JSON schema|作为一个AI模型|内部推理|用户印象数值)/i.test(
      text,
    )
  ) {
    return {
      pass: false,
      text: "刚才那句话没组织好。你想问什么，我直接答。",
      reason: "internal-leak",
    };
  }

  if (
    /(什么关系|算什么关系|女朋友|男朋友|恋人|谈恋爱)/.test(input.userText) &&
    (!/(恋人|谈恋爱|女朋友|男朋友)/.test(text) ||
      /(?:^|[，。！？\s])(?:还是|只是|先做|先从|先当)朋友|朋友阶段/.test(
        text,
      ))
  ) {
    return {
      pass: false,
      text: "我们在谈恋爱，刚在一起不久。不是先从朋友做起。",
      reason: "relationship-status-mismatch",
    };
  }

  if (/(你管不着|少管我|跟你无关)/.test(text)) {
    return {
      pass: false,
      text: "这件事我想自己决定。你可以不同意，但别替我取消。",
      reason: "too-hostile",
    };
  }

  if (
    /(现在能不能只回答是或不是|只回答是或不是)/.test(input.userText) &&
    !/(能|可以|你问|说吧)/.test(text)
  ) {
    return {
      pass: false,
      text: "可以。你问。",
      reason: "answer-mode-mismatch",
    };
  }

  if (
    /反复洗手/.test(input.userText) &&
    !/(手|洗|紧张)/.test(text)
  ) {
    return {
      pass: false,
      text: "记下了。紧张时手会停不下来，但别让皮肤洗到发红；想找点事稳住自己，可以先坐一会儿。",
      reason: "handwashing-mismatch",
    };
  }

  if (
    /(我没听懂|没听明白|听不懂|再说短一点)/.test(input.userText) &&
    !/(重说|再说|具体|哪句|哪个|短一点|你想问)/.test(text)
  ) {
    return {
      pass: false,
      text: "我刚才没答清楚。你指一下是哪句，我短一点重说。",
      reason: "clarification-mismatch",
    };
  }

  if (
    /(做错事.*直接说|做错了.*会直接说)/.test(input.userText) &&
    !/(会|直接说|说清)/.test(text)
  ) {
    return {
      pass: false,
      text: "会。但我会先说清具体哪儿不对，不拿一句“你错了”打发你。",
      reason: "honesty-mismatch",
    };
  }

  if (
    /(但我还是想再试试|还是想再试试|还想再试一次)/.test(input.userText) &&
    !/(再试|试一点|下一步|继续)/.test(text)
  ) {
    return {
      pass: false,
      text: "那就再试一点。不用一次证明什么，先看下一步能不能走稳。",
      reason: "encouragement-mismatch",
    };
  }

  if (
    /(忙完会回我|忙完.*回我吗)/.test(input.userText) &&
    !/(会|回你|回消息)/.test(text)
  ) {
    return {
      pass: false,
      text: "会。我忙完会回，不用靠你再问一遍来确认。",
      reason: "availability-mismatch",
    };
  }

  const memoryTopic = /咖啡/.test(input.userText)
    ? { memory: /咖啡/, replyTerms: ["咖啡", "糖"] }
    : /考试/.test(input.userText)
      ? { memory: /考试/, replyTerms: ["考试"] }
      : /面试/.test(input.userText)
        ? { memory: /面试/, replyTerms: ["面试", "周三", "星期三"] }
        : /(沟通偏好|怎么回应|希望我.*(听|说|空间))/.test(input.userText)
          ? {
              memory: /(听我说|直接说|空间|别.*追问)/,
              replyTerms: ["听", "直接", "空间", "追问"],
            }
          : null;
  if (memoryTopic) {
    const relatedMemory = [...input.memories]
      .reverse()
      .find((memory) => memoryTopic.memory.test(memory.text));
    if (
      relatedMemory &&
      !memoryTopic.replyTerms.some((term) => text.includes(term))
    ) {
      return {
        pass: false,
        text: `我记得，${memoryAsReply(relatedMemory.text)}。`,
        reason: "memory-mismatch",
      };
    }
  }

  if (/(有没有说过|刚才.*(?:说过|提过|提到)|之前.*(?:说过|提过|提到))/.test(input.userText)) {
    const entity = ["小满", "咖啡", "成都", "考试", "面试"].find((value) =>
      input.userText.includes(value),
    );
    if (entity) {
      const mention = [...input.recentMessages]
        .reverse()
        .find(
          (message) =>
            message.role === "user" && message.text.includes(entity),
        );
      const expectedMention = mention
        ? `说过。你前面提到过${entity}。`
        : `没有。前面这几轮里没提到${entity}。`;
      const saysNo = /(没有|没|未).{0,8}(说过|提过|提到|说)/.test(text);
      const saysYes = /(说过|提过|提到)/.test(text);
      if (
        (mention && (!saysYes || saysNo)) ||
        (!mention && saysYes && !saysNo)
      ) {
        return {
          pass: false,
          text: expectedMention,
          reason: "recent-mention-mismatch",
        };
      }
    }
  }

  const directFact =
    /(我叫什么|我的名字|你叫什么|多少岁|几岁|做什么工作|职业|哪个城市|哪里人|住哪|现在.*几点|几点了|大学|学校|读书|上学|小时候|你会什么|你会做什么|几个朋友|朋友多吗|多少朋友|有朋友吗|你今天在忙什么|在忙什么|你在干嘛|现在在做什么|此刻在哪|你(?:现在)?在哪(?!个城市))/.test(
      input.userText,
    ) &&
    !/(为什么|怎么办|建议|觉得|怎么想)/.test(input.userText);
  const shortCasual =
    /^(在吗|在不在|嗯+|哦+|哎+|唉+|哈+|好|好吧|行|行吧|晚安|早|早上好|刚到家|到家了|知道了|谢谢|谢谢你|明天见|我去睡了|准备睡了)[。！？!?\s]*$/.test(
      input.userText,
    ) &&
    !directFact &&
    !/([？?]|吗|呢|什么|怎么|为什么|累|难受|失败|担心|想你|不想说|安排|尊重)/.test(
      input.userText,
    );

  if (directFact) {
    const required =
      /(我叫什么|我的名字)/.test(input.userText)
        ? input.profileName
        : /(小学|中学|学校|读书|上学|小时候)/.test(input.userText)
          ? "苏州"
          : /(哪个城市|哪里人|住哪)/.test(input.userText)
            ? input.state.currentCity || "杭州"
            : /(多少岁|几岁)/.test(input.userText)
              ? String(input.state.age)
              : /(做什么工作|职业|工作是什么|干什么工作)/.test(input.userText)
                ? "空间"
                : /大学/.test(input.userText)
                  ? "江南大学"
                  : /(现在.*几点|几点了|什么时间)/.test(input.userText)
                    ? String(input.state.hour).padStart(2, "0")
                    : /(你会什么|你会做什么|擅长什么)/.test(input.userText)
                      ? "陶艺"
                      : /(几个朋友|朋友多吗|多少朋友|有朋友吗)/.test(
                            input.userText,
                          )
                        ? "小满"
                        : "";
    if (required && !text.includes(required)) {
      return {
        pass: false,
        text: directFactFallback(
          input.userText,
          input.state,
          input.memories,
          input.profileName,
        ),
        reason: "fact-mismatch",
      };
    }
    if (text.length > 55) {
      return {
        pass: false,
        text: directFactFallback(
          input.userText,
          input.state,
          input.memories,
          input.profileName,
        ),
        reason: "fact-too-long",
      };
    }
  }

  if (shortCasual && text.length > 40) {
    return {
      pass: false,
      text: firstSentence(text),
      reason: "casual-too-long",
    };
  }

  const normalized = normalize(text);
  const repeated = input.recentMessages
    .filter((message) => message.role === "assistant")
    .slice(-4)
    .some((message) => normalize(message.text) === normalized);
  if (repeated) {
    const fallback = directFactFallback(
      input.userText,
      input.state,
      input.memories,
      input.profileName,
    );
    return {
      pass: false,
      text: directFact
        ? `${fallback.replace(/[。！？!?]$/, "")}。你是在确认哪一部分？`
        : "我刚说过一轮了。你换个具体的问题，我接着答。",
      reason: "duplicate",
    };
  }

  return { pass: true, text };
};
