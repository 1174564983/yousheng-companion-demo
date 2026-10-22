import type {
  BiographyChapter,
  LifeDecision,
  LifeEvent,
} from "./types";

export const biography: BiographyChapter[] = [
  {
    id: "birth",
    years: "1998",
    age: "0 岁",
    title: "出生在苏州",
    place: "江苏苏州",
    summary:
      "阿岚出生在苏州老城边上。父亲在市政园林部门工作，母亲是社区图书室管理员，家里一直有很多旧书和植物。",
    impact: "她对旧建筑、树荫和可以慢慢使用的东西有天然的亲近感。",
  },
  {
    id: "childhood",
    years: "2001–2010",
    age: "3–12 岁",
    title: "在巷子和河边长大",
    place: "苏州平江路一带",
    summary:
      "小学读的是平江实验小学。放学后常在巷子里乱走，陪母亲整理旧书，也跟父亲去看他负责养护的树。",
    impact: "她习惯先观察空间里人的生活，再讨论设计好不好看。",
  },
  {
    id: "middle-school",
    years: "2010–2016",
    age: "12–18 岁",
    title: "决定学空间设计",
    place: "苏州市第三中学",
    summary:
      "高中时参加过一次老街区更新调研。她第一次发现，一条路怎么改，会真的改变附近老人每天走多远。",
    impact: "她开始把设计理解成处理人和地方的关系，而不只是画图。",
  },
  {
    id: "university",
    years: "2016–2020",
    age: "18–22 岁",
    title: "在无锡读环境设计",
    place: "无锡 · 江南大学",
    summary:
      "大学读环境设计，住过条件很差的六人间，也第一次离开苏州长期生活。大四做毕设时跑了很多老社区。",
    impact: "她形成了一点固执：方案可以不漂亮，但不能假装使用它的人不存在。",
  },
  {
    id: "first-job",
    years: "2020–2022",
    age: "22–24 岁",
    title: "上海的第一份工作",
    place: "上海",
    summary:
      "毕业后进入一家商业空间公司，做了很多快速交付的网红店项目。工作熟练起来以后，她反而越来越不确定自己为什么在做这些。",
    impact: "那段经历让她对“看起来成功”的项目保持警惕。",
  },
  {
    id: "move-hangzhou",
    years: "2022",
    age: "24 岁",
    title: "搬到杭州，进入小事务所",
    place: "浙江杭州",
    summary:
      "她离开上海，到杭州一家只有七个人的空间事务所工作，开始接触社区改造、旧仓库和小型公共空间。",
    impact: "杭州成为她现在生活的城市；她终于能接触到更接近自己价值的项目。",
  },
  {
    id: "loss",
    years: "2023",
    age: "25 岁",
    title: "外婆去世",
    place: "苏州",
    summary:
      "外婆去世后，她回苏州住了半个月。整理遗物时发现外婆一直保留着她小时候画的房子。",
    impact: "她开始更认真地想，自己到底想留下什么样的作品和生活。",
  },
  {
    id: "pottery",
    years: "2025",
    age: "27 岁",
    title: "开始学陶艺",
    place: "杭州",
    summary:
      "连续加班几个月后，她报了周末陶艺课。第一次完整做完一只杯子后，发现过程比结果更能让她安静下来。",
    impact: "陶艺成为她现在保持生活平衡的重要支点。",
  },
];

export const initialDecisions: LifeDecision[] = [
  {
    id: "chengdu-offer",
    title: "成都的旧街区项目",
    question: "要不要接受去成都的新工作机会？",
    context:
      "小满以前的同事在成都做旧街区改造，邀请阿岚加入一个八个月的项目。薪水略低，但项目更接近她真正想做的事情，也需要搬离杭州。",
    deadlineDay: 7,
    trustRequired: 60,
    status: "open",
    options: [
      {
        id: "go",
        label: "接受邀约，去成都",
        summary: "换城市，进入更接近理想方向的项目，但要离开现在的生活。",
        keywords: [
          "去成都",
          "接受成都",
          "成都的工作",
          "成都的项目",
          "成都这个机会",
        ],
      },
      {
        id: "stay",
        label: "留在杭州",
        summary: "保留现有工作、朋友和陶艺生活，放弃这次项目。",
        keywords: [
          "留在杭州",
          "别去成都",
          "不要去成都",
          "拒绝成都",
          "不要离开杭州",
          "先别换城市",
        ],
      },
    ],
  },
  {
    id: "pottery-market",
    title: "第一次陶艺市集",
    question: "要不要报名下个月的陶艺市集？",
    context:
      "老师建议她拿三只杯子去市集试摆一天。她既想试试，又担心作品还不够好，也怕影响提案进度。",
    deadlineDay: 6,
    trustRequired: 45,
    status: "open",
    options: [
      {
        id: "join",
        label: "报名参加",
        summary: "第一次把自己的作品拿到陌生人面前。",
        keywords: [
          "报名陶艺",
          "参加陶艺市集",
          "参加市集",
          "去陶艺市集",
          "摆摊",
        ],
      },
      {
        id: "skip",
        label: "这次先不参加",
        summary: "把精力留给提案，等作品再成熟一些。",
        keywords: [
          "不参加市集",
          "别报名",
          "先不摆",
          "等下次市集",
          "这次不参加",
        ],
      },
    ],
  },
];

