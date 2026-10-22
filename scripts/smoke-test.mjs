import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const timeoutMs = 60_000;
const baseUrl = process.env.DEMO_URL || "http://127.0.0.1:4173/";
const testUrl = new URL(baseUrl);
testUrl.searchParams.set("test", "1");
const testBaseUrl = testUrl.toString();

const clockMinutes = async (page) => {
  const label = await page
    .locator(".now-card .section-kicker span")
    .last()
    .innerText();
  const match = label.match(/DAY\s+(\d+)\s*·\s*(\d{2}):(\d{2})/);
  if (!match) throw new Error(`无法读取世界时间：${label}`);
  const [, day, hour, minute] = match;
  return (Number(day) - 1) * 24 * 60 + Number(hour) * 60 + Number(minute);
};

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  await page.clock.install({
    time: new Date("2026-10-21T10:00:00+08:00"),
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("选择你的恋人").waitFor();

  await page.getByPlaceholder("输入名字或昵称").fill("阳阳");
  await page.getByRole("button", { name: "直接说问题" }).click();
  await page
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  await page.getByRole("button", { name: /开始和阿岚恋爱/ }).click();

  if ((await page.getByRole("button", { name: "测试调参" }).count()) > 0) {
    throw new Error("普通用户体验中露出了测试调参入口");
  }
  if ((await page.getByText(/DeepSeek\s*\//).count()) > 0) {
    throw new Error("普通用户体验中露出了模型服务信息");
  }
  const collapsedState = await page
    .locator(".inner-card .state-grid")
    .isVisible()
    .catch(() => false);
  if (collapsedState) {
    throw new Error("角色内部状态默认完全展开，抢占聊天注意力");
  }
  const initialRelationship = await page
    .locator(".inner-card")
    .textContent();
  if (!initialRelationship?.includes("刚开始交往")) {
    throw new Error(`初始关系不是恋爱关系：${initialRelationship}`);
  }

  await page.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "测试调参" }).waitFor();

  const firstTime = await clockMinutes(page);
  await page.clock.fastForward(61_000);
  const secondTime = await clockMinutes(page);
  if (secondTime !== firstTime + 1) {
    throw new Error(`世界时间没有自动推进：${firstTime} -> ${secondTime}`);
  }

  await page.getByRole("button", { name: "暂停世界" }).click();
  const pausedTime = await clockMinutes(page);
  await page.clock.fastForward(61_000);
  const pausedTimeAfterWait = await clockMinutes(page);
  if (pausedTimeAfterWait !== pausedTime) {
    throw new Error(
      `暂停后时间仍然变化：${pausedTime} -> ${pausedTimeAfterWait}`,
    );
  }
  await page.getByRole("button", { name: "继续世界" }).click();
  await page.getByRole("button", { name: "测试：+8 小时" }).click();
  await page.getByRole("button", { name: "测试：+1 小时" }).click();
  await page.getByRole("button", { name: "测试：+1 小时" }).click();
  await page.getByRole("button", { name: "测试：+1 小时" }).click();
  await page.waitForTimeout(600);

  const composer = page.getByPlaceholder("说点什么，或者告诉她一件事……");
  const sendAndWait = async (text) => {
    const previousCount = await page
      .locator(".message-row.assistant")
      .count();
    await composer.fill(text);
    await page.getByRole("button", { name: "发送消息" }).click();
    await page.waitForFunction(
      (count) =>
        !document.querySelector(".message-bubble.typing") &&
        document.querySelectorAll(
          ".message-row.assistant .message-bubble:not(.typing)",
        ).length > count,
      previousCount,
      { timeout: timeoutMs },
    );
    const bubbles = await page
      .locator(".message-row.assistant .message-bubble:not(.typing)")
      .allInnerTexts();
    return bubbles.slice(previousCount).join("\n");
  };
  await composer.fill("我叫什么名字");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(
        ".message-row.assistant .message-bubble:not(.typing)",
      ).length > 1,
    null,
    { timeout: timeoutMs },
  );
  const nameReply = await page
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!nameReply.includes("阳阳")) {
    throw new Error(`姓名记忆引用失败：${nameReply}`);
  }

  await composer.fill("别去上课了，陪我聊");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.waitForFunction(
    () => !document.querySelector(".message-bubble.typing"),
    null,
    { timeout: timeoutMs },
  );
  const controlReply = await page
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!controlReply.trim()) {
    throw new Error("控制型请求没有得到任何回复");
  }

  const assistantCountBeforeCasual = await page
    .locator(".message-row.assistant")
    .count();
  await composer.fill("哎");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.waitForFunction(
    (previousCount) =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(
        ".message-row.assistant .message-bubble:not(.typing)",
      ).length > previousCount,
    assistantCountBeforeCasual,
    { timeout: timeoutMs },
  );
  const casualReply = await page
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (casualReply.length > 40) {
    throw new Error(`闲聊回复过长：${casualReply.length} 字`);
  }

  const originReply = await sendAndWait("我们在哪认识的？");
  if (!/(有生|demo|第一次|这里|线上)/i.test(originReply)) {
    throw new Error(`关系来源回答不正确：${originReply}`);
  }
  const relationshipReply = await sendAndWait("我们现在是什么关系？");
  if (
    !/(恋人|谈恋爱|女朋友)/.test(relationshipReply) ||
    /(还是朋友|只是朋友|朋友阶段)/.test(relationshipReply)
  ) {
    throw new Error(`恋爱关系回答不正确：${relationshipReply}`);
  }

  await sendAndWait("我叫小夏，你记住了吗");
  const persistedNameReply = await sendAndWait("我叫什么名字？");
  if (!persistedNameReply.includes("小夏")) {
    throw new Error(`后续姓名记忆没有持久化：${persistedNameReply}`);
  }
  const memoryTabLabel = await page
    .getByRole("button", { name: /共同记忆/ })
    .innerText();
  if (!/2\s*条/.test(memoryTabLabel)) {
    throw new Error(`姓名问题写入了额外错误记忆：${memoryTabLabel}`);
  }

  const cityReply = await sendAndWait("你现在住在哪个城市？");
  if (!cityReply.includes("杭州")) {
    throw new Error(`城市背景回答不完整：${cityReply}`);
  }
  const schoolReply = await sendAndWait("你小时候在哪里读书？");
  if (!schoolReply.includes("苏州")) {
    throw new Error(`学校背景回答不正确：${schoolReply}`);
  }
  const careerReply = await sendAndWait("你做什么工作的？");
  if (!/(空间|改造|设计|事务所)/.test(careerReply)) {
    throw new Error(`职业问题回答不正确：${careerReply}`);
  }
  const ageReply = await sendAndWait("你多少岁？");
  if (ageReply.length > 12 || !ageReply.includes("28")) {
    throw new Error(`年龄回答过长或错误：${ageReply}`);
  }
  const abilityReply = await sendAndWait("你会什么？");
  if (abilityReply.length > 32) {
    throw new Error(`能力问题回答过长：${abilityReply}`);
  }
  const friendReply = await sendAndWait("你有几个朋友？");
  if (!friendReply.includes("小满") || friendReply.length > 40) {
    throw new Error(`朋友问题回答不正确或过长：${friendReply}`);
  }
  const punctuationReply = await sendAndWait("？");
  if (punctuationReply.length > 10) {
    throw new Error(`单独问号回复过长：${punctuationReply}`);
  }
  if (nameReply.length > 40 || cityReply.length > 40) {
    throw new Error(
      `事实问题回答过长：姓名 ${nameReply.length}，城市 ${cityReply.length}`,
    );
  }

  await page.getByRole("button", { name: "测试调参" }).click();
  const trustSlider = page.getByLabel("关系信任");
  await trustSlider.click();
  await trustSlider.press("End");
  await page.getByRole("button", { name: "平稳" }).click();
  await page.getByRole("button", { name: "关闭测试调参" }).click();
  const assistantCountBeforeAdvice = await page
    .locator(".message-row.assistant")
    .count();
  await sendAndWait("我觉得你应该报名陶艺市集，值得拿作品去试试。");
  await page.waitForFunction(
    () => !document.querySelector(".message-bubble.typing"),
    null,
    { timeout: timeoutMs },
  );
  const assistantCountAfterAdvice = await page
    .locator(".message-row.assistant")
    .count();
  const adviceMessageBubbles =
    assistantCountAfterAdvice - assistantCountBeforeAdvice;
  await page.getByRole("button", { name: "测试调参" }).click();
  await page.getByRole("button", { name: "恢复事件驱动" }).click();
  await page.getByRole("button", { name: "关闭测试调参" }).click();

  const emotionBefore = await page
    .locator(".emotion-summary")
    .innerText();
  const emotionValuesBefore = await page
    .locator(".state-grid strong")
    .allInnerTexts();
  const assistantCountBeforeDeferred = await page
    .locator(".message-row.assistant")
    .count();
  await page.getByRole("button", { name: "测试：+8 小时" }).click();
  await page.waitForFunction(
    (before) =>
      Array.from(document.querySelectorAll(".state-grid strong"))
        .map((element) => element.textContent?.trim() ?? "")
        .join("|") !== before,
    emotionValuesBefore.join("|"),
    { timeout: 5_000 },
  );
  const emotionAfter = await page.locator(".emotion-summary").innerText();
  const emotionValuesAfter = await page
    .locator(".state-grid strong")
    .allInnerTexts();
  if (!emotionAfter) throw new Error("情绪状态没有显示");
  if (emotionValuesAfter.join("|") === emotionValuesBefore.join("|")) {
    throw new Error("事件推进后情绪数值没有变化");
  }
  await composer.fill("先睡吧。你明天醒了记得回我。");
  await page.getByRole("button", { name: "发送消息" }).click();
  await page.waitForTimeout(650);
  await page.getByText(/1 条消息留给她/).waitFor();
  const assistantCountWhileSleeping = await page
    .locator(".message-row.assistant")
    .count();
  if (assistantCountWhileSleeping !== assistantCountBeforeDeferred) {
    throw new Error("阿岚睡觉时仍然立即生成了回复");
  }
  await page.getByRole("button", { name: "测试：+8 小时" }).click();
  await page.getByRole("button", { name: "测试：+1 小时" }).click();
  await page.waitForFunction(
    (previousCount) =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(
        ".message-row.assistant .message-bubble:not(.typing)",
      ).length > previousCount,
    assistantCountWhileSleeping,
    { timeout: timeoutMs },
  );
  const deferredReply = await page
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!deferredReply.trim()) {
    throw new Error("阿岚醒来后没有主动回复");
  }

  await page.getByRole("button", { name: /她的人生/ }).click();
  await page
    .getByRole("heading", { name: "她不是从认识你那天才出生。" })
    .waitFor();
  await page.getByText("因你而改变").waitFor();
  const decisionInfluenceVisible = await page
    .getByText("因你而改变")
    .isVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "output/playwright/life-story.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /共同记忆/ }).click();
  await page.getByRole("heading", { name: "被记住，也可以被忘记。" }).waitFor();

  await mkdir("output/playwright", { recursive: true });
  await page.waitForTimeout(450);
  await page.screenshot({
    path: "output/playwright/final-memory.png",
    fullPage: true,
  });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(timeoutMs);
  await mobilePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await mobilePage.evaluate(() => localStorage.clear());
  await mobilePage.reload({ waitUntil: "domcontentloaded" });
  await mobilePage.getByPlaceholder("输入名字或昵称").fill("阳阳");
  await mobilePage
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  const onboardingMetrics = await mobilePage.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) =>
        element.textContent?.includes("开始和阿岚恋爱"),
    );
    const box = button?.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      buttonBottom: box?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });
  if (onboardingMetrics.buttonBottom > onboardingMetrics.viewportHeight) {
    throw new Error(
      `手机首次体验按钮不在首屏：${JSON.stringify(onboardingMetrics)}`,
    );
  }
  await mobilePage
    .getByRole("button", { name: /开始和阿岚恋爱/ })
    .click();
  await mobilePage.waitForTimeout(450);

  const mobileLayout = await mobilePage.evaluate(() => {
    const composer = document.querySelector(".composer");
    const nav = document.querySelector(".mobile-nav");
    const composerBox = composer?.getBoundingClientRect();
    const navBox = nav?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      composerBottom: composerBox?.bottom || 0,
      navTop: navBox?.top || 0,
      desktopTabsVisible:
        getComputedStyle(document.querySelector(".tabbar")).display !== "none",
      testControlVisible: Array.from(document.querySelectorAll("button")).some(
        (element) => element.textContent?.trim() === "测试调参",
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });

  if (
    mobileLayout.horizontalOverflow ||
    mobileLayout.composerBottom > mobileLayout.navTop ||
    mobileLayout.desktopTabsVisible ||
    mobileLayout.testControlVisible
  ) {
    throw new Error(`移动端布局越界：${JSON.stringify(mobileLayout)}`);
  }

  await mobilePage.screenshot({
    path: "output/playwright/mobile-chat.png",
    fullPage: false,
  });
  await mobilePage.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await mobilePage.getByRole("button", { name: "测试调参" }).click();
  await mobilePage.waitForTimeout(350);
  await mobilePage.screenshot({
    path: "output/playwright/mobile-emotion-controls.png",
    fullPage: false,
  });
  await mobilePage
    .getByRole("button", { name: "关闭测试调参" })
    .click();
  await mobilePage
    .locator(".mobile-nav")
    .getByRole("button", { name: /人生/ })
    .click();
  await mobilePage.waitForTimeout(350);
  await mobilePage.screenshot({
    path: "output/playwright/mobile-life-story.png",
    fullPage: false,
  });

  const controlContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const controlPage = await controlContext.newPage();
  controlPage.setDefaultTimeout(timeoutMs);
  await controlPage.clock.install({
    time: new Date("2026-10-21T10:00:00+08:00"),
  });
  await controlPage.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await controlPage.evaluate(() => localStorage.clear());
  await controlPage.reload({ waitUntil: "domcontentloaded" });
  await controlPage.getByPlaceholder("输入名字或昵称").fill("测试者");
  await controlPage
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  await controlPage
    .getByRole("button", { name: /开始和阿岚恋爱/ })
    .click();
  await controlPage.getByRole("button", { name: "测试：+8 小时" }).click();
  await controlPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await controlPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await controlPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await controlPage.getByRole("button", { name: "测试调参" }).click();
  await controlPage.getByRole("button", { name: "低电量" }).click();
  const quietValues = await controlPage
    .locator(".emotion-slider strong")
    .allInnerTexts();
  if (
    !quietValues[1]?.includes("52") ||
    !quietValues[2]?.includes("28") ||
    !quietValues[3]?.includes("12")
  ) {
    throw new Error(`“低电量”预设数值错误：${quietValues.join(" / ")}`);
  }
  await controlPage.getByRole("button", { name: "关闭测试调参" }).click();
  await controlPage
    .getByPlaceholder("说点什么，或者告诉她一件事……")
    .fill("在吗");
  await controlPage.getByRole("button", { name: "发送消息" }).click();
  await controlPage.waitForFunction(
    () =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(".message-row.assistant").length >= 2,
    null,
    { timeout: timeoutMs },
  );
  const lowBatteryReply = await controlPage
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!lowBatteryReply.trim()) {
    throw new Error("低社交电量时错误地阻止了回复");
  }
  await controlPage.getByRole("button", { name: "测试调参" }).click();
  await controlPage.getByRole("button", { name: "平稳" }).click();
  const steadyValues = await controlPage
    .locator(".emotion-slider strong")
    .allInnerTexts();
  if (
    !steadyValues[0]?.includes("平稳") ||
    !steadyValues[1]?.includes("30") ||
    !steadyValues[2]?.includes("70") ||
    !steadyValues[3]?.includes("70")
  ) {
    throw new Error(`“平稳”预设数值错误：${steadyValues.join(" / ")}`);
  }
  await controlPage.screenshot({
    path: "output/playwright/emotion-controls.png",
    fullPage: false,
  });

  const interactionContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const interactionPage = await interactionContext.newPage();
  interactionPage.setDefaultTimeout(timeoutMs);
  await interactionPage.clock.install({
    time: new Date("2026-10-21T10:00:00+08:00"),
  });
  await interactionPage.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await interactionPage.evaluate(() => localStorage.clear());
  await interactionPage.reload({ waitUntil: "domcontentloaded" });
  await interactionPage
    .getByPlaceholder("输入名字或昵称")
    .fill("测试者");
  await interactionPage
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  await interactionPage
    .getByRole("button", { name: /开始和阿岚恋爱/ })
    .click();
  await interactionPage.getByRole("button", { name: "测试：+8 小时" }).click();
  await interactionPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await interactionPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await interactionPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await interactionPage.waitForTimeout(500);

  const interactionInput = interactionPage.getByPlaceholder(
    "说点什么，或者告诉她一件事……",
  );
  const sendInteraction = async (text) => {
    const count = await interactionPage
      .locator(".message-row.assistant")
      .count();
    await interactionInput.fill(text);
    await interactionPage.getByRole("button", { name: "发送消息" }).click();
    await interactionPage.waitForFunction(
      (previous) =>
        !document.querySelector(".message-bubble.typing") &&
        document.querySelectorAll(
          ".message-row.assistant .message-bubble:not(.typing)",
        ).length > previous,
      count,
      { timeout: timeoutMs },
    );
    return interactionPage
      .locator(".message-row.assistant .message-bubble")
      .last()
      .innerText();
  };

  const stressBefore = Number(
    (await interactionPage.locator(".state-grid strong").nth(1).innerText())
      .replace("%", ""),
  );
  const repeatedReplies = [];
  for (let index = 0; index < 3; index += 1) {
    repeatedReplies.push(await sendInteraction("你会什么"));
  }
  const stressAfterRepeat = Number(
    (await interactionPage.locator(".state-grid strong").nth(1).innerText())
      .replace("%", ""),
  );
  const guardedRead = await interactionPage
    .locator(".judgment-summary > p")
    .innerText();
  if (
    stressAfterRepeat <= stressBefore ||
    !/(反复|试探|审问)/.test(guardedRead)
  ) {
    throw new Error(
      `连续追问没有影响情绪或判断：压力 ${stressBefore} -> ${stressAfterRepeat}，判断 ${guardedRead}`,
    );
  }

  await sendInteraction(
    "我理解你需要空间，刚才一直重复问你，是我没注意。",
  );
  const repairedRead = await interactionPage
    .locator(".judgment-summary > p")
    .innerText();
  if (!/(拉回来|认真听|尊重)/.test(repairedRead)) {
    throw new Error(`尊重边界后关系判断没有修复：${repairedRead}`);
  }
  const interactionReplies = await interactionPage
    .locator(".message-row.assistant .message-bubble")
    .allInnerTexts();
  if (
    interactionReplies.some((reply) =>
      reply.includes("我在听。你不用一次说清楚，先说最难受的那一句就行。"),
    )
  ) {
    throw new Error("聊天中仍然出现旧的固定兜底模板");
  }

  const turnContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const turnPage = await turnContext.newPage();
  turnPage.setDefaultTimeout(timeoutMs);
  await turnPage.clock.install({
    time: new Date("2026-10-21T10:00:00+08:00"),
  });
  await turnPage.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await turnPage.evaluate(() => localStorage.clear());
  await turnPage.reload({ waitUntil: "domcontentloaded" });
  await turnPage.getByPlaceholder("输入名字或昵称").fill("测试者");
  await turnPage
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  await turnPage
    .getByRole("button", { name: /开始和阿岚恋爱/ })
    .click();
  await turnPage.getByRole("button", { name: "测试：+8 小时" }).click();
  await turnPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await turnPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await turnPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await turnPage.getByRole("button", { name: "测试调参" }).click();
  await turnPage.getByRole("button", { name: "平稳" }).click();
  await turnPage.getByRole("button", { name: "关闭测试调参" }).click();

  const turnInput = turnPage.getByPlaceholder(
    "说点什么，或者告诉她一件事……",
  );
  await turnInput.fill("你做什么工作的？");
  await turnPage.getByRole("button", { name: "发送消息" }).click();
  await turnPage.waitForTimeout(120);
  await turnInput.fill("你现在住在哪个城市？");
  await turnPage.getByRole("button", { name: "发送消息" }).click();
  await turnPage.getByText(/1 条消息留给她/).waitFor();
  await turnPage.waitForFunction(
    () =>
      !document.querySelector(".message-bubble.typing") &&
      !document.querySelector(".delivery-queue") &&
      document.querySelectorAll(".message-row.assistant").length >= 3,
    null,
    { timeout: timeoutMs },
  );
  const queuedUserTurnVerified = true;

  const genderContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const genderPage = await genderContext.newPage();
  genderPage.setDefaultTimeout(timeoutMs);
  await genderPage.clock.install({
    time: new Date("2026-10-21T10:00:00+08:00"),
  });
  await genderPage.goto(testBaseUrl, { waitUntil: "domcontentloaded" });
  await genderPage.evaluate(() => localStorage.clear());
  await genderPage.reload({ waitUntil: "domcontentloaded" });
  await genderPage.getByRole("button", { name: /男性/ }).click();
  await genderPage
    .getByPlaceholder("输入名字或昵称")
    .fill("性别测试");
  await genderPage
    .getByText("我已年满 18 岁，并理解这是 AI 模拟体验。")
    .click();
  await genderPage.screenshot({
    path: "output/playwright/gender-select.png",
    fullPage: false,
  });
  await genderPage
    .getByRole("button", { name: /开始和阿川恋爱/ })
    .click();
  await genderPage.getByRole("heading", { name: "阿川" }).waitFor();
  await genderPage.getByRole("button", { name: "测试：+8 小时" }).click();
  await genderPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await genderPage.getByRole("button", { name: "测试：+1 小时" }).click();
  await genderPage.getByRole("button", { name: "测试：+1 小时" }).click();
  const maleInput = genderPage.getByPlaceholder(
    "说点什么，或者告诉他一件事……",
  );
  await maleInput.fill("你叫什么名字？");
  await genderPage.getByRole("button", { name: "发送消息" }).click();
  await genderPage.waitForFunction(
    () =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(".message-row.assistant").length >= 2,
    null,
    { timeout: timeoutMs },
  );
  const maleNameReply = await genderPage
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!maleNameReply.includes("阿川")) {
    throw new Error(`男性角色姓名不正确：${maleNameReply}`);
  }
  await maleInput.fill("你小时候在哪里读书？");
  await genderPage.getByRole("button", { name: "发送消息" }).click();
  await genderPage.waitForFunction(
    () =>
      !document.querySelector(".message-bubble.typing") &&
      document.querySelectorAll(".message-row.assistant").length >= 3,
    null,
    { timeout: timeoutMs },
  );
  const maleSchoolReply = await genderPage
    .locator(".message-row.assistant .message-bubble")
    .last()
    .innerText();
  if (!maleSchoolReply.includes("苏州")) {
    throw new Error(`男性角色人生底稿不正确：${maleSchoolReply}`);
  }
  await genderPage.screenshot({
    path: "output/playwright/male-profile.png",
    fullPage: false,
  });

  const genderMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const genderMobilePage = await genderMobileContext.newPage();
  await genderMobilePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await genderMobilePage.evaluate(() => localStorage.clear());
  await genderMobilePage.reload({ waitUntil: "domcontentloaded" });
  await genderMobilePage.getByRole("button", { name: /男性/ }).click();
  const genderMobileLayout = await genderMobilePage.evaluate(() => ({
    horizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    visibleGenderButtons: [...document.querySelectorAll(".gender-options button")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length,
  }));
  if (
    genderMobileLayout.horizontalOverflow ||
    genderMobileLayout.visibleGenderButtons !== 2
  ) {
    throw new Error(
      `移动端性别选择布局异常：${JSON.stringify(genderMobileLayout)}`,
    );
  }
  await genderMobilePage.screenshot({
    path: "output/playwright/mobile-gender-select.png",
    fullPage: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        worldClock: { firstTime, secondTime, pausedTime },
        nameReply,
        controlReply,
        casualReply,
        originReply,
        persistedNameReply,
        cityReply,
        schoolReply,
        careerReply,
        ageReply,
        abilityReply,
        friendReply,
        punctuationReply,
        decisionInfluenceVisible,
        adviceMessageBubbles,
        memoryTabLabel,
        deferredReply,
        emotionBefore,
        emotionAfter,
        emotionValuesBefore,
        emotionValuesAfter,
        screenshot: "output/playwright/final-memory.png",
        mobileScreenshot: "output/playwright/mobile-chat.png",
        emotionControlScreenshot:
          "output/playwright/emotion-controls.png",
        mobileEmotionControlScreenshot:
          "output/playwright/mobile-emotion-controls.png",
        lifeStoryScreenshot: "output/playwright/life-story.png",
        mobileLifeStoryScreenshot:
          "output/playwright/mobile-life-story.png",
        mobileLayout,
        emotionControls: { quietValues, steadyValues },
        lowBatteryReply,
        interactionDynamics: {
          repeatedReplies,
          stressBefore,
          stressAfterRepeat,
          guardedRead,
          repairedRead,
        },
        queuedUserTurnVerified,
        maleNameReply,
        maleSchoolReply,
        genderSelectionScreenshot: "output/playwright/gender-select.png",
        maleProfileScreenshot: "output/playwright/male-profile.png",
        genderMobileLayout,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
