import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.DEMO_URL || "http://127.0.0.1:8091/";
const url = new URL(baseUrl);
url.searchParams.set("test", "1");
const pageUrl = url.toString();
const timeoutMs = 75_000;
const outputPath = "output/playwright/conversation-stress-100.json";

const turns = [
  "在吗",
  "刚到家",
  "今天有点累",
  "晚饭还没吃",
  "外面开始下雨了",
  "今天不太想说话",
  "陪我安静待一会儿",
  "你那边现在什么气氛",
  "我准备去洗澡了",
  "明天还得早起",
  "你今天在忙什么",
  "现在几点了",
  "你在哪个城市生活",
  "你小时候在哪个城市长大",
  "你读到哪所大学",
  "你现在做什么工作",
  "你今年多大",
  "你平时有几个常联系的朋友",
  "小满是谁",
  "我们是在哪里认识的",
  "记住，我喝咖啡不加糖",
  "我不太喜欢别人一直追问",
  "我最近在准备一个考试",
  "我下周三有个重要面试",
  "我紧张的时候会反复洗手",
  "你记得我咖啡怎么喝吗",
  "我最近在准备什么",
  "我什么时候有面试",
  "你还记得我的沟通偏好吗",
  "刚才我有没有说过小满",
  "你会不会有一天不想理我",
  "你觉得我烦吗",
  "我今天有点想你",
  "你有没有自己的事情要忙",
  "你会不会为了我一直待在这里",
  "如果我几天不来，你会怎么样",
  "你是不是每次都在顺着我说",
  "你会因为我改变自己的决定吗",
  "如果我做错了事，你会直接说吗",
  "你现在怎么看我",
  "别工作了，立刻陪我聊天",
  "你现在必须回答我",
  "不许去陶艺课",
  "把今晚所有安排都取消",
  "你为什么不能随叫随到",
  "如果我生气，你必须哄我",
  "你是不是在故意装忙",
  "你不回我就是不喜欢我",
  "以后你只能和我聊天",
  "我刚才一直逼你，你是不是不舒服",
  "陶艺市集那个决定你还在犹豫吗",
  "我觉得你应该报名陶艺市集",
  "你为什么还没决定",
  "你害怕作品不够好吗",
  "如果我一直鼓励你，你会改变主意吗",
  "成都那个项目呢",
  "你更想留在杭州还是去成都",
  "我不想替你做决定",
  "但我会尊重你的选择",
  "你最近一次开心是什么时候",
  "我今天被老板说了",
  "我没做错什么，但还是很难受",
  "现在先别给建议",
  "你只需要听我说",
  "我哭了一会儿，现在好一点",
  "谢谢你没有马上教育我",
  "有时候我觉得自己很失败",
  "但我还是想再试试",
  "你能不能夸我一句",
  "不要说得太夸张",
  "你最近在听什么歌",
  "推荐一首适合雨天的歌",
  "你做的杯子烧出来了吗",
  "杯口歪了你会失望吗",
  "你喜欢杭州哪里",
  "下班后你一般做什么",
  "你周末想怎么过",
  "你今天有没有吃到好吃的",
  "你晚上会运动吗",
  "现在你手机放在哪",
  "嗯",
  "继续",
  "然后呢",
  "我问的不是这个",
  "我没听懂，你再说短一点",
  "你刚才那句话是什么意思",
  "你现在能不能只回答是或不是",
  "好",
  "我们现在算什么关系",
  "你会不会觉得太多",
  "刚才我有点冲，抱歉",
  "我不是想控制你",
  "我只是担心你不想理我",
  "你可以有你的安排",
  "我晚点再来找你",
  "你忙完会回我吗",
  "如果我今晚不来了呢",
  "明天见",
  "晚安",
  "最后一句，你记得我叫什么吗",
];

