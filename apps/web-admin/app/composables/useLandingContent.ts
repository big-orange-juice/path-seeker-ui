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
  { value: '$3000亿', label: '全球文旅数字化 TAM', note: '互动体验与智慧旅游仍在持续扩张。' },
  { value: '2 小时', label: '单条 10 节点路线创建', note: '把原本高门槛的定制开发压缩成运营可执行流程。' },
  { value: '3 分钟', label: 'AI 谜题生成时长', note: '从展品素材到题干、答案、提示快速闭环。' },
  { value: '200+', label: '目标覆盖场馆', note: '从上博试点走向全国复制与入境游场景。' },
];

const marketSignals: LandingHighlight[] = [
  { title: '万亿级市场切口', description: '文旅数字化规模仍在增长，但解谜式沉浸导览还没有形成平台型基础设施。' },
  { title: '需求已发生迁移', description: 'Z 世代、亲子家庭和朋友组队用户，正在从“看展”切换到“边玩边学边分享”。' },
  { title: 'AI 降低供给门槛', description: '多模态理解、RAG 与生成式叙事让内容生产从一次性项目走向标准化能力。' },
];

const painPoints: LandingHighlight[] = [
  { title: 'B 端做不起', description: '传统定制开发需要 6 到 12 个月，单路线成本高，内容一旦上线就很难持续更新。' },
  { title: 'C 端玩不深', description: '多数产品仍停留在语音导览，缺少剧情、协作、成就与复游驱动力。' },
  { title: '外宾体验断层', description: '跨语言、跨文化解释成本高，导致优质内容很难真正被国际游客消费。' },
];

const solutionPillars: LandingHighlight[] = [
  { title: 'B 端创作台', description: '像画思维导图一样编排路线，用节点拖拽、模板库和版本管理完成内容生产。' },
  { title: 'AI 内容引擎', description: '负责理解展品、补全知识、生成剧情、推荐难度，并为多语言体验提供底层能力。' },
  { title: 'C 端解谜体验', description: '以移动端任务流承接真实场景中的探索、协作、奖励和社交分享闭环。' },
];

const capabilityRows: LandingHighlight[] = [
  { title: '路线编辑器', description: '支持线性探索、分支剧情、开放寻宝、竞速挑战和主题特展五种路线模型。' },
  { title: 'AI 辅助创作', description: '多模态输入后自动生成 8+ 题型、多语言剧情与适龄版本，保留人工审核权。' },
  { title: '数据与运营', description: '完成率、热力图、漏斗与活动奖励配置一起服务内容迭代与复盘。' },
];

const aiEngineSteps: LandingHighlight[] = [
  { title: '多模态输入', description: '图像、文字、语音和已有标签一起进入理解管线。' },
  { title: 'RAG 知识增强', description: '把馆藏知识库、策展资料和场馆规则接到生成前链路。' },
  { title: '四层质检', description: '在事实、规则、风格与人工复核层面控制可用率与安全边界。' },
];

const audiences: LandingAudience[] = [
  {
    title: '亲子家庭',
    tagline: '6-12 岁儿童 + 家长协作',
    description: 'AR 寻宝、拼图与轻问答帮助孩子保持专注，也让家长有明确的陪伴角色。',
    pricing: '¥50-100 / 家庭',
  },
  {
    title: '成人玩家',
    tagline: '朋友、情侣、小队沉浸式游玩',
    description: '更强剧情、更深推理与实时协作，让文旅路线具备可分享、可挑战、可复玩的乐趣。',
    pricing: '¥20-50 / 人',
  },
  {
    title: '入境外宾',
    tagline: '多语言文化主题体验',
    description: '以实时翻译、故事化桥接与免注册链路降低文化理解门槛，拓展入境游消费场景。',
    pricing: '$5-10 / 人',
  },
];

const businessRows: LandingBusinessRow[] = [
  { title: 'SaaS 订阅', share: '50%', detail: '面向场馆分档收费，用标准化平台替代高成本定制开发。' },
  { title: 'C 端付费', share: '35%', detail: '覆盖单路线、场馆通票、会员制与外宾包，做路线级转化。' },
  { title: '企业定制', share: '15%', detail: '服务大型场馆的私有化部署、API 对接与深度运营服务。' },
];

const roadmapStages: LandingRoadmapStage[] = [
  { phase: 'MVP', time: '第 1-3 月', target: '上海博物馆试点验证', detail: '先跑通 B 端编辑器、AI 生成 V1 与亲子 / 成人小程序内测。' },
  { phase: '增长', time: '第 3-6 月', target: '复制到 5-10 个场馆', detail: '补齐组队、语音、外宾版与更成熟的内容生产能力。' },
  { phase: '成熟', time: '第 6-12 月', target: '平台化开放生态', detail: '把 PUGC 内容平台、AI 语音助手与 AR 解谜逐步纳入能力层。' },
  { phase: '愿景', time: '12 月 +', target: '全国覆盖与出海试点', detail: '形成 200+ 场馆、100+ 城市的文化探索网络。' },
];

const visionLines = [
  '把真实文化场景转化为一场剧情式解谜冒险。',
  '让每一次文化探索都成为一场值得铭记的发现。',
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
