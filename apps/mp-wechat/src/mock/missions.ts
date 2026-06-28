import {
  AGE_BAND_MAP,
  DIFFICULTY_MAP,
  PUZZLE_TYPE_MAP,
  TASK_KIND_MAP,
} from "@/mock/schema"
import type {
  AgeBand,
  DifficultyLevel,
  HintLevel,
  MissionDetail,
  MissionPuzzle,
  MissionRouteCard,
  MissionSchemaMeta,
  PuzzleTemplateType,
  TaskKind,
} from "@/types/mission"

interface MissionSeed {
  id: string
  routeCode: string
  title: string
  theme: string
  summary: string
  highlight: string
  recommendedAgeBand: AgeBand
  availableAgeBands: AgeBand[]
  difficultyLevel: DifficultyLevel
  taskKind: TaskKind
  estimatedMinutes: number
  rewardTitle: string
  startLocation: string
  badgeLabel: string
  museumName: string
  taglines: string[]
  persona: {
    id: string
    code: string
    name: string
    intro: string
    avatar: string
    voiceStyle: string
  }
  introNarrative: string
  playbook: string[]
  rewardPreview: string[]
  chapterTitles: string[]
  locations: string[]
  objectives: string[]
  artifactTitles: string[]
  observationPoints: string[]
  storyFragments: string[]
  suspiciousPoints: string[]
  detailCallouts: string[]
  checklists: string[][]
  observeOptions: string[]
  clueHotspots: string[]
  sortItems: string[]
  matchPairs: Array<{ left: string; right: string }>
  clueTitles: string[]
  fragmentTitles: string[]
  knowledgeNotes: string[]
  finaleTitle: string
  finaleTruth: string
  finaleDebrief: string
  shareLine: string
  code: string
}

const TEMPLATE_SEQUENCE: Array<{
  templateType: PuzzleTemplateType
  difficultyLevel: DifficultyLevel
}> = [
  { templateType: "observe_choice", difficultyLevel: "L1" },
  { templateType: "clue_find", difficultyLevel: "L1" },
  { templateType: "sort", difficultyLevel: "L2" },
  { templateType: "match", difficultyLevel: "L2" },
  { templateType: "code_break", difficultyLevel: "L3" },
]

