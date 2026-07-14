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

const TOOL_STATUS_LABELS: Record<string, string> = {
  SearchExhibits: '正在搜索文物',
  GetExhibitDetail: '正在读取文物资料',
  CreateRoute: '正在创建路线',
  ListRoutes: '正在读取路线列表',
  SelectRoute: '正在选择路线',
  AddStage: '正在添加路线节点',
  ListStages: '正在读取路线节点',
  UpdateStage: '正在更新路线节点',
  DeleteStage: '正在删除路线节点',
  BuildStagesByAgent: '正在生成路线节点',
  SelectGuide: '正在选择讲解风格',
  GenerateNarration: '正在生成解说词',
  SetNarrationStyle: '正在设置解说风格',
  PreviewRoute: '正在预览路线',
  PublishRoute: '正在发布路线',
};

export const resolveToolStatusLabel = (toolName: string | null | undefined) => {
  const name = String(toolName || '').trim();

  if (!name) {
    return '正在处理';
  }

  return TOOL_STATUS_LABELS[name] || `正在执行 ${name}`;
};
