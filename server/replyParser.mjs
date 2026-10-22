const allowedStances = new Set([
  "listen",
  "reflect",
  "disagree",
  "boundary",
  "safety",
]);

const extractJson = (text) => {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("模型没有返回可解析的 JSON");
  }
};

const extractJsonField = (text, field) => {
  const match = text.match(
    new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`),
  );
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
};

const replyTextFor = (value) => {
  for (const field of ["reply", "response", "answer", "message", "content", "text"]) {
    if (typeof value?.[field] === "string" && value[field].trim()) {
      return value[field].trim();
    }
  }
  return "";
};

const cleanPlainReply = (text) =>
  text
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^(?:reply|回复)\s*[:：]\s*/i, "")
    .split(/\n\s*(?:stance|立场)\s*[:：]/i)[0]
    .trim();

const normalize = (parsed) => {
  const reply = replyTextFor(parsed);
  if (!reply) throw new Error("模型回复为空");

  return {
    reply: reply.slice(0, 1400),
    stance: allowedStances.has(parsed.stance) ? parsed.stance : "listen",
    used_memory_ids: Array.isArray(parsed.used_memory_ids)
      ? parsed.used_memory_ids
          .filter((item) => typeof item === "string")
          .slice(0, 2)
      : [],
    memory_candidate:
      parsed.memory_candidate &&
      typeof parsed.memory_candidate.text === "string" &&
      ["user", "relationship", "boundary"].includes(
        parsed.memory_candidate.kind,
      )
        ? {
            text: parsed.memory_candidate.text.trim().slice(0, 160),
            kind: parsed.memory_candidate.kind,
          }
        : null,
  };
};

export const parseModelReply = (payload) => {
  const rawText = String(payload || "").trim();
  try {
    return normalize(extractJson(rawText));
  } catch {
    const replyField = ["reply", "response", "answer", "message", "content", "text"]
      .map((field) => extractJsonField(rawText, field))
      .find(Boolean);
    const stanceField = extractJsonField(rawText, "stance");
    if (replyField) {
      return normalize({
        reply: replyField,
        stance: stanceField,
        used_memory_ids: [],
        memory_candidate: null,
      });
    }

    const plainReply = cleanPlainReply(rawText);
    if (!plainReply) throw new Error("模型回复为空");
    return normalize({
      reply: plainReply,
      stance: "listen",
      used_memory_ids: [],
      memory_candidate: null,
    });
  }
};