const MISSION_SEEDS: MissionSeed[] = [
  {
    id: "route-dragon",
    routeCode: "R-DRAGON-01",
    title: "失落的龙纹密令",
    theme: "亲子冒险",
    summary: "跟着导览角色在馆内追查一串被拆散的龙纹暗号，让孩子在每个展点都先观察再作答。",
    highlight: "每章 1 题，五种渲染器全覆盖，适合 20-30 分钟家庭共玩。",
    recommendedAgeBand: "6-10",
    availableAgeBands: ["6-10", "10-15"],
    difficultyLevel: "L2",
    taskKind: "family_adventure",
    estimatedMinutes: 28,
    rewardTitle: "龙纹守护者徽章",
    startLocation: "东馆 1F 龙纹厅入口",
    badgeLabel: "家庭推荐",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["观察先行", "亲子共玩", "章节推进"],
    persona: {
      id: "persona-nanmu",
      code: "nanmu-guide",
      name: "楠木引路人",
      intro: "用简洁线索带游客进入展厅秘密的向导。",
      avatar: "楠",
      voiceStyle: "温和、鼓励式",
    },
    introNarrative: "龙纹密码被拆成了五段，只有沿着展柜里的细节一路找回，才能重新点亮终点的封印。",
    playbook: ["先观察展品再答题", "卡住时先看观察提示", "每完成一章都能拿到一段密令碎片"],
    rewardPreview: ["龙纹守护者徽章", "线索碎片图鉴", "终局成绩卡"],
    chapterTitles: ["龙纹初现", "刻痕回声", "工艺顺序", "图样配对", "封匣解码"],
    locations: [
      "龙纹厅 1 号展柜",
      "龙纹厅 3 号转角柜",
      "工艺长廊中段",
      "纹样对照墙",
      "东馆终章封匣台",
    ],
    objectives: [
      "找出真正的龙纹起点。",
      "锁定被故意遮住的细节。",
      "按线索还原工艺观察路径。",
      "把纹样和含义一一对应。",
      "用前四章碎片破解封匣密码。",
    ],
    artifactTitles: ["鎏金龙纹壶", "青玉云纹佩", "彩绘屏风残片", "龙舟铜鼓", "龙纹封匣"],
    observationPoints: [
      "先看器口附近最显眼的一段主纹。",
      "注意边缘修补处和编号压印。",
      "找出工艺步骤留下的顺序痕迹。",
      "比较纹样名称和它们所代表的功能。",
      "回忆前面四章拿到的所有碎片。",
    ],
    storyFragments: [
      "第一位修复师只留下了一个最明显的龙角提示。",
      "第二段密令藏在后来补刻的一处编号里。",
      "第三段要求你按观察顺序串起制作线索。",
      "第四段要把图样和用途关系重新连上。",
      "终局封匣只接受完整顺序下得到的密码。",
    ],
    suspiciousPoints: [
      "看起来最花哨的纹样不一定是真线索。",
      "真正的痕迹往往藏在修补线和编号附近。",
      "顺序题要从观察动作出发，不是猜故事结尾。",
      "配对时优先看纹样和使用场景的关系。",
      "最终密码来自前四章碎片，不在封匣表面。",
    ],
    detailCallouts: [
      "主纹旁边有一段明显更深的刻线。",
      "修补痕的边缘压着一串小编号。",
      "屏风表面留下了由浅到深的加工层次。",
      "对照墙把图样和用途分在了两列。",
      "封匣的四个槽位只接受定长密码。",
    ],
    checklists: [
      ["数一数主纹分叉", "对比龙首方向", "不要被边框花纹干扰"],
      ["先看补色区域", "再找编号位置", "留意最短的一条裂痕"],
      ["从最先发生的步骤开始", "每一步都要有前后关系", "最后一项应该指向记录印记"],
      ["先选左列纹样", "再找右列对应用途", "出现冲突时回看故事片段"],
      ["整理前四章碎片", "按得到顺序拼接", "再输入封匣"],
    ],
    observeOptions: ["卷草纹边", "回首单龙", "莲瓣纹心", "山形底座"],
    clueHotspots: ["残缺龙角", "暗刻编号", "补色裂痕", "错位金线"],
    sortItems: ["先看龙首朝向", "再数主纹分叉", "接着核对边缘补色", "最后记录底部印记"],
    matchPairs: [
      { left: "回首龙纹", right: "指向起点展柜" },
      { left: "水波云纹", right: "提示下一站方向" },
      { left: "铜鼓鼓点", right: "对应章节节奏" },
      { left: "封匣锁孔", right: "承接最终密码" },
    ],
    clueTitles: ["龙首刻痕", "编号暗记", "工艺路径", "纹样关系", "封匣真相"],
    fragmentTitles: ["龙角碎片", "编号碎片", "顺序碎片", "图样碎片", "守护印记"],
    knowledgeNotes: [
      "龙纹在不同器物上承担礼制、装饰和叙事三种角色。",
      "修复痕迹本身也会成为展览中的重要信息。",
      "工艺顺序决定了游客应该如何观察展品。",
    ],
    finaleTitle: "龙纹归位",
    finaleTruth: "真正的密令不是某一件展品，而是整条展线教你掌握的观察顺序。",
    finaleDebrief: "你从纹样、编号、工艺和用途一路拼回了同一条线索，封匣因此重新打开。",
    shareLine: "我们把龙纹密令找回来了。",
    code: "2741",
  },
  {
    id: "route-scroll",
    routeCode: "R-SCROLL-02",
    title: "画卷背后的消失人物",
    theme: "剧情推理",
    summary: "通过题跋、服饰和时代信息追查古画里被抹去的人物，路线更偏叙事和证据关联。",
    highlight: "更强调线索关联和剧情反转，适合校园线与剧情型游客。",
    recommendedAgeBand: "10-15",
    availableAgeBands: ["10-15", "15+"],
    difficultyLevel: "L2",
    taskKind: "story_detective",
    estimatedMinutes: 32,
    rewardTitle: "画境侦探称号",
    startLocation: "西馆 2F 长卷展厅入口",
    badgeLabel: "剧情推荐",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["剧情推进", "证据关联", "中段高反馈"],
    persona: {
      id: "persona-yingluo",
      code: "yingluo-archivist",
      name: "影落档案员",
      intro: "擅长把断裂的故事重新拼回完整档案。",
      avatar: "影",
      voiceStyle: "冷静、带悬念",
    },
    introNarrative: "一幅名作里的关键人物被后世抹去了身份信息，档案员要你在五个展点里找回他的真实位置。",
    playbook: ["先确认画面证据", "中段多用关系提示连接人物和时代", "终局只保留一个关键判断"],
    rewardPreview: ["画境侦探称号", "人物档案碎片", "结案成绩卡"],
    chapterTitles: ["被抹去的署名", "衣纹疑点", "事件时间线", "角色关系网", "结案档案"],
    locations: [
      "长卷厅 A 面主画墙",
      "服饰细节台",
      "时代对照屏",
      "关系档案桌",
      "案卷封存柜",
    ],
    objectives: [
      "锁定第一处被改写的署名。",
      "找到最能证明身份的服饰细节。",
      "按事件发生先后整理画卷证据。",
      "把人物与关系角色对应起来。",
      "组合证据完成结案密码。",
    ],
    artifactTitles: ["设色人物长卷", "官服补绣片", "题跋手札", "宴饮图册", "密封案卷"],
    observationPoints: [
      "不要先看主角，要先看被抹去的角落署名。",
      "服饰上的补绣更能说明身份变化。",
      "时间线来自多处旁证，不在一段文字里。",
      "角色关系要通过立场和动作来判断。",
      "案卷密码由前四章的证据首字组成。",
    ],
    storyFragments: [
      "最早被动手脚的是画卷右下角的一枚署名。",
      "补绣不是修饰，而是身份被更改的痕迹。",
      "题跋和画中动作能拼出真实的事件顺序。",
      "四位关键人物各自留下了不同立场。",
      "密封案卷只会对完整证据链开启。",
    ],
    suspiciousPoints: [
      "最显眼的位置反而可能是伪线索。",
      "服饰和纹章比表情更可靠。",
      "排序题不按年份猜，要按证据出现顺序。",
      "关系配对看的是身份功能，不是亲疏远近。",
      "终局必须把首字顺序和案卷槽位对齐。",
    ],
    detailCallouts: [
      "右下角的墨迹颜色与原作不一致。",
      "补绣边缘留下了不属于同一时期的丝线。",
      "题跋手札中有两句被分开放置。",
      "档案桌左侧放人物，右侧放他们在事件里的职责。",
      "案卷锁位会提示你缺了哪一段证据。",
    ],
    checklists: [
      ["观察墨色差异", "看署名位置是否顺手", "对比旁边空白"],
      ["先找补绣边缘", "再核对纹章位置", "不要只盯颜色"],
      ["挑出最早的文字证据", "再接动作证据", "最后补上题跋"],
      ["确认角色身份", "再选他们对应的职责", "避免同义词干扰"],
      ["把前四章首字按顺序记下", "只输入四位", "留意档案锁位提示"],
    ],
    observeOptions: ["边框压印", "被擦重写的署名", "主角衣袖", "画轴末端"],
    clueHotspots: ["发簪纹章", "补绣丝线", "肩部褶痕", "袖口缝边"],
    sortItems: ["发现被改写署名", "锁定补绣身份", "拼出题跋先后", "得到人物真名"],
    matchPairs: [
      { left: "抄录者", right: "负责改写署名" },
      { left: "侍从", right: "隐藏了服饰证据" },
      { left: "主角", right: "真正被抹去身份" },
      { left: "档案员", right: "负责封存案卷" },
    ],
    clueTitles: ["署名差异", "服饰证据", "时间顺序", "关系职责", "人物真名"],
    fragmentTitles: ["墨色碎片", "丝线碎片", "顺序碎片", "关系碎片", "结案印章"],
    knowledgeNotes: [
      "古画中的题跋、服饰和空白区域都是有效证据。",
      "同一幅画往往会在后世经历重写和再解释。",
      "叙事型路线更适合把观察题和关系题串在一起。",
    ],
    finaleTitle: "人物归档",
    finaleTruth: "消失的人物并不是从画里消失，而是被后世的解释层层覆盖。",
    finaleDebrief: "你用署名、服饰、时间线和关系网重新找回了被隐藏的身份信息。",
    shareLine: "我们替古画找回了失踪人物。",
    code: "5138",
  },
  {
    id: "route-timeline",
    routeCode: "R-TIME-03",
    title: "谁改写了王朝时间线",
    theme: "深度推理",
    summary: "面对多件年代互相矛盾的馆藏，你需要重构事件链，找出错误被植入的节点。",
    highlight: "以成人路线和高阶玩家为主，终局更强调多线索回收。",
    recommendedAgeBand: "15+",
    availableAgeBands: ["15+"],
    difficultyLevel: "L3",
    taskKind: "deep_reasoning",
    estimatedMinutes: 36,
    rewardTitle: "时序解码者称号",
    startLocation: "北馆 3F 编年展厅入口",
    badgeLabel: "高阶挑战",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["高知识密度", "终局强化", "多线索回收"],
    persona: {
      id: "persona-shichen",
      code: "shichen-curator",
      name: "时辰策展人",
      intro: "负责修补历史时间线里的错位节点。",
      avatar: "时",
      voiceStyle: "克制、判断式",
    },
    introNarrative: "编年展厅里出现了四段互相矛盾的年代描述，只有修复完整的时间链，错误来源才会暴露。",
    playbook: ["不要急着下结论，先标记每条证据的位置", "中段排序和配对决定终局难度", "终局密码来自四个校正后的年代片段"],
    rewardPreview: ["时序解码者称号", "校正碎片图鉴", "深度路线成绩卡"],
    chapterTitles: ["异常铭文", "错置纪年", "事件重排", "证据归档", "王朝校正"],
    locations: [
      "编年展厅 A1 石刻区",
      "纪年铜镜台",
      "事件重构屏",
      "证据归档架",
      "王朝校正台",
    ],
    objectives: [
      "确认最早出现矛盾的铭文。",
      "找出真正错置的纪年细节。",
      "把事件节点按正确先后重排。",
      "将证据与其证明作用对应起来。",
      "用四段校正结果完成时间线校验。",
    ],
    artifactTitles: ["边塞石刻", "纪年铜镜", "诏令简册", "礼制器册页", "校正仪盘"],
    observationPoints: [
      "从最早矛盾出现的边角铭文看起。",
      "纪年题不要只看年份，要看格式和书写习惯。",
      "排序时先排证据强度，再排时间。",
      "证据配对要明确它证明的是人、事还是年代。",
      "校正仪盘只接受四段被修正后的结果。",
    ],
    storyFragments: [
      "错位时间线并不是整体伪造，而是从一处铭文开始松动。",
      "纪年的书写方式暴露了它不属于原时代。",
      "事件次序一旦排对，冲突会自然消失。",
      "归档阶段要给每条证据分配清晰作用。",
      "校正仪盘会检验你是否真正理解了冲突来源。",
    ],
    suspiciousPoints: [
      "最完整的铭文不一定最可靠。",
      "年份数字相同，也可能是后世转写。",
      "排序题要先判断证据权重。",
      "配对错了会直接影响终局密码片段。",
      "最终密码来自校正后的四段纪年。",
    ],
    detailCallouts: [
      "石刻阴刻深浅不一，说明曾被二次处理。",
      "铜镜背面的纪年格式与同厅器物不同。",
      "事件重构屏把节点拆成了四张卡片。",
      "归档架一列放证据，一列放它证明的作用。",
      "校正仪盘把密码槽位做成了四段刻度。",
    ],
    checklists: [
      ["看刻痕深浅", "找最早被修改的位置", "对比同排字形"],
      ["先看纪年格式", "再看书写习惯", "最后比对同类器物"],
      ["先排最强证据", "再排中间节点", "最后确认结果指向"],
      ["区分证明对象", "不要把年代和人物混淆", "冲突时回看前两章"],
      ["整合四段校正片段", "确保长度一致", "再输入仪盘"],
    ],
    observeOptions: ["完整主铭文", "边角补刻字", "中心图案", "旁边说明牌"],
    clueHotspots: ["旧刻痕", "错置纪年", "转写笔锋", "边框裂口"],
    sortItems: ["锁定异常铭文", "识别错置纪年", "重排事件节点", "完成时间校正"],
    matchPairs: [
      { left: "石刻阴刻", right: "证明铭文被二次处理" },
      { left: "铜镜纪年", right: "证明年份格式错置" },
      { left: "简册诏令", right: "证明事件先后关系" },
      { left: "礼制器册页", right: "证明王朝礼制背景" },
    ],
    clueTitles: ["异常铭文", "纪年格式", "事件顺序", "证据作用", "校正完成"],
    fragmentTitles: ["铭文碎片", "纪年碎片", "时序碎片", "归档碎片", "校正密章"],
    knowledgeNotes: [
      "年代判断不仅看数字，还要看书写习惯与器物类型。",
      "冲突证据往往从局部开始渗透到整条叙事。",
      "高阶路线要让每一种题型都为终局判断服务。",
    ],
    finaleTitle: "时间归位",
    finaleTruth: "被改写的不是某一年，而是整条时间链里最早被替换的起点证据。",
    finaleDebrief: "你重新排定了铭文、纪年、事件和证据作用，才让真正的王朝顺序重新闭合。",
    shareLine: "我们把错乱的王朝时间线校正回来了。",
    code: "8462",
  },
]

