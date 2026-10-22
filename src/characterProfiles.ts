import type {
  BiographyChapter,
  CharacterGender,
  CharacterState,
  LifeDecision,
} from "./types";
import { biography, initialDecisions } from "./lifeStory";

export type CharacterProfile = {
  gender: CharacterGender;
  name: string;
  glyph: string;
  pronoun: "她" | "他";
  role: string;
  subtitle: string;
  speakingStyle: string;
};

export const characterProfiles: Record<CharacterGender, CharacterProfile> = {
  female: {
    gender: "female",
    name: "阿岚",
    glyph: "岚",
    pronoun: "她",
    role: "空间改造助理 / 陶艺初学者",
    subtitle: "安静观察，慢热，有轻微的冷幽默",
    speakingStyle:
      "表达偏含蓄，会关心恋人但不会每句话都甜腻；情绪上来时会变短、更直接，也会明确说出自己的边界。",
  },
  male: {
    gender: "male",
    name: "阿川",
    glyph: "川",
    pronoun: "他",
    role: "空间改造助理 / 陶艺初学者",
    subtitle: "直率稳重，少一点客套，偶尔有点闷",
    speakingStyle:
      "表达更直、更短；恋爱时会关心和护着对方，但不刻意卖萌，不滥用亲昵称呼；有情绪时会说具体原因，而不是绕弯。",
  },
};

const personalize = (text: string, profile: CharacterProfile) =>
  text
    .replaceAll("阿岚", profile.name)
    .replaceAll("她", profile.pronoun);

export const profileBiography = (
  gender: CharacterGender,
): BiographyChapter[] => {
  const profile = characterProfiles[gender];
  return biography.map((chapter) => ({
    ...chapter,
    summary: personalize(chapter.summary, profile),
    impact: personalize(chapter.impact, profile),
  }));
};

export const profileDecisions = (
  gender: CharacterGender,
): LifeDecision[] => {
  const profile = characterProfiles[gender];
  return initialDecisions.map((decision) => ({
    ...decision,
    context: personalize(decision.context, profile),
    options: decision.options.map((option) => ({
      ...option,
      summary: personalize(option.summary, profile),
    })),
  }));
};

export const applyCharacterProfile = (
  state: CharacterState,
  gender: CharacterGender,
): CharacterState => {
  const profile = characterProfiles[gender];
  return {
    ...state,
    gender,
    name: profile.name,
    pronoun: profile.pronoun,
    role: profile.role,
    biography: profileBiography(gender),
    decisions: profileDecisions(gender),
    userImpression: {
      ...state.userImpression,
      currentRead: `刚在一起不久，还在适应你表达关心的方式。`,
    },
  };
};
