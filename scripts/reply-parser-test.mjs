import assert from "node:assert/strict";
import { parseModelReply } from "../server/replyParser.mjs";

const valid = parseModelReply(
  JSON.stringify({
    reply: "在。怎么了？",
    stance: "listen",
    used_memory_ids: [],
    memory_candidate: null,
  }),
);
assert.equal(valid.reply, "在。怎么了？");

const plain = parseModelReply("回复：在。刚把唱片翻了个面。\nstance: listen");
assert.equal(plain.reply, "在。刚把唱片翻了个面。");
assert.equal(plain.stance, "listen");

const partialJson = parseModelReply(
  '"reply": "听见了，你说。", "stance": "reflect"',
);
assert.equal(partialJson.reply, "听见了，你说。");
assert.equal(partialJson.stance, "reflect");

const alternateKey = parseModelReply(
  '{"response": "好，我陪你。先说最难受的那部分。", "stance": "listen"}',
);
assert.equal(alternateKey.reply, "好，我陪你。先说最难受的那部分。");

console.log("reply parser: ok");