function createSchemaMeta(ageBand: AgeBand, difficultyLevel: DifficultyLevel, taskKind: TaskKind): MissionSchemaMeta {
  return {
    ageGroup: AGE_BAND_MAP[ageBand],
    difficultyLevel: DIFFICULTY_MAP[difficultyLevel],
    scaleType: TASK_KIND_MAP[taskKind],
  }
}

function createHints(seed: MissionSeed, stageNo: number, templateType: PuzzleTemplateType): Record<HintLevel, string> {
  const artifact = seed.artifactTitles[stageNo - 1]
  const objective = seed.objectives[stageNo - 1]
  const clue = seed.clueTitles[stageNo - 1]

  return {
    observe: `先回到 ${artifact}，按“${objective}”再看一遍，线索会比题面更直接。`,
    relation: `这一章真正需要你锁定的是“${clue}”，把展品细节和上一章得到的碎片连起来。`,
    direct: `本章答案直接指向“${clue}”，如果还不确定，就先选最符合这句描述的项。`,
  }
}

function createPuzzle(seed: MissionSeed, stageNo: number): MissionPuzzle {
  const config = TEMPLATE_SEQUENCE[stageNo - 1]
  const schemaMeta = createSchemaMeta(seed.recommendedAgeBand, config.difficultyLevel, seed.taskKind)
  const base = {
    id: `${seed.id}-puzzle-${stageNo}`,
    puzzleTypeId: PUZZLE_TYPE_MAP[config.templateType],
    templateType: config.templateType,
    title: seed.chapterTitles[stageNo - 1],
    introText: seed.storyFragments[stageNo - 1],
    prompt: seed.objectives[stageNo - 1],
    difficultyLevel: config.difficultyLevel,
    schemaMeta,
    hintPayload: createHints(seed, stageNo, config.templateType),
    reward: {
      clueId: `${seed.id}-clue-${stageNo}`,
      clueTitle: seed.clueTitles[stageNo - 1],
      fragmentId: `${seed.id}-fragment-${stageNo}`,
      fragmentTitle: seed.fragmentTitles[stageNo - 1],
    },
    successCopy: `你锁定了 ${seed.clueTitles[stageNo - 1]}，章节情报已经更新。`,
    failureCopy: `这一题更像是观察失误，不妨回展品上再对一次。`,
  } as const

  if (config.templateType === "observe_choice") {
    return {
      ...base,
      templateType: "observe_choice",
      questionPayload: {
        prompt: `在 ${seed.artifactTitles[0]} 上，哪一个细节最像这条路线真正的起点标记？`,
        options: seed.observeOptions.map((label, index) => ({
          id: `observe-${index + 1}`,
          label,
          description: index === 1 ? "它和任务背景中提到的主线索最贴近。" : "看起来显眼，但更像干扰信息。",
        })),
        correctOptionId: "observe-2",
      },
    }
  }

  if (config.templateType === "clue_find") {
    return {
      ...base,
      templateType: "clue_find",
      questionPayload: {
        prompt: `在 ${seed.artifactTitles[1]} 的观察板里，点出真正的 ${seed.clueTitles[1]}。`,
        targetDescription: seed.clueHotspots[1],
        hotspots: [
          { id: "hotspot-1", x: 16, y: 18, width: 22, height: 18, label: seed.clueHotspots[0] },
          { id: "hotspot-2", x: 58, y: 24, width: 20, height: 14, label: seed.clueHotspots[1] },
          { id: "hotspot-3", x: 22, y: 60, width: 18, height: 16, label: seed.clueHotspots[2] },
          { id: "hotspot-4", x: 64, y: 68, width: 18, height: 14, label: seed.clueHotspots[3] },
        ],
        correctHotspotId: "hotspot-2",
      },
    }
  }

  if (config.templateType === "sort") {
    return {
      ...base,
      templateType: "sort",
      questionPayload: {
        prompt: `把你在 ${seed.artifactTitles[2]} 上的观察动作排成正确顺序。`,
        items: seed.sortItems.map((label, index) => ({
          id: `sort-${index + 1}`,
          label,
        })),
        correctOrder: ["sort-1", "sort-2", "sort-3", "sort-4"],
      },
    }
  }

  if (config.templateType === "match") {
    return {
      ...base,
      templateType: "match",
      questionPayload: {
        prompt: `在 ${seed.artifactTitles[3]} 的线索板里，把左侧证据和右侧意义配对。`,
        left: seed.matchPairs.map((pair, index) => ({
          id: `left-${index + 1}`,
          label: pair.left,
        })),
        right: seed.matchPairs.map((pair, index) => ({
          id: `right-${index + 1}`,
          label: pair.right,
        })),
        correctPairs: seed.matchPairs.map((_, index) => ({
          leftId: `left-${index + 1}`,
          rightId: `right-${index + 1}`,
        })),
      },
    }
  }

  return {
    ...base,
    templateType: "code_break",
    questionPayload: {
      prompt: `把前四站得到的碎片排好，输入 ${seed.artifactTitles[4]} 的密码。`,
      codeLength: seed.code.length,
      acceptedCode: seed.code,
      clueFragments: seed.clueTitles.slice(0, 4),
      maskCharacter: "?",
    },
  }
}

