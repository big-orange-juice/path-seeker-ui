import { computed, shallowRef } from 'vue';
import type { AppIconName } from '@/components/ui/AppIcon.vue';

export interface AdminMetric {
  label: string;
  value: string;
  note: string;
  icon: AppIconName;
}

export interface InfoRow {
  name: string;
  description: string;
  value?: string;
}

export interface TableColumn {
  key: string;
  label: string;
}

export interface ThemeRoute {
  id: number;
  title: string;
  type: string;
  ageGroup: string;
  duration: string;
  summary: string;
  structure: string[];
  reward: string;
  status: 'published' | 'draft' | 'review';
}

export interface MilestoneStage {
  title: string;
  target: string;
  details: string;
}

const adminMetrics: AdminMetric[] = [
  { label: '内容资产', value: '128', note: '馆藏、故事、标签统一入库', icon: 'library-big' },
  { label: '主题路线', value: '12', note: '含 4 条可发布样板线', icon: 'route' },
  { label: '分龄题库', value: '64', note: '覆盖 6-10 与 10-15 两档', icon: 'puzzle' },
  { label: '运营活动', value: '8', note: '节日专题与馆校合作可复用', icon: 'megaphone' },
];

const positioningRows: InfoRow[] = [
  { name: '项目名称建议', description: 'Path Seeker Museum / 秘径寻踪' },
  { name: '产品目标', description: '将传统看展升级为边探索边解谜边获得故事反馈的沉浸式导览体验' },
  { name: '核心价值', description: '提升年轻用户参与度、家庭停留时长与馆藏传播力' },
  { name: '产品形态', description: 'B 端管理后台 + C 端微信小程序' },
];

const businessModelRows: InfoRow[] = [
  { name: '博物馆管理者', description: '维护馆藏、题库、主题路线与活动数据', value: '提高布展利用率与活动效率' },
  { name: '策展 / 教研人员', description: '围绕文物创建多年龄谜题与故事任务', value: '将教育内容转为互动体验' },
  { name: '游客 / 家长 / 学生', description: '参与解谜任务并获得导览反馈与成就', value: '更沉浸、更完整地走完展线' },
];

const conceptRows: InfoRow[] = [
  { name: '内容资产化', description: '文物资料、故事、题目、路线都沉淀为可复用资产' },
  { name: '路线游戏化', description: '参观路径不只是导航，而是任务推进路径' },
  { name: '年龄适配', description: '同一文物支持不同年龄难度题目' },
  { name: '低打扰沉浸', description: '轻量 UI 服务于线下观展，不喧宾夺主' },
  { name: '运营可持续', description: '节日、临展、馆校活动都能快速组合新主题' },
];

const bModuleColumns: TableColumn[] = [
  { key: 'module', label: '模块' },
  { key: 'description', label: '功能说明' },
  { key: 'value', label: '价值' },
];

const bModules: Array<Record<string, string>> = [
  { module: '基础数据管理', description: '维护博物馆、展馆楼层、展厅、展柜、标签和主题分类', value: '打通内容基础设施' },
  { module: '馆藏内容管理', description: '维护文物图文、音频、年代、材质、作者、故事和位置', value: '建立高质量内容底座' },
  { module: '主题剧本编排', description: '按主题、路线、时长将多个谜题组合成完整游戏', value: '形成 C 端可玩产品' },
  { module: '审核与发布', description: '支持未上架、审核、上架、下线与版本管理', value: '控制内容质量' },
];

const cModuleColumns: TableColumn[] = [
  { key: 'module', label: '模块' },
  { key: 'description', label: '功能说明' },
  { key: 'gameplay', label: '游戏感体现' },
];

const cModules: Array<Record<string, string>> = [
  { module: '首页世界观入口', description: '展示主题任务、限时活动与推荐路线', gameplay: '像进入冒险大厅' },
  { module: '故事引导页', description: '通过开场动画、旁白与目标说明建立代入', gameplay: '进入剧情状态' },
  { module: '章节地图', description: '呈现当前展厅、已解锁线索和下一目标提示', gameplay: '像闯关地图' },
  { module: '收集与成就系统', description: '印章、碎片、徽章、角色卡和称号解锁', gameplay: '建立持续动力' },
];

const flowStages: MilestoneStage[] = [
  { title: '1. 内容准备', target: '录入馆藏、展厅、标签与媒体资源', details: '让每条路线都有可复用内容底座。' },
  { title: '2. 出题设计', target: '为单件文物创建多年龄层谜题', details: '围绕观察、排序、推理与剧情判断扩展题型。' },
  { title: '3. 主题编排', target: '组合剧情线、章节、奖励与终局', details: '把分散谜题整合成完整的任务副本。' },
  { title: '4. 发布上线', target: '审核并发布为可玩游戏', details: '控制内容质量与版本节奏。' },
  { title: '5. 复盘运营', target: '分析卡点并持续调整路线', details: '形成节日活动与馆校合作的长期机制。' },
];

const collectionColumns: TableColumn[] = [
  { key: 'item', label: '数据项' },
  { key: 'description', label: '说明' },
];

