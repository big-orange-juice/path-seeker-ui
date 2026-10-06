import type { ChatEventResponse, ChatEventType } from '@/types/chat';

export const normalizeChatPayload = <T = unknown>(payload: unknown): T => {
  if (typeof payload !== 'string') {
    return payload as T;
  }

  const trimmed = payload.trim();

  if (!trimmed) {
    return payload as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return payload as T;
  }
};

export const parseChatEventData = (rawData: string): ChatEventResponse | null => {
  if (!rawData.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData) as ChatEventResponse;
    return {
      ...parsed,
      eventId: String(parsed.eventId ?? ''),
      sessionId: String(parsed.sessionId ?? ''),
      runId: String(parsed.runId ?? ''),
      sequence: typeof parsed.sequence === 'number' ? parsed.sequence : 0,
      type: String(parsed.type ?? '') as ChatEventType | string,
      occurredAt: String(parsed.occurredAt ?? ''),
      payload: normalizeChatPayload(parsed.payload),
    };
  } catch {
    return null;
  }
};

const TOOL_STATUS_LABELS: Record<string, { running: string; done: string }> = {
  SearchExhibits: { running: '正在搜索文物', done: '已搜索文物' },
  GetExhibitDetail: { running: '正在读取文物资料', done: '已读取文物资料' },
  CreateRoute: { running: '正在创建路线', done: '已创建路线' },
  ListRoutes: { running: '正在读取路线列表', done: '已读取路线列表' },
  SelectRoute: { running: '正在选择路线', done: '已选择路线' },
  AddStage: { running: '正在添加路线站点', done: '已添加路线站点' },
  ListStages: { running: '正在读取路线站点', done: '已读取路线站点' },
  UpdateStage: { running: '正在更新路线站点', done: '已更新路线站点' },
  DeleteStage: { running: '正在删除路线站点', done: '已删除路线站点' },
  BuildStagesByAgent: { running: '正在生成路线站点', done: '已生成路线站点' },
  SelectGuide: { running: '正在选择讲解风格', done: '已选择讲解风格' },
  GenerateNarration: { running: '正在生成解说词', done: '已生成解说词' },
  SetNarrationStyle: { running: '正在设置解说风格', done: '已设置解说风格' },
  PreviewRoute: { running: '正在预览路线', done: '已预览路线' },
  PublishRoute: { running: '正在发布路线', done: '已发布路线' },
  // 平台助手（§8）专属工具：默认只读白名单 + 手册问答 + 上下文核验
  GetCurrentPageContext: { running: '正在读取已核验的页面上下文', done: '已读取已核验的页面上下文' },
  ListPlatformTools: { running: '正在读取工具白名单', done: '已读取工具白名单' },
  SearchManual: { running: '正在检索操作手册', done: '已检索操作手册' },
  AskManual: { running: '正在查阅操作手册', done: '已查阅操作手册' },
  GetVenueContext: { running: '正在读取场馆上下文', done: '已读取场馆上下文' },
  SearchVenues: { running: '正在搜索场馆', done: '已搜索场馆' },
  SearchCulturalPlaces: { running: '正在搜索文化点', done: '已搜索文化点' },
  CountExhibits: { running: '正在统计典藏', done: '已统计典藏' },
  SearchGuides: { running: '正在搜索导游', done: '已搜索导游' },
  GetStageDetail: { running: '正在读取节点详情', done: '已读取节点详情' },
  ListNarrationStageImages: { running: '正在读取节点配图', done: '已读取节点配图' },
  ValidateRouteDraft: { running: '正在校验路线草稿', done: '已校验路线草稿' },
  GetAsyncTaskResult: { running: '正在查询异步任务', done: '已查询异步任务' },
  GetAsyncImageTaskResult: { running: '正在查询图片任务', done: '已查询图片任务' },
  AnalyzeImages: { running: '正在分析图片', done: '已分析图片' },
  AnalyzeMedia: { running: '正在分析媒体', done: '已分析媒体' },
};

export const resolveToolStatusLabel = (
  toolName: string | null | undefined,
  status: 'running' | 'done' | 'failed' = 'running',
  count = 1,
) => {
  const name = String(toolName || '').trim();
  const safeCount = Number.isFinite(count) && count > 1 ? Math.floor(count) : 1;

  let base: string;

  if (status === 'failed') {
    base = name ? `执行 ${name} 失败` : '处理失败';
  } else if (!name) {
    base = status === 'done' ? '已处理' : '正在处理';
  } else {
    const labels = TOOL_STATUS_LABELS[name];
    base = labels
      ? labels[status]
      : status === 'done'
        ? `已执行 ${name}`
        : `正在执行 ${name}`;
  }

  return safeCount > 1 ? `${base} ×${safeCount}` : base;
};
