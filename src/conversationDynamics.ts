import type { CharacterGender, CharacterState, Message } from "./types";

type NumericPatch = {
  valence: number;
  stress: number;
  energy: number;
  socialBattery: number;
  warmth: number;
  respect: number;
  predictability: number;
  trust: number;
};

export type InteractionAnalysis = {
  currentRead: string;
  modelNote: string;
  patch: NumericPatch;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalize = (text: string) =>
  text.replace(/[\s，。！？!?、；;：:]/g, "").toLowerCase();

export const analyzeRecentInteraction = (
  messages: Message[],
  gender: CharacterGender = "female",
): InteractionAnalysis => {
  const pronoun = gender === "male" ? "他" : "她";
  const recent = messages
    .filter((message) => message.role === "user")
    .slice(-8)
    .map((message) => message.text.trim())
    .filter(Boolean);
  const latest = recent.at(-1) || "";
  const normalized = recent.map(normalize);
  const counts = new Map<string, number>();
  for (const item of normalized) {
    if (item.length >= 2) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
  }
  const repeatCount = Math.max(0, ...counts.values());
  const questionCount = recent.filter((text) =>
    /([?？]|什么|为什么|怎么|多少|哪个|哪座|谁|吗$)/.test(text),
  ).length;
  const barrage = recent.length >= 5 && questionCount >= 4;
  const repeated = repeatCount >= 3;
  const controlling =
    /(必须|只能|不许|听我的|别拒绝|马上回答|只能回答|给我老实)/.test(
      latest,
    );
  const insulting = /(闭嘴|滚|笨蛋|蠢货|废物|没用|烦死)/.test(latest);
  const supportive =
    /(谢谢|辛苦了|我理解|我在听|慢慢来|不用急|你不想说也可以|尊重你)/.test(
      latest,
    );
  const confused =
    /(叽里咕噜|答非所问|没回答|说的啥|说啥呢|听不懂)/.test(latest);
  const affection = /(想你|喜欢你|爱你|抱抱|亲我|女朋友|男朋友)/.test(
    latest,
  );

  const patch: NumericPatch = {
    valence: 0,
    stress: questionCount > 0 ? 1 : 0,
    energy: 0,
    socialBattery: questionCount > 0 ? -1 : 0,
    warmth: 0,
    respect: 0,
    predictability: 0,
    trust: 0,
  };

  if (supportive) {
    patch.valence += 0.6;
    patch.stress -= 5;
    patch.socialBattery += 4;
    patch.warmth += 5;
    patch.respect += 3;
    patch.trust += 1;
  }
  if (affection) {
    patch.valence += 0.4;
    patch.warmth += 3;
    patch.stress -= 1;
  }
  if (controlling) {
    patch.stress += 8;
    patch.socialBattery -= 4;
    patch.respect -= 7;
    patch.trust -= 1;
  }
  if (insulting) {
    patch.valence -= 1;
    patch.stress += 13;
    patch.socialBattery -= 8;
    patch.warmth -= 8;
    patch.respect -= 12;
    patch.trust -= 3;
  }
  if (repeated) {
    patch.stress += Math.min(12, 4 + (repeatCount - 3) * 2);
    patch.socialBattery -= 4;
    patch.predictability -= 6;
  }
  if (barrage) {
    patch.stress += 4;
    patch.socialBattery -= 3;
    patch.predictability -= 4;
  }
  if (confused) {
    patch.stress += 2;
    patch.predictability -= 2;
  }
  let currentRead = `${pronoun}还在继续观察你。`;
  if (insulting) {
    currentRead = `${pronoun}觉得你在用攻击性的话逼${pronoun}后退。`;
  } else if (controlling) {
    currentRead = `${pronoun}觉得你有点想替${pronoun}做决定。`;
  } else if (supportive && (repeated || barrage || confused)) {
    currentRead = `${pronoun}还在防备，但看见你在试着把对话拉回来。`;
  } else if (repeated) {
    currentRead = `${pronoun}觉得你在反复试探同一个答案。`;
  } else if (barrage) {
    currentRead = `${pronoun}觉得你的问题太密，像在审问${pronoun}。`;
  } else if (confused) {
    currentRead = `${pronoun}觉得刚才的回应没有真正对上你的问题。`;
  } else if (affection) {
    currentRead = `${pronoun}听见了你的亲近，也在按自己的节奏回应。`;
  } else if (supportive) {
    currentRead = `${pronoun}觉得你在认真听，也愿意尊重${pronoun}的边界。`;
  }

  const modelNote = [
    `最近互动判断：${currentRead}`,
    repeated ? `用户在最近八条消息中把同一句重复了 ${repeatCount} 次。` : "",
    barrage ? `用户连续发了较多问题，提问密度偏高。` : "",
    supportive ? "用户表达了理解、耐心或边界尊重。" : "",
    controlling ? "用户使用了命令式控制表达。" : "",
    insulting ? "用户使用了攻击性表达。" : "",
    affection ? "用户表达了恋爱中的亲近或想念。" : "",
    "请通过语气、长度和是否追问自然体现，不要机械宣布情绪数值。",
  ]
    .filter(Boolean)
    .join("\n");

  return { currentRead, modelNote, patch };
};

export const applyInteractionAnalysis = (
  state: CharacterState,
  analysis: InteractionAnalysis,
): CharacterState => {
  const { patch } = analysis;
  const emotions = {
    valence: clamp(state.emotions.valence + patch.valence, -3, 3),
    stress: clamp(state.emotions.stress + patch.stress, 0, 100),
    energy: clamp(state.emotions.energy + patch.energy, 0, 100),
    socialBattery: clamp(
      state.emotions.socialBattery + patch.socialBattery,
      0,
      100,
    ),
  };

  return {
    ...state,
    emotions,
    mood: Math.round(emotions.valence),
    energy: Math.round(emotions.energy),
    trust: clamp(state.trust + patch.trust, 0, 100),
    userImpression: {
      warmth: clamp(state.userImpression.warmth + patch.warmth, 0, 100),
      respect: clamp(
        state.userImpression.respect + patch.respect,
        0,
        100,
      ),
      predictability: clamp(
        state.userImpression.predictability + patch.predictability,
        0,
        100,
      ),
      currentRead: analysis.currentRead,
      updatedAt: Date.now(),
    },
  };
};