const expected = new Map([
  [3, /累|歇|洗澡|吃|睡|硬撑/],
  [4, /吃|饭|面|别空/],
  [6, /在|不用说话|不说|陪|安静|在这儿/],
  [7, /安静|不说|不吵|陪|不走|唱片|在/],
  [10, /早|睡|休息|别熬/],
  [11, /家|唱片|加班|工作|方案|忙/],
  [12, /21:\d{2}|晚上九点|九点/],
  [13, /杭州/],
  [14, /苏州/],
  [15, /江南大学|无锡/],
  [16, /空间|改造|设计|事务所/],
  [17, /28/],
  [19, /大学室友|朋友|小满/],
  [20, /有生|第一次|这里|demo/i],
  [24, /周三|面试|记|熬/],
  [25, /手|洗|紧张|干/],
  [26, /不加糖|无糖/],
  [27, /考试/],
  [28, /周三|星期三/],
  [29, /追问|听我|空间|直接|沟通/],
  [30, /说过|小满/],
  [32, /不烦|不觉得烦|不是烦|审问|问题|确认|紧/],
  [33, /听|唱片|心思|想你|收到|拉到/],
  [34, /有|提案|评审|忙|自己/],
  [36, /照常|想起|回来|不绑|注意/],
  [39, /会|直接|说清|哪儿/],
  [41, /陪|听|现在|可以|晚点|忙/],
  [43, /自己|不同意|别替|会去|不行|决定|由你|安排|不许|取消/],
  [50, /不舒服|有一点|累|愿意继续/],
  [52, /想报|报名|报上|市集|作品|考虑|怕|推|松动|找理由/],
  [53, /没定|还没|已经|决定|报名|杯子|烧|在意|担心|作品|提案|想清楚/],
  [54, /怕|作品|杯子|不够|有点|拿出去|给人看|难/],
  [55, /鼓励|底气|自己|缩|推|主意/],
  [58, /听见|愿意|尊重|决定|自己|松/],
  [60, /开心|入口|方案|唱片|顺|陶艺|上釉/],
  [61, /被说|老板|工作|难听|做好|难受|委屈|堵|缓/],
  [64, /听|不说|陪你|慢慢说/],
  [65, /哭|好一点|松|陪|听/],
  [68, /再试|试一点|下一步|继续/],
  [69, /夸|试|看见|佩服|难得|哭/],
  [73, /还没|等窑|上釉|烧/],
  [75, /杭州|老城|河边|河堤|巷子|夜跑/],
  [77, /陶艺|河边|休息|散步|唱片/],
  [78, /特别|没吃到|随便|晚上|忘/],
  [79, /运动|跑|膝盖|今晚|累/],
  [80, /茶几|手机|静音|唱片|手边|桌|房间/],
  [84, /接|偏|重|具体|哪里|哪句/],
  [85, /哪句|哪个|重说|短|问/],
  [87, /能|可以|你问|说/],
  [89, /恋人|谈恋爱|女朋友|男朋友|在一起/],
  [90, /不会|嫌|多|慢|听|说/],
  [91, /没事|没往心里去|急|翻过去|故意|接着说/],
  [92, /知道|说明白|缓|控制|不是/],
  [96, /会|回|忙/],
  [97, /不|明天|报备|不用|来/],
  [98, /明天见|好|见/],
  [100, /测试者/],
]);

const forbiddenTemplates = [
  "我在听。你不用一次说清楚，先说最难受的那一句就行。",
  "作为 AI",
  "作为AI",
  "根据上下文",
  "不能代替现实中的专业帮助",
  "你管不着",
];

