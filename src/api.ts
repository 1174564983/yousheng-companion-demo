import type {
  CharacterState,
  Memory,
  Message,
  ModelReply,
  ModelStatus,
  UserProfile,
} from "./types";

const parseJson = async (response: Response) => {
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error =
      typeof data.error === "string"
        ? data.error
        : `模型服务返回 ${response.status}`;
    throw new Error(error);
  }
  return data;
};

export const getModelStatus = async (): Promise<ModelStatus> => {
  try {
    const response = await fetch("/api/health");
    return (await parseJson(response)) as ModelStatus;
  } catch {
    return {
      configured: false,
      provider: "local",
      model: "规则引擎",
      reason: "模型服务未启动",
    };
  }
};

export const requestModelReply = async (input: {
  state: CharacterState;
  profile: UserProfile;
  memories: Memory[];
  messages: Message[];
  userText: string;
  contextNote?: string;
}): Promise<ModelReply> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return (await parseJson(response)) as unknown as ModelReply;
};