function buildMission(seed: MissionSeed): MissionDetail {
  const schemaMeta = createSchemaMeta(seed.recommendedAgeBand, seed.difficultyLevel, seed.taskKind)
  const chapters = seed.chapterTitles.map((title, index) => ({
    id: `${seed.id}-chapter-${index + 1}`,
    stageNo: index + 1,
    title,
    objective: seed.objectives[index],
    targetLocation: seed.locations[index],
    resultNarrative: `${seed.clueTitles[index]} 已并入线索板，${index === seed.chapterTitles.length - 1 ? "终章已就绪。" : `下一站前往 ${seed.locations[index + 1]}。`}`,
    nextTarget: index === seed.chapterTitles.length - 1 ? "查看结果" : seed.locations[index + 1],
    artifact: {
      id: `${seed.id}-artifact-${index + 1}`,
      title: seed.artifactTitles[index],
      subtitle: seed.observationPoints[index],
      location: seed.locations[index],
      observationPoint: seed.observationPoints[index],
      storyFragment: seed.storyFragments[index],
      suspiciousPoint: seed.suspiciousPoints[index],
      checklist: seed.checklists[index],
      detailCallout: seed.detailCallouts[index],
    },
    puzzle: createPuzzle(seed, index + 1),
  }))

  return {
    id: seed.id,
    routeCode: seed.routeCode,
    title: seed.title,
    theme: seed.theme,
    summary: seed.summary,
    highlight: seed.highlight,
    recommendedAgeBand: seed.recommendedAgeBand,
    availableAgeBands: seed.availableAgeBands,
    difficultyLevel: seed.difficultyLevel,
    taskKind: seed.taskKind,
    estimatedMinutes: seed.estimatedMinutes,
    puzzleCount: chapters.length,
    chapterCount: chapters.length,
    allowTeam: true,
    rewardTitle: seed.rewardTitle,
    startLocation: seed.startLocation,
    badgeLabel: seed.badgeLabel,
    persona: seed.persona,
    taglines: seed.taglines,
    schemaMeta,
    museumName: seed.museumName,
    prologue: [
      {
        eyebrow: "mission brief",
        title: `${seed.persona.name} 已接入路线`,
        content: `${seed.persona.intro} 这次任务的目标是：${seed.objectives[0]}`,
      },
      {
        eyebrow: "first target",
        title: seed.chapterTitles[0],
        content: `第一站前往 ${seed.locations[0]}，把注意力先放回展品本身。`,
      },
      {
        eyebrow: "rhythm",
        title: "五章推进节奏已锁定",
        content: `每到一站先观察，再完成一个小挑战。`,
      },
    ],
    introPanel: {
      narrative: seed.introNarrative,
      playbook: seed.playbook,
      rewardPreview: seed.rewardPreview,
    },
    chapters,
    finale: {
      title: seed.finaleTitle,
      truth: seed.finaleTruth,
      debrief: seed.finaleDebrief,
      knowledgeNotes: seed.knowledgeNotes,
      scoreTitle: seed.rewardTitle,
      shareLine: seed.shareLine,
    },
  }
}

export const MOCK_MISSIONS: MissionDetail[] = MISSION_SEEDS.map(buildMission)

export const MOCK_MISSION_MAP = Object.fromEntries(
  MOCK_MISSIONS.map((mission) => [mission.id, mission]),
) as Record<string, MissionDetail>

export const MOCK_ROUTE_CARDS: MissionRouteCard[] = MOCK_MISSIONS.map(({ museumName: _museumName, prologue: _prologue, introPanel: _introPanel, chapters: _chapters, finale: _finale, ...card }) => card)