const collectionFields: Array<Record<string, string>> = [
  { item: '基础信息', description: '名称、编号、年代、作者 / 出土地、材质、尺寸、朝代、级别' },
  { item: '展示信息', description: '当前展厅、展柜号、推荐停留时长、是否热门' },
  { item: '媒体资源', description: '封面图、细节图、音频讲解、短视频、360 图' },
  { item: '知识标签', description: '历史、工艺、人物、故事、纹样、器型、功能、地域' },
  { item: '剧情素材', description: '可作为线索的要素、可隐藏的秘密点、可做反转的故事点' },
  { item: '出题素材', description: '适合观察的细节、适合比较的差异、适合推理的关系' },
];

const themeRouteSeed: ThemeRoute[] = [
  {
    id: 1,
    title: '失落的龙纹密令',
    type: '亲子冒险',
    ageGroup: '6-10 岁',
    duration: '20-30 分钟',
    summary: '馆内一段关于龙纹的秘密线索被拆散，孩子需要在不同展品中找回它。',
    structure: ['龙纹初现', '找到三段线索', '破解图案密码', '解锁真相'],
    reward: '龙纹守护者徽章',
    status: 'published',
  },
  {
    id: 2,
    title: '画卷背后的消失人物',
    type: '剧情推理',
    ageGroup: '10-15 岁',
    duration: '30-45 分钟',
    summary: '玩家需要综合题跋、服饰与时代背景，判断古画中的关键人物身份。',
    structure: ['接收密档', '观察画中细节', '追踪时代信息', '排除错误身份', '结案'],
    reward: '画境侦探称号',
    status: 'review',
  },
  {
    id: 3,
    title: '谁改写了王朝时间线',
    type: '深度推理',
    ageGroup: '15+',
    duration: '40-60 分钟',
    summary: '数件馆藏背后的年代信息出现矛盾，玩家需要重构事件链并找出错误来源。',
    structure: ['异常档案', '时间线碎片', '多证据交叉', '最终判断'],
    reward: '时序解码者称号',
    status: 'draft',
  },
];

const operationColumns: TableColumn[] = [
  { key: 'dimension', label: '维度' },
  { key: 'metrics', label: '核心指标' },
];

const operationMetrics: Array<Record<string, string>> = [
  { dimension: '参与度', metrics: '启动人数、开始率、平均会话时长、进入任务详情率' },
  { dimension: '完成度', metrics: '通关率、分章节流失率、平均提示次数' },
  { dimension: '内容质量', metrics: '各题正确率、卡关题 Top10、被跳过题比例' },
  { dimension: '馆藏传播', metrics: '热门文物访问量、音频播放率、详情页停留时长' },
  { dimension: '运营效果', metrics: '节日活动参与率、复访率、分享率、勋章领取率' },
  { dimension: '分龄效果', metrics: '各年龄段完成率、平均时长、最适合路线识别' },
];

const milestoneStages: MilestoneStage[] = [
  { title: '第一阶段', target: '快速验证', details: '先做 1 个馆、1 条主题线、10-15 个谜题、2 个年龄层。' },
  { title: '第二阶段', target: '形成标准化能力', details: '完善题型模板、路线编排、活动配置和数据分析。' },
  { title: '第三阶段', target: '提升复用与增长', details: '支持多馆复制、馆际联动、节日专题与学校研学版本。' },
];

const mvpRows: InfoRow[] = [
  { name: 'B 端范围', description: '馆藏管理、谜题管理、主题编排、发布管理、基础数据看板' },
  { name: 'C 端范围', description: '任务列表、剧情开场、章节地图、4-5 种基础题型、勋章奖励、结局海报' },
  { name: '内容范围', description: '1 条 20-30 分钟路线，覆盖 8-12 个关键节点' },
  { name: '年龄范围', description: '先支持 6-10 与 10-15 两档' },
  { name: '运营方式', description: '配合线下导览活动或周末家庭活动上线测试' },
];

export function useAdminContent() {
  const routeFilter = shallowRef<'all' | ThemeRoute['status']>('all');
  const routeSearch = shallowRef('');

  const filteredThemeRoutes = computed(() => {
    const query = routeSearch.value.trim().toLowerCase();

    return themeRouteSeed.filter((route) => {
      const matchesFilter = routeFilter.value === 'all' ? true : route.status === routeFilter.value;
      const matchesQuery = query
        ? [route.title, route.type, route.summary, route.ageGroup].some((field) =>
            field.toLowerCase().includes(query),
          )
        : true;

      return matchesFilter && matchesQuery;
    });
  });

  return {
    adminMetrics,
    positioningRows,
    businessModelRows,
    conceptRows,
    bModuleColumns,
    bModules,
    cModuleColumns,
    cModules,
    flowStages,
    collectionColumns,
    collectionFields,
    routeFilter,
    routeSearch,
    filteredThemeRoutes,
    operationColumns,
    operationMetrics,
    milestoneStages,
    mvpRows,
  };
}