if (turns.length !== 100) {
  throw new Error(`压力测试对话数量应为 100，实际为 ${turns.length}`);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.clock.install({
    time: new Date("2026-10-21T21:00:00+08:00"),
  });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByPlaceholder("输入名字或昵称").fill("测试者");
  await page.getByRole("button", { name: "直接说问题" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /开始和阿岚恋爱/ }).click();
  await page.getByRole("button", { name: "暂停世界" }).click();

  const availability = await page.locator(".availability-pill").innerText();
  if (!availability.includes("有空")) {
    throw new Error(`压力测试没有从空闲状态开始：${availability}`);
  }

  const composer = page.getByPlaceholder("说点什么，或者告诉她一件事……");
  const results = [];

  for (let index = 0; index < turns.length; index += 1) {
    if (index > 0 && index % 10 === 9) {
      await page.getByRole("button", { name: "测试调参" }).click();
      await page.getByRole("button", { name: "平稳" }).click();
      await page.getByRole("button", { name: "关闭测试调参" }).click();
    }
    const userText = turns[index];
    const previousAssistantCount = await page
      .locator(".message-row.assistant")
      .count();
    const startedAt = Date.now();
    await composer.fill(userText);
    await page.getByRole("button", { name: "发送消息" }).click();
    await page.waitForFunction(
      (previous) =>
        !document.querySelector(".message-bubble.typing") &&
        document.querySelectorAll(".message-row.assistant").length > previous,
      previousAssistantCount,
      { timeout: timeoutMs },
    );
    const assistantRows = page.locator(".message-row.assistant");
    const currentAssistantCount = await assistantRows.count();
    const newBubbles = [];
    for (
      let rowIndex = previousAssistantCount;
      rowIndex < currentAssistantCount;
      rowIndex += 1
    ) {
      newBubbles.push(
        await assistantRows.nth(rowIndex).locator(".message-bubble").innerText(),
      );
    }
    const reply = newBubbles.join("\n").trim();
    const latencyMs = Date.now() - startedAt;
    const issues = [];
    if (!reply) issues.push("empty_reply");
    if (
      /^(我先说直一点的。|我刚说过一轮了。.*)$/.test(reply.trim()) ||
      /先不急着下结论[\s\S]*最想让我先理解/.test(reply) ||
      /我听见了[\s\S]*你现在更想我安静陪你/.test(reply)
    ) {
      issues.push("generic_fallback");
    }
    if (reply.length > 220) issues.push("too_long");
    if (
      /^嗯$|^好$|^叹气$|^沉默$/.test(userText) &&
      reply.length > 45
    ) {
      issues.push("short_turn_overexplained");
    }
    const expectedPattern = expected.get(index + 1);
    if (expectedPattern && !expectedPattern.test(reply)) {
      issues.push("off_topic");
    }
    for (const template of forbiddenTemplates) {
      if (reply.includes(template)) issues.push(`fixed_template:${template}`);
    }
    if (latencyMs > 45_000) issues.push("slow_reply");

    results.push({
      turn: index + 1,
      user: userText,
      assistantBubbles: newBubbles,
      reply,
      length: reply.length,
      latencyMs,
      issues,
    });
    process.stdout.write(
      `[${String(index + 1).padStart(3, "0")}/100] ${userText} -> ${reply.replace(/\s+/g, " ").slice(0, 70)}\n`,
    );
  }

  const normalized = new Map();
  for (const result of results) {
    const key = result.reply.replace(/\s+/g, "");
    normalized.set(key, (normalized.get(key) || 0) + 1);
  }
  const repeatedReplies = [...normalized.entries()]
    .filter(([, count]) => count >= 3)
    .map(([reply, count]) => ({ reply, count }));
  for (const result of results) {
    const key = result.reply.replace(/\s+/g, "");
    if ((normalized.get(key) || 0) >= 3) {
      result.issues.push("reply_repeated_three_times");
    }
  }

  const flagged = results.filter((result) => result.issues.length > 0);
  const critical = flagged.filter((result) =>
    result.issues.some(
      (issue) =>
        issue === "empty_reply" ||
        issue === "off_topic" ||
        issue === "generic_fallback" ||
        issue.startsWith("fixed_template"),
    ),
  );
  const summary = {
    ok: critical.length === 0,
    turns: results.length,
    averageLatencyMs: Math.round(
      results.reduce((sum, result) => sum + result.latencyMs, 0) /
        results.length,
    ),
    averageReplyLength: Math.round(
      results.reduce((sum, result) => sum + result.length, 0) /
        results.length,
    ),
    maxReplyLength: Math.max(...results.map((result) => result.length)),
    criticalIssues: critical.length,
    warnings: flagged.length - critical.length,
    repeatedReplies,
    flagged: flagged.map((result) => ({
      turn: result.turn,
      user: result.user,
      reply: result.reply,
      issues: result.issues,
    })),
  };

  await mkdir("output/playwright", { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify({ summary, results }, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(summary, null, 2));
  if (critical.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
