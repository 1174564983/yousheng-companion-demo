import type { CharacterState, Memory, Message } from "./types";

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
  if (/你叫什么/.test(userText)) return `${state.name}。`;
  if (/(多少岁|几岁)/.test(userText)) return `${state.age} 岁。`;
  if (/(做什么工作|职业|工作是什么|干什么工作)/.test(userText)) {
    return "做空间改造，主要做旧社区和老建筑。";
  }
  if (/(哪个城市|哪里人|住哪)/.test(userText)) {
    return `现在住${state.currentCity || "杭州"}。`;
  }
  if (/(小时候|小学|中学|高中|学校|读书)/.test(userText)) {
    return "小学在平江实验小学，中学在苏州市第三中学。";
  }
  if (/大学/.test(userText)) return "江南大学，环境设计，在无锡。";
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

  const directFact =
    /(我叫什么|我的名字|你叫什么|多少岁|几岁|做什么工作|职业|哪个城市|哪里人|住哪|现在.*几点|几点了|大学|学校|读书|上学|小时候|你会什么|你会做什么|几个朋友|朋友多吗|多少朋友|有朋友吗)/.test(
      input.userText,
    ) &&
    !/(为什么|怎么办|建议|觉得|怎么想)/.test(input.userText);
  const shortCasual =
    input.userText.replace(/[\s，。！？!?、；;：:]/g, "").length <= 8 &&
    !directFact;

  if (directFact) {
    const required =
      /(我叫什么|我的名字)/.test(input.userText)
        ? input.profileName
        : /(哪个城市|哪里人|住哪)/.test(input.userText)
          ? input.state.currentCity || "杭州"
          : /(多少岁|几岁)/.test(input.userText)
            ? String(input.state.age)
            : /(做什么工作|职业|工作是什么|干什么工作)/.test(input.userText)
              ? "空间"
              : /(小学|中学|学校|读书|上学|小时候)/.test(input.userText)
                ? "苏州"
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