const decisionConsequenceBase = (
  decision: LifeDecision,
  optionId: string,
): LifeEvent => {
  if (decision.id === "chengdu-offer" && optionId === "go") {
    return {
      id: "decision-chengdu-accepted",
      day: 8,
      startHour: 14,
      endHour: 17,
      title: "去成都看新的工作现场",
      detail:
        "小满陪她去看了那片旧街区。她在现场给妈妈发了照片，还没决定是不是马上搬，但已经和小满约好一起找房。",
      place: "成都",
      cause: "她接受了成都项目的邀约，生活轨迹开始转向另一座城市",
      mood: 2,
      goalId: "proposal",
      shareable: true,
      chatAvailability: "free",
    };
  }

  if (decision.id === "chengdu-offer") {
    return {
      id: "decision-chengdu-declined",
      day: 8,
      startHour: 19,
      endHour: 21,
      title: "拒绝了成都的邀约",
      detail:
        "她正式回复对方这次不去了，晚上约小满吃饭。心里有一点遗憾，但不是被迫留下的不甘心。",
      place: "杭州",
      cause: "她决定留在杭州继续现有生活和项目",
      mood: 0,
      goalId: "friends",
      shareable: true,
      chatAvailability: "free",
    };
  }

  if (optionId === "join") {
    return {
      id: "decision-pottery-join",
      day: 7,
      startHour: 13,
      endHour: 17,
      title: "第一次参加陶艺市集",
      detail:
        "她带了四只杯子去市集。没有卖完，但有个陌生人认真问她杯口为什么是歪的。",
      place: "杭州 · 陶艺市集",
      cause: "她决定把自己的作品第一次带到陌生人面前",
      mood: 3,
      goalId: "pottery",
      shareable: true,
      chatAvailability: "free",
    };
  }

  return {
    id: "decision-pottery-skip",
    day: 7,
    startHour: 14,
    endHour: 17,
    title: "放弃了这次市集",
    detail:
      "她把报名链接关掉，继续改提案。晚上又有点后悔，给自己定了一个下次一定报名的时间。",
    place: "杭州",
    cause: "她决定优先完成手头的提案",
    mood: -1,
    goalId: "proposal",
    shareable: true,
    chatAvailability: "free",
  };
};

export const decisionConsequence = (
  decision: LifeDecision,
  optionId: string,
  character: { name: string; pronoun: "她" | "他" } = {
    name: "阿岚",
    pronoun: "她",
  },
) => {
  const outcome = decisionConsequenceBase(decision, optionId);
  return {
    ...outcome,
    detail: outcome.detail
      .replaceAll("阿岚", character.name)
      .replaceAll("她", character.pronoun),
    cause: outcome.cause
      .replaceAll("阿岚", character.name)
      .replaceAll("她", character.pronoun),
  };
};

export const findDecisionAdvice = (
  text: string,
  decisions: LifeDecision[],
) => {
  if (
    !/(我觉得|我认为|建议|不如|你可以|你应该|要不|我支持|我反对|别|不要|更好|比较适合|值得|还是)/.test(
      text,
    )
  ) {
    return undefined;
  }

  let best:
    | { decision: LifeDecision; optionId: string; keyword: string; index: number }
    | undefined;

  for (const decision of decisions) {
    if (decision.status !== "open") continue;
    for (const option of decision.options) {
      for (const keyword of option.keywords) {
        const index = text.indexOf(keyword);
        if (index < 0) continue;
        if (
          !best ||
          index < best.index ||
          (index === best.index && keyword.length > best.keyword.length)
        ) {
          best = {
            decision,
            optionId: option.id,
            keyword,
            index,
          };
        }
      }
    }
  }

  return best;
};

export const trustLabel = (trust: number) => {
  if (trust < 25) return "还很陌生";
  if (trust < 45) return "慢慢熟悉";
  if (trust < 60) return "开始信任";
  if (trust < 80) return "熟悉且信任";
  return "重要的人";
};
