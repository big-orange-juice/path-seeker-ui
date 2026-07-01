export interface LandingStat {
  value: string;
  label: string;
  note: string;
}

export interface LandingHighlight {
  title: string;
  description: string;
}

export interface LandingAudience {
  title: string;
  tagline: string;
  description: string;
  pricing: string;
}

export interface LandingBusinessRow {
  title: string;
  share: string;
  detail: string;
}

export interface LandingRoadmapStage {
  phase: string;
  time: string;
  target: string;
  detail: string;
}

const heroStats: LandingStat[] = [
  { value: '5 种', label: '叙事路线模型', note: '线性、分支、寻宝、竞速与主题特展，任你编排一条故事线。' },
  { value: '3 分钟', label: '生成一道谜题', note: '从一件展品到题干、答案与提示，灵感落地只需一次对话。' },
  { value: '2 小时', label: '编排一条路线', note: '把过去数月的定制开发，收敛成一个下午的创作。' },
  { value: '一馆多面', label: '同一底座', note: '一次编排，衍生亲子、成人与外宾三种截然不同的旅程。' },
];

const marketSignals: LandingHighlight[] = [
  { title: '每件展品，都是一段没说完的故事', description: '玻璃展柜隔开的不只是距离，还有那些来不及被讲述的来龙去脉。我们想把它们重新交还给走进来的人。' },
  { title: '人们不再满足于「看过」', description: '越来越多的到访者想要参与、推理、结伴同行——把一次参观，变成一次值得回味的相遇。' },
  { title: '让创作回到策展人手里', description: '好的内容不该受困于漫长的定制开发。AI 负责繁重的部分，讲什么故事，仍由懂它的人决定。' },
];

const painPoints: LandingHighlight[] = [
  { title: '不再是一次性的项目', description: '传统定制动辄数月、成本高企，上线即定格。我们让内容可以被持续地打磨、更新与重新讲述。' },
  { title: '不止于一副耳机的独白', description: '语音导览把人隔在故事之外。我们用剧情、协作与线索，邀请每个人走进叙事里。' },
  { title: '不让语言成为门槛', description: '跨越语言与文化的讲述本该自然发生。多语言叙事，让远道而来的人也能读懂这里的分量。' },
];

const solutionPillars: LandingHighlight[] = [
  { title: '创作台', description: '像铺开一张地图那样编排路线——拖拽节点、复用模板、管理版本，让一条故事线自然成形。' },
  { title: '内容引擎', description: 'AI 读懂展品、补全知识、编织剧情、拿捏难度，也为多语言体验默默铺好底层的路。' },
  { title: '探索体验', description: '真实场景中的探索、结伴、解谜与分享，在指尖串成一段可以走进去的旅程。' },
];

const capabilityRows: LandingHighlight[] = [
  { title: '路线编辑器', description: '线性探索、分支剧情、开放寻宝、竞速挑战与主题特展——五种模型，讲五种故事。' },
  { title: 'AI 辅助创作', description: '一段素材输入，生成多种题型、多语言剧情与适龄版本；最后的取舍，始终留给人。' },
  { title: '数据与复盘', description: '完成率、热力图、路径漏斗与奖励配置，让每一次讲述都比上一次更懂你的观众。' },
];

const aiEngineSteps: LandingHighlight[] = [
  { title: '读懂一件展品', description: '图像、文字与语音一同进入理解，先看懂，再开口。' },
  { title: '接上馆藏的记忆', description: '把知识库、策展资料与场馆规则接入生成之前，让故事有据可依。' },
  { title: '四重推敲', description: '事实、规则、风格与人工复核层层把关，让每一句叙述都值得信任。' },
];

const audiences: LandingAudience[] = [
  {
    title: '亲子家庭',
    tagline: '孩子与父母，并肩探索',
    description: 'AR 寻宝、拼图与轻问答让孩子专注其间，也给父母一个恰到好处的同行角色。',
    pricing: '轻松共读一段历史',
  },
  {
    title: '成人玩家',
    tagline: '朋友、恋人与小队',
    description: '更深的剧情与推理、实时的协作，让一次同行成为可分享、可挑战、值得再来一次的记忆。',
    pricing: '沉浸一场推理',
  },
  {
    title: '远道来客',
    tagline: '跨越语言的文化之旅',
    description: '以实时翻译与故事化的桥接，让远方的来客也能读懂一件文物背后的分量。',
    pricing: '读懂一座城',
  },
];

const businessRows: LandingBusinessRow[] = [
  { title: '交给场馆的创作台', share: '编排', detail: '把内容生产的能力交还给策展人，让每座馆都能持续讲述属于自己的故事。' },
  { title: '面向到访者的旅程', share: '体验', detail: '单条路线、场馆通票或结伴同行——让每个人都能选择自己进入故事的方式。' },
  { title: '为深度场景而生', share: '共创', detail: '面向大型场馆的深度定制与共同运营，让一次合作长成一段长期的陪伴。' },
];

const roadmapStages: LandingRoadmapStage[] = [
  { phase: '起点', time: '此刻', target: '从一座馆开始', detail: '在上海博物馆落地第一段旅程，让编排、生成与体验在真实场景中彼此打磨。' },
  { phase: '生长', time: '不久', target: '走进更多空间', detail: '把结伴、语音与多语言的体验带到更多场馆，让讲述的方式愈发丰盛。' },
  { phase: '成形', time: '之后', target: '长成一片生态', detail: '让共创内容、语音向导与 AR 解谜逐渐汇成一层可以生长的能力。' },
  { phase: '远方', time: '一直', target: '连成一张网络', detail: '让散落各地的文化场景，连成一张可以被反复探索的地图。' },
];

const visionLines = [
  '把一座座真实的文化场景，写成可以走进去的故事。',
  '让每一次探索，都成为一段值得铭记的相遇。',
];

export const useLandingContent = () => ({
  heroStats,
  marketSignals,
  painPoints,
  solutionPillars,
  capabilityRows,
  aiEngineSteps,
  audiences,
  businessRows,
  roadmapStages,
  visionLines,
});
