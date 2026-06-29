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

interface StoryBranchSeedOption {
  label: string
  summary: string
  outcomeTitle: string
  outcomeText: string
}

interface ReasoningEvidenceSeed {
  label: string
  note: string
}

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
  clueTitles: string[]
  fragmentTitles: string[]
  observeOptions: string[]
  clueHotspots: string[]
  sortItems: string[]
  matchPairs: Array<{ left: string; right: string }>
  imagePuzzlePieces: string[]
  storyBranchOptions: StoryBranchSeedOption[]
  correctStoryBranchIndex: number
  reasoningEvidence: ReasoningEvidenceSeed[]
  reasoningConclusions: string[]
  correctReasoningConclusionIndex: number
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
  { templateType: "image_puzzle", difficultyLevel: "L2" },
  { templateType: "story_branch", difficultyLevel: "L2" },
  { templateType: "multi_step_reasoning", difficultyLevel: "L3" },
  { templateType: "code_break", difficultyLevel: "L3" },
]

const MISSION_SEEDS: MissionSeed[] = [
  {
    id: "route-dragon",
    routeCode: "R-DRAGON-01",
    title: "失落的龙纹密令",
    theme: "亲子冒险",
    summary: "跟着导览角色在馆内追查被拆散的龙纹暗号，让孩子在每个展点都先观察、再拼回完整故事。",
    highlight: "8 章完整链路覆盖后端强调的 8 类渲染器，路线中后段加入更强动画驱动的互动反馈。",
    recommendedAgeBand: "6-10",
    availableAgeBands: ["6-10", "10-15"],
    difficultyLevel: "L2",
    taskKind: "family_adventure",
    estimatedMinutes: 30,
    rewardTitle: "龙纹守护者徽章",
    startLocation: "东馆 1F 龙纹厅入口",
    badgeLabel: "家庭推荐",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["观察先行", "亲子共玩", "八章推进"],
    persona: {
      id: "persona-nanmu",
      code: "nanmu-guide",
      name: "楠木引路人",
      intro: "用简洁线索带游客进入展厅秘密的向导。",
      avatar: "楠",
      voiceStyle: "温和、鼓励式",
    },
    introNarrative: "龙纹密码被拆成了八段，只有沿着展柜里的细节一路找回，终点的封印才会被重新点亮。",
    playbook: ["先观察展品再答题", "卡住时先看观察提示", "中段开始要把线索真的拼回来", "终章密码来自整条路线"],
    rewardPreview: ["龙纹守护者徽章", "线索碎片图鉴", "终局成绩卡"],
    chapterTitles: ["龙纹初现", "刻痕回声", "工艺顺序", "图样配对", "碎片重构", "守匣抉择", "证据归拢", "封匣解码"],
    locations: [
      "龙纹厅 1 号展柜",
      "龙纹厅 3 号转角柜",
      "工艺长廊中段",
      "纹样对照墙",
      "碎片拼接台",
      "封匣前剧情台",
      "守匣证据架",
      "东馆终章封匣台",
    ],
    objectives: [
      "找出真正的龙纹起点。",
      "锁定被故意遮住的细节。",
      "按线索还原工艺观察路径。",
      "把纹样和含义一一对应。",
      "把被拆开的龙纹碎片重新拼回正确顺序。",
      "判断守匣人留下的哪条说法最接近真相。",
      "挑出三条能真正闭合剧情的证据链。",
      "用前七章线索破解最终封匣密码。",
    ],
    artifactTitles: ["鎏金龙纹壶", "青玉云纹佩", "彩绘屏风残片", "龙舟铜鼓", "龙纹碎片浮板", "守匣人手札", "龙纹证据架", "龙纹封匣"],
    observationPoints: [
      "先看器口附近最显眼的一段主纹。",
      "注意边缘修补处和编号压印。",
      "找出工艺步骤留下的顺序痕迹。",
      "比较纹样名称和它们所代表的功能。",
      "碎片顺序要和你前面观察到的工艺走势一致。",
      "别只听最响亮的故事，要看哪句和你手里的线索吻合。",
      "把前面得到的碎片、纹样和顺序线索串成一条完整链。",
      "回忆前七章拿到的所有碎片。",
    ],
    storyFragments: [
      "第一位修复师只留下了一个最明显的龙角提示。",
      "第二段密令藏在后来补刻的一处编号里。",
      "第三段要求你按观察顺序串起制作线索。",
      "第四段要把图样和用途关系重新连上。",
      "第五段开始，零散线索必须真的拼回完整画面。",
      "第六段故意留下了几种相互冲突的说法。",
      "第七段需要你证明到底哪一条线索链才是可信的。",
      "终局封匣只接受完整顺序下得到的密码。",
    ],
    suspiciousPoints: [
      "看起来最花哨的纹样不一定是真线索。",
      "真正的痕迹往往藏在修补线和编号附近。",
      "顺序题要从观察动作出发，不是猜故事结尾。",
      "配对时优先看纹样和使用场景的关系。",
      "碎片摆得好看不代表顺序正确，要和前文线索一致。",
      "最会讲故事的人未必最可靠。",
      "如果证据之间互相打架，说明你还没找到真正主线。",
      "最终密码来自前七章碎片，不在封匣表面。",
    ],
    detailCallouts: [
      "主纹旁边有一段明显更深的刻线。",
      "修补痕的边缘压着一串小编号。",
      "屏风表面留下了由浅到深的加工层次。",
      "对照墙把图样和用途分在了两列。",
      "浮板上的碎片边缘能对出同一条龙脊。",
      "手札里有三句互相冲突的记录被并排摆放。",
      "证据架把前文线索拆成了可重新组合的卡片。",
      "封匣的四个槽位只接受定长密码。",
    ],
    checklists: [
      ["数一数主纹分叉", "对比龙首方向", "不要被边框花纹干扰"],
      ["先看补色区域", "再找编号位置", "留意最短的一条裂痕"],
      ["从最先发生的步骤开始", "每一步都要有前后关系", "最后一项应该指向记录印记"],
      ["先选左列纹样", "再找右列对应用途", "出现冲突时回看故事片段"],
      ["先找能对上的纹路", "再看线索先后", "最后确认完整龙脊方向"],
      ["不要只凭语气判断", "优先看能和前文证据对应的说法", "遇到冲突先保留怀疑"],
      ["至少要选出一条顺序线、一条纹样线和一条人物线", "能互相印证才算成立", "冲突时回看拼图页"],
      ["整理前七章碎片", "按得到顺序拼接", "再输入封匣"],
    ],
    clueTitles: ["龙首刻痕", "编号暗记", "工艺路径", "纹样关系", "龙脊拼图", "守匣证词", "证据闭环", "封匣真相"],
    fragmentTitles: ["龙角碎片", "编号碎片", "顺序碎片", "图样碎片", "龙脊碎片", "证词碎片", "闭环碎片", "守护印记"],
    observeOptions: ["卷草纹边", "回首单龙", "莲瓣纹心", "山形底座"],
    clueHotspots: ["残缺龙角", "暗刻编号", "补色裂痕", "错位金线"],
    sortItems: ["先看龙首朝向", "再数主纹分叉", "接着核对边缘补色", "最后记录底部印记"],
    matchPairs: [
      { left: "回首龙纹", right: "指向起点展柜" },
      { left: "水波云纹", right: "提示下一站方向" },
      { left: "铜鼓鼓点", right: "对应章节节奏" },
      { left: "封匣锁孔", right: "承接最终密码" },
    ],
    imagePuzzlePieces: ["龙脊起笔", "龙鳞转折", "锁孔投影", "终章暗纹"],
    storyBranchOptions: [
      {
        label: "相信最醒目的金线就是终点提示",
        summary: "它最耀眼，也最容易让人误以为已经接近真相。",
        outcomeTitle: "太快下结论",
        outcomeText: "这条说法只能解释表面装饰，解释不了你前面已经拿到的编号和顺序线索。",
      },
      {
        label: "优先相信能同时解释纹样、顺序和碎片方向的说法",
        summary: "它看起来最朴素，但能把前面几章真正串起来。",
        outcomeTitle: "主线闭合",
        outcomeText: "只有这条分支能同时解释龙脊方向、工艺顺序和封匣结构。",
      },
      {
        label: "先按守匣人口述猜一个看起来最像密码的数字",
        summary: "它让你省事，但会把前文观察全部丢掉。",
        outcomeTitle: "被误导",
        outcomeText: "守匣人的口述里故意埋了假信息，单靠数字直觉会把路线带偏。",
      },
    ],
    correctStoryBranchIndex: 1,
    reasoningEvidence: [
      { label: "龙首方向和龙脊拼图完全对上", note: "说明起点判断没有偏。"},
      { label: "编号暗记和工艺顺序指向同一段操作流程", note: "能证明中段线索并不是孤立信息。"},
      { label: "守匣证词里只有一条能解释封匣锁孔方向", note: "它必须和前两条同时成立。"},
    ],
    reasoningConclusions: ["真正的线索藏在最亮眼的表面纹样里", "路线真正的关键是观察顺序被拼成了完整路径", "前面碎片只用于装饰，终章靠猜密码即可"],
    correctReasoningConclusionIndex: 1,
    knowledgeNotes: [
      "龙纹在不同器物上承担礼制、装饰和叙事三种角色。",
      "修复痕迹本身也会成为展览中的重要信息。",
      "工艺顺序决定了游客应该如何观察展品。",
    ],
    finaleTitle: "龙纹归位",
    finaleTruth: "真正的密令不是某一件展品，而是整条展线教你掌握的观察顺序。",
    finaleDebrief: "你从纹样、编号、工艺、拼图、证词和证据链一路拼回了同一条线索，封匣因此重新打开。",
    shareLine: "我们把龙纹密令找回来了。",
    code: "2741",
  },
  {
    id: "route-scroll",
    routeCode: "R-SCROLL-02",
    title: "画卷背后的消失人物",
    theme: "剧情推理",
    summary: "通过题跋、服饰和时代信息追查古画里被抹去的人物，路线更偏叙事、分歧判断和证据闭环。",
    highlight: "前半段先观察，后半段逐步进入拼图、剧情判断和多步推理，节奏更像一条完整案件线。",
    recommendedAgeBand: "10-15",
    availableAgeBands: ["10-15", "15+"],
    difficultyLevel: "L2",
    taskKind: "story_detective",
    estimatedMinutes: 34,
    rewardTitle: "画境侦探称号",
    startLocation: "西馆 2F 长卷展厅入口",
    badgeLabel: "剧情推荐",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["剧情推进", "证据关联", "分歧判断"],
    persona: {
      id: "persona-yingluo",
      code: "yingluo-archivist",
      name: "影落档案员",
      intro: "擅长把断裂的故事重新拼回完整档案。",
      avatar: "影",
      voiceStyle: "冷静、带悬念",
    },
    introNarrative: "一幅名作里的关键人物被后世抹去了身份信息，档案员要你在八个展点里找回他的真实位置。",
    playbook: ["先确认画面证据", "中段多用关系提示连接人物和时代", "别急着相信最像真相的版本", "终局只接受完整证据链"],
    rewardPreview: ["画境侦探称号", "人物档案碎片", "结案成绩卡"],
    chapterTitles: ["被抹去的署名", "衣纹疑点", "事件时间线", "角色关系网", "碎片复原", "叙述分歧", "证据闭环", "结案档案"],
    locations: [
      "长卷厅 A 面主画墙",
      "服饰细节台",
      "时代对照屏",
      "关系档案桌",
      "残卷拼接台",
      "口述对照亭",
      "证据归档桌",
      "案卷封存柜",
    ],
    objectives: [
      "锁定第一处被改写的署名。",
      "找到最能证明身份的服饰细节。",
      "按事件发生先后整理画卷证据。",
      "把人物与关系角色对应起来。",
      "把残卷碎片拼回完整的人物线索。",
      "判断哪段口述更接近被隐藏的真实身份。",
      "挑出能够闭合整条案件链的关键证据。",
      "组合证据完成结案密码。",
    ],
    artifactTitles: ["设色人物长卷", "官服补绣片", "题跋手札", "宴饮图册", "残卷碎片板", "画外口述录", "归档证据桌", "密封案卷"],
    observationPoints: [
      "不要先看主角，要先看被抹去的角落署名。",
      "服饰上的补绣更能说明身份变化。",
      "时间线来自多处旁证，不在一段文字里。",
      "角色关系要通过立场和动作来判断。",
      "拼图时先找能接上的空白边，再看人物动作是否连贯。",
      "剧情分歧里要优先相信能解释空白与补绣同时出现的版本。",
      "把时间、服饰和人物角色三条线真正缠在一起。",
      "案卷密码由前七章里最关键的结论拼出。",
    ],
    storyFragments: [
      "最早被动手脚的是画卷右下角的一枚署名。",
      "补绣不是修饰，而是身份被更改的痕迹。",
      "题跋和画中动作能拼出真实的事件顺序。",
      "四位关键人物各自留下了不同立场。",
      "残卷里缺的不是画面，而是整条身份线索。",
      "口述记录故意给出了几种互相矛盾的身份版本。",
      "证据归档阶段要让每条线索都回答同一个问题。",
      "密封案卷只会对完整证据链开启。",
    ],
    suspiciousPoints: [
      "最显眼的位置反而可能是伪线索。",
      "服饰和纹章比表情更可靠。",
      "排序题不按年份猜，要按证据出现顺序。",
      "关系配对看的是身份功能，不是亲疏远近。",
      "拼图顺眼不代表正确，要看人物动作是否连上。",
      "最会讲故事的人往往最容易混淆视线。",
      "如果一条证据只能解释一个局部，它还不够强。",
      "终局必须把关键结论和案卷槽位对齐。",
    ],
    detailCallouts: [
      "右下角的墨迹颜色与原作不一致。",
      "补绣边缘留下了不属于同一时期的丝线。",
      "题跋手札中有两句被分开放置。",
      "档案桌左侧放人物，右侧放他们在事件里的职责。",
      "残卷碎片的空白边能和人物袖口走势对上。",
      "口述亭把三种说法并排展示在同一块玻璃板上。",
      "归档桌把证据分成时间、身份、动作三个抽屉。",
      "案卷锁位会提示你缺了哪一段证据。",
    ],
    checklists: [
      ["观察墨色差异", "看署名位置是否顺手", "对比旁边空白"],
      ["先找补绣边缘", "再核对纹章位置", "不要只盯颜色"],
      ["挑出最早的文字证据", "再接动作证据", "最后补上题跋"],
      ["确认角色身份", "再选他们对应的职责", "避免同义词干扰"],
      ["先找人物动作能连上的边", "再对空白缺口", "最后确认方向是否一致"],
      ["先排除解释不了补绣的说法", "再看哪条能解释空白署名", "别被悬疑感最强的文案带跑"],
      ["至少要保留时间线、服饰线、人物职责线", "三条线都能指向同一身份才算成立", "冲突时回看残卷拼图"],
      ["把前七章结论按顺序记下", "只输入最终保留下来的四位", "留意档案锁位提示"],
    ],
    clueTitles: ["署名差异", "服饰证据", "时间顺序", "关系职责", "残卷复原", "口述分歧", "人物闭环", "人物真名"],
    fragmentTitles: ["墨色碎片", "丝线碎片", "顺序碎片", "关系碎片", "残卷碎片", "口述碎片", "闭环碎片", "结案印章"],
    observeOptions: ["边框压印", "被擦重写的署名", "主角衣袖", "画轴末端"],
    clueHotspots: ["发簪纹章", "补绣丝线", "肩部褶痕", "袖口缝边"],
    sortItems: ["发现被改写署名", "锁定补绣身份", "拼出题跋先后", "得到人物真名"],
    matchPairs: [
      { left: "抄录者", right: "负责改写署名" },
      { left: "侍从", right: "隐藏了服饰证据" },
      { left: "主角", right: "真正被抹去身份" },
      { left: "档案员", right: "负责封存案卷" },
    ],
    imagePuzzlePieces: ["残卷空白边", "补绣袖口", "题跋落款", "转身动作"],
    storyBranchOptions: [
      {
        label: "相信最戏剧化的口述版本",
        summary: "它最像传奇故事，也最容易让人忽略真实证据。",
        outcomeTitle: "戏剧性太强",
        outcomeText: "这条分支解释不了题跋顺序和补绣丝线之间的关系，只是把人物重新神秘化了。",
      },
      {
        label: "优先相信能同时解释署名、服饰和动作的版本",
        summary: "它不最夸张，却能让前六章的证据落到同一人身上。",
        outcomeTitle: "案件主线成立",
        outcomeText: "只有这条说法能同时解释空白署名、补绣身份和残卷动作方向。",
      },
      {
        label: "只根据画面站位猜谁是中心人物",
        summary: "它看上去直观，但忽略了后世改写的干扰。",
        outcomeTitle: "被画面误导",
        outcomeText: "站位只能说明叙事焦点，不能证明被抹去的人物身份。",
      },
    ],
    correctStoryBranchIndex: 1,
    reasoningEvidence: [
      { label: "被改写署名和原始墨色层次不一致", note: "证明第一处篡改发生在画角。"},
      { label: "补绣丝线不属于原始制作年代", note: "说明服饰身份后来被重新定义。"},
      { label: "残卷动作和题跋顺序指向同一位人物", note: "只有这条线能把身份真正锁死。"},
    ],
    reasoningConclusions: ["真正消失的是一位被后世重新定义身份的人物", "补绣只是修复，不影响人物真实身份", "案卷中的人物根本不存在，只是叙事烟幕"],
    correctReasoningConclusionIndex: 0,
    knowledgeNotes: [
      "古画中的题跋、服饰和空白区域都是有效证据。",
      "同一幅画往往会在后世经历重写和再解释。",
      "叙事型路线更适合把观察题和关系题串在一起。",
    ],
    finaleTitle: "人物归档",
    finaleTruth: "消失的人物并不是从画里消失，而是被后世的解释层层覆盖。",
    finaleDebrief: "你用署名、服饰、时间线、拼图、分歧判断和证据闭环重新找回了被隐藏的身份信息。",
    shareLine: "我们替古画找回了失踪人物。",
    code: "5138",
  },
  {
    id: "route-timeline",
    routeCode: "R-TIME-03",
    title: "谁改写了王朝时间线",
    theme: "深度推理",
    summary: "面对多件年代互相矛盾的馆藏，你需要重构事件链，找出错误被植入的节点。",
    highlight: "高阶路线同样走完整 8 章，但中后段的拼图、剧情判断和多步推理密度更高。",
    recommendedAgeBand: "15+",
    availableAgeBands: ["15+"],
    difficultyLevel: "L3",
    taskKind: "deep_reasoning",
    estimatedMinutes: 38,
    rewardTitle: "时序解码者称号",
    startLocation: "北馆 3F 编年展厅入口",
    badgeLabel: "高阶挑战",
    museumName: "Path Seeker 博物探索馆",
    taglines: ["高知识密度", "终局强化", "证据重构"],
    persona: {
      id: "persona-shichen",
      code: "shichen-curator",
      name: "时辰策展人",
      intro: "负责修补历史时间线里的错位节点。",
      avatar: "时",
      voiceStyle: "克制、判断式",
    },
    introNarrative: "编年展厅里出现了多段互相矛盾的年代描述，只有修复完整的时间链，错误来源才会暴露。",
    playbook: ["不要急着下结论，先标记每条证据的位置", "中段排序和配对决定终局难度", "拼图和分歧判断是终局前的最后筛选", "终局密码来自八章校正后的结果"],
    rewardPreview: ["时序解码者称号", "校正碎片图鉴", "深度路线成绩卡"],
    chapterTitles: ["异常铭文", "错置纪年", "事件重排", "证据归档", "碎片回拼", "时序分歧", "推理闭环", "王朝校正"],
    locations: [
      "编年展厅 A1 石刻区",
      "纪年铜镜台",
      "事件重构屏",
      "证据归档架",
      "断代拼接台",
      "时序判断亭",
      "校正证据桌",
      "王朝校正台",
    ],
    objectives: [
      "确认最早出现矛盾的铭文。",
      "找出真正错置的纪年细节。",
      "把事件节点按正确先后重排。",
      "将证据与其证明作用对应起来。",
      "把断裂的年代碎片重新拼回完整顺序。",
      "判断哪条时序解释更接近真实历史链条。",
      "挑出足以闭合整条时间线的关键证据。",
      "用七章校正结果完成时间线校验。",
    ],
    artifactTitles: ["边塞石刻", "纪年铜镜", "诏令简册", "礼制器册页", "断代碎片板", "时序争议录", "校正证据桌", "校正仪盘"],
    observationPoints: [
      "从最早矛盾出现的边角铭文看起。",
      "纪年题不要只看年份，要看格式和书写习惯。",
      "排序时先排证据强度，再排时间。",
      "证据配对要明确它证明的是人、事还是年代。",
      "拼图时先对照年代格式，再看碎片之间的前后逻辑。",
      "分歧判断要看哪条解释能同时解释铭文、纪年和礼制背景。",
      "最终闭环必须让三条不同类型的证据同时成立。",
      "校正仪盘只接受四段被修正后的结果。",
    ],
    storyFragments: [
      "错位时间线并不是整体伪造，而是从一处铭文开始松动。",
      "纪年的书写方式暴露了它不属于原时代。",
      "事件次序一旦排对，冲突会自然消失。",
      "归档阶段要给每条证据分配清晰作用。",
      "断代碎片里藏着真正的年代断口。",
      "时序分歧阶段会故意把几种学者观点并列呈现。",
      "最终推理不是找单一证据，而是让整条链条闭合。",
      "校正仪盘会检验你是否真正理解了冲突来源。",
    ],
    suspiciousPoints: [
      "最完整的铭文不一定最可靠。",
      "年份数字相同，也可能是后世转写。",
      "排序题要先判断证据权重。",
      "配对错了会直接影响终局密码片段。",
      "拼图顺序如果只看数字，会忽略真正的断代格式。",
      "最像标准答案的学者观点未必能解释全部证据。",
      "只要有一类证据脱节，整条时间线就还没校正成功。",
      "最终密码来自校正后的七条线索。",
    ],
    detailCallouts: [
      "石刻阴刻深浅不一，说明曾被二次处理。",
      "铜镜背面的纪年格式与同厅器物不同。",
      "事件重构屏把节点拆成了四张卡片。",
      "归档架一列放证据，一列放它证明的作用。",
      "断代碎片上的纪年格式能拼出统一书写习惯。",
      "争议录把三套学者解释压在同一层透页上。",
      "证据桌把铭文、礼制和纪年分成三组待你重排。",
      "校正仪盘把密码槽位做成了四段刻度。",
    ],
    checklists: [
      ["看刻痕深浅", "找最早被修改的位置", "对比同排字形"],
      ["先看纪年格式", "再看书写习惯", "最后比对同类器物"],
      ["先排最强证据", "再排中间节点", "最后确认结果指向"],
      ["区分证明对象", "不要把年代和人物混淆", "冲突时回看前两章"],
      ["先按格式把碎片分类", "再按时间逻辑拼接", "最后核对礼制背景是否一致"],
      ["优先排除解释不通铭文的版本", "再看谁能兼容礼制信息", "不要被最像教科书的说法直接带走"],
      ["保留一条铭文线、一条纪年线和一条礼制线", "三条线都要指向同一结论", "必要时回看拼图页和配对页"],
      ["整合前七章校正片段", "确保长度一致", "再输入仪盘"],
    ],
    clueTitles: ["异常铭文", "纪年格式", "事件顺序", "证据作用", "断代拼图", "时序分歧", "推理闭环", "校正完成"],
    fragmentTitles: ["铭文碎片", "纪年碎片", "时序碎片", "归档碎片", "断代碎片", "争议碎片", "闭环碎片", "校正密章"],
    observeOptions: ["完整主铭文", "边角补刻字", "中心图案", "旁边说明牌"],
    clueHotspots: ["旧刻痕", "错置纪年", "转写笔锋", "边框裂口"],
    sortItems: ["锁定异常铭文", "识别错置纪年", "重排事件节点", "完成时间校正"],
    matchPairs: [
      { left: "石刻阴刻", right: "证明铭文被二次处理" },
      { left: "铜镜纪年", right: "证明年份格式错置" },
      { left: "简册诏令", right: "证明事件先后关系" },
      { left: "礼制器册页", right: "证明王朝礼制背景" },
    ],
    imagePuzzlePieces: ["铭文断口", "纪年格式", "礼制注记", "事件余波"],
    storyBranchOptions: [
      {
        label: "接受最完整的一套标准编年说法",
        summary: "它看上去最像教科书，但未必解释得了现场证据。",
        outcomeTitle: "过度依赖成稿",
        outcomeText: "这条说法忽略了被二次处理的铭文和错置纪年格式，只是看起来完整。",
      },
      {
        label: "选择能同时解释铭文、纪年和礼制背景的版本",
        summary: "它复杂一些，但能让前面收集到的三类证据共同成立。",
        outcomeTitle: "历史链条闭合",
        outcomeText: "只有这条分支既解释了铭文松动的起点，也解释了后续纪年与礼制的错位。",
      },
      {
        label: "只根据年份数字把所有证据重新排序",
        summary: "这种方法最省事，也最容易掉进后世转写陷阱。",
        outcomeTitle: "数字陷阱",
        outcomeText: "年份数字会被后人照抄，但书写格式和礼制背景不会一起伪装成功。",
      },
    ],
    correctStoryBranchIndex: 1,
    reasoningEvidence: [
      { label: "铭文断口先于纪年冲突出现", note: "说明错误起点在最早证据层。"},
      { label: "纪年格式与同时期器物不一致", note: "证明后续转写把时间链带偏。"},
      { label: "礼制背景只与其中一条时间线相匹配", note: "它能替你裁掉剩下的伪答案。"},
    ],
    reasoningConclusions: ["真正被改写的是时间链最早的起点证据", "冲突只来自纪年写错，与礼制和铭文无关", "所有矛盾都能靠重新排列年份数字解决"],
    correctReasoningConclusionIndex: 0,
    knowledgeNotes: [
      "年代判断不仅看数字，还要看书写习惯与器物类型。",
      "冲突证据往往从局部开始渗透到整条叙事。",
      "高阶路线要让每一种题型都为终局判断服务。",
    ],
    finaleTitle: "时间归位",
    finaleTruth: "被改写的不是某一年，而是整条时间链里最早被替换的起点证据。",
    finaleDebrief: "你重新排定了铭文、纪年、事件、拼图、分歧判断和证据作用，才让真正的王朝顺序重新闭合。",
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

function createHints(seed: MissionSeed, stageNo: number): Record<HintLevel, string> {
  const artifact = seed.artifactTitles[stageNo - 1]
  const objective = seed.objectives[stageNo - 1]
  const clue = seed.clueTitles[stageNo - 1]

  return {
    observe: `先回到 ${artifact}，按“${objective}”再看一遍，线索会比题面更直接。`,
    relation: `这一章真正需要你锁定的是“${clue}”，把当前展点和前一章得到的碎片连起来。`,
    direct: `本章答案直接指向“${clue}”，如果还不确定，就优先选最能解释前面章节线索的项。`,
  }
}

function createIllustrationDataUrl(seed: MissionSeed, stageNo: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#18140f" />
          <stop offset="52%" stop-color="#43311f" />
          <stop offset="100%" stop-color="#0f141b" />
        </linearGradient>
        <radialGradient id="glow" cx="30%" cy="25%" r="60%">
          <stop offset="0%" stop-color="#f0d697" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#f0d697" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="url(#bg)" rx="36" />
      <rect x="28" y="28" width="544" height="544" rx="28" fill="none" stroke="rgba(240,214,151,0.32)" stroke-width="4" />
      <circle cx="160" cy="130" r="168" fill="url(#glow)" />
      <path d="M112 420C180 278 270 224 430 184C404 260 378 308 302 356C250 388 216 396 112 420Z" fill="rgba(255,255,255,0.08)" />
      <path d="M146 458C220 314 300 252 472 224" fill="none" stroke="rgba(240,214,151,0.5)" stroke-width="10" stroke-linecap="round" />
      <path d="M166 216C232 164 308 142 416 144" fill="none" stroke="rgba(240,214,151,0.18)" stroke-width="18" stroke-linecap="round" />
      <text x="64" y="118" fill="#f8edd1" font-size="34" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-weight="700">${seed.museumName}</text>
      <text x="64" y="176" fill="#f3d99d" font-size="52" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-weight="800">${seed.clueTitles[stageNo - 1]}</text>
      <text x="64" y="234" fill="rgba(248,237,209,0.82)" font-size="28" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${seed.artifactTitles[stageNo - 1]}</text>
      <text x="64" y="522" fill="rgba(248,237,209,0.56)" font-size="24" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${seed.fragmentTitles[stageNo - 1]} · 拖拽复原</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function createPuzzlePieceSeeds(seed: MissionSeed) {
  return [
    ...seed.imagePuzzlePieces,
    ...seed.fragmentTitles,
    ...seed.clueTitles,
    ...seed.artifactTitles,
  ]
}

function createCodeDerivationSteps(seed: MissionSeed) {
  const rules = [
    "取本章线索编号的首位",
    "按观察顺序保留第二位",
    "把关系闭环对应到第三位",
    "用终章前的关键证词锁定末位",
  ]

  return seed.code.split("").map((digit, index) => ({
    id: `derive-${index + 1}`,
    chapterLabel: `第 ${index + 1} 段`,
    sourceTitle: seed.clueTitles[index + 3] || seed.clueTitles[index] || seed.fragmentTitles[index],
    rule: rules[index] || `从 ${seed.clueTitles[index] || "前文线索"} 中提取这一位`,
    result: digit,
  }))
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
    hintPayload: createHints(seed, stageNo),
    reward: {
      clueId: `${seed.id}-clue-${stageNo}`,
      clueTitle: seed.clueTitles[stageNo - 1],
      fragmentId: `${seed.id}-fragment-${stageNo}`,
      fragmentTitle: seed.fragmentTitles[stageNo - 1],
    },
    successCopy: `你锁定了 ${seed.clueTitles[stageNo - 1]}，章节情报已经更新。`,
    failureCopy: `这一题更像是观察或推理链还没闭合，不妨回展品上再对一次。`,
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

  if (config.templateType === "image_puzzle") {
    const gridSize = seed.taskKind === "deep_reasoning" ? 3 : 2
    const pieceCount = gridSize * gridSize
    const pieceSeeds = createPuzzlePieceSeeds(seed)

    return {
      ...base,
      templateType: "image_puzzle",
      questionPayload: {
        prompt: `把 ${seed.artifactTitles[4]} 上散开的线索碎片拼回完整顺序。`,
        revealTitle: seed.clueTitles[4],
        trayTitle: "把拼图拖回原位",
        imageUrl: createIllustrationDataUrl(seed, stageNo),
        gridSize,
        pieces: Array.from({ length: pieceCount }, (_, index) => ({
          id: `piece-${index + 1}`,
          label: pieceSeeds[index] || `${seed.clueTitles[4]} 碎片 ${index + 1}`,
          hint: index === 0 ? "通常从最早被看到的那块开始。" : "看它和前一块是否能接成完整逻辑。",
        })),
        correctOrder: Array.from({ length: pieceCount }, (_, index) => `piece-${index + 1}`),
      },
    }
  }

  if (config.templateType === "story_branch") {
    return {
      ...base,
      templateType: "story_branch",
      questionPayload: {
        prompt: `在 ${seed.artifactTitles[5]} 前，判断哪条说法最接近真相。`,
        sceneIntro: seed.storyFragments[5],
        options: seed.storyBranchOptions.map((option, index) => ({
          id: `branch-${index + 1}`,
          label: option.label,
          summary: option.summary,
          outcomeTitle: option.outcomeTitle,
          outcomeText: option.outcomeText,
        })),
        correctOptionId: `branch-${seed.correctStoryBranchIndex + 1}`,
      },
    }
  }

  if (config.templateType === "multi_step_reasoning") {
    return {
      ...base,
      templateType: "multi_step_reasoning",
      questionPayload: {
        prompt: `从 ${seed.artifactTitles[6]} 里挑出能真正闭合剧情的证据，再给出最终结论。`,
        evidence: seed.reasoningEvidence.map((item, index) => ({
          id: `evidence-${index + 1}`,
          label: item.label,
          note: item.note,
          tag: index === 0 ? "起点证据" : index === 1 ? "关系证据" : "收束证据",
        })),
        correctEvidenceOrder: seed.reasoningEvidence.map((_, index) => `evidence-${index + 1}`),
        conclusions: seed.reasoningConclusions.map((label, index) => ({
          id: `conclusion-${index + 1}`,
          label,
          summary:
            index === seed.correctReasoningConclusionIndex
              ? "这条结论能同时解释前文顺序、关系和碎片走向。"
              : "它只能解释局部现象，和前文至少有一条线索冲突。",
        })),
        correctConclusionId: `conclusion-${seed.correctReasoningConclusionIndex + 1}`,
        chainTitle: "证据闭环台",
        slotLabels: ["起点判断", "中段校验", "终章收束"],
        conclusionTitle: "最终结论",
      },
    }
  }

  return {
    ...base,
    templateType: "code_break",
    questionPayload: {
      prompt: `把前七站得到的碎片排好，输入 ${seed.artifactTitles[7]} 的密码。`,
      codeLength: seed.code.length,
      acceptedCode: seed.code,
      clueFragments: seed.clueTitles.slice(0, 7),
      clueSourceTitle: "密码来源",
      derivationSteps: createCodeDerivationSteps(seed),
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
        title: "八章推进节奏已锁定",
        content: `前半段以观察为主，后半段要把线索真正拼回并完成终局判断。`,
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

export const MOCK_ROUTE_CARDS: MissionRouteCard[] = MOCK_MISSIONS.map(
  ({ museumName: _museumName, prologue: _prologue, introPanel: _introPanel, chapters: _chapters, finale: _finale, ...card }) => card,
)
