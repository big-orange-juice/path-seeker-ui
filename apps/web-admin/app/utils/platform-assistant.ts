import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';
import type { PlatformAssistantManualHit } from '@/types/platform-assistant';

/**
 * 平台助手错误码与手册出处解析。
 *
 * 后端错误码（CulturalTourismSystem.Common/Exceptions/ErrorCodes.cs，19000-19999 段）：
 * - 19001 PlatformAssistantDisabled 平台助手未启用
 * - 19002 ManualNotConfigured     未配置手册路径或手册文件不存在
 * - 19003 ManualIndexUnavailable  手册索引不可用（构建失败 / 未切出章节）
 *
 * 后端统一由 GlobalExceptionFilter 返回 HTTP 400 + { code, message, traceId }，
 * Nuxt 代理（server/utils/backend.ts）会把它放进 error.data，useApiClient 再保留 data。
 * 这里把错误链上各层的 code 都翻出来，避免页面只能看到笼统的"请求失败"。
 */
export const PLATFORM_ASSISTANT_ERROR_CODES = {
  disabled: 19001,
  manualNotConfigured: 19002,
  manualIndexUnavailable: 19003,
} as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** 收集错误对象上可能承载业务码的层级：error.data / error.data.data / error.cause.data … */
const collectErrorPayloads = (error: unknown): Record<string, unknown>[] => {
  if (!isRecord(error)) {
    return [];
  }

  const payloads: Record<string, unknown>[] = [error];
  const direct = error.data;

  if (isRecord(direct)) {
    payloads.push(direct);

    if (isRecord(direct.data)) {
      payloads.push(direct.data);
    }
  }

  const cause = error.cause;

  if (isRecord(cause)) {
    payloads.push(cause);

    if (isRecord(cause.data)) {
      payloads.push(cause.data);
    }
  }

  return payloads;
};

/** 读取后端业务错误码；读不到返回 null */
export const readPlatformAssistantErrorCode = (error: unknown): number | null => {
  for (const payload of collectErrorPayloads(error)) {
    const code = readNumber(payload.code);

    if (code !== null && code !== 0) {
      return code;
    }
  }

  return null;
};

/** 手册类错误码（19002/19003）的明确文案；非手册错误返回空串 */
export const describeManualErrorCode = (code: number | null): string => {
  switch (code) {
    case PLATFORM_ASSISTANT_ERROR_CODES.manualNotConfigured:
      return '后端未配置操作手册：PlatformAssistant:Manual:Path 未设置，或该路径下没有手册 PDF。'
        + '手册检索与问答当前不可用，需要运维把手册放到配置路径后再重建索引。';
    case PLATFORM_ASSISTANT_ERROR_CODES.manualIndexUnavailable:
      return '后端手册索引不可用：索引尚未成功构建（例如 PDF 未切分出章节、扫描件无法抽取文本）。'
        + '可以点"重建索引"重试；若仍失败，请核对后端返回的失败原因。';
    default:
      return '';
  }
};

/**
 * 统一错误文案：19001/19002/19003 给出明确说明，其余交给通用解析。
 * fallback 用于兜底（例如网络失败）。
 */
export const describePlatformAssistantError = (
  error: unknown,
  fallback = '请求失败，请稍后重试',
): string => {
  const code = readPlatformAssistantErrorCode(error);
  const manualMessage = describeManualErrorCode(code);

  if (manualMessage) {
    return manualMessage;
  }

  if (code === PLATFORM_ASSISTANT_ERROR_CODES.disabled) {
    return '平台助手当前未启用（后端 PlatformAssistant:Enabled = false）。请让运维开启后再使用。';
  }

  return resolveHttpErrorMessage(error, fallback);
};

/** 出处页码区间文案：第 12-14 页 / 第 12 页 */
export const formatManualPageRange = (hit: PlatformAssistantManualHit): string => {
  const start = Number.isFinite(hit.pageStart) ? hit.pageStart : 0;
  const end = Number.isFinite(hit.pageEnd) ? hit.pageEnd : start;

  if (start <= 0) {
    return '页码未标注';
  }

  return end > start ? `第 ${start}-${end} 页` : `第 ${start} 页`;
};

const readString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
};

const pickString = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = readString(record[key]).trim();

    if (value) {
      return value;
    }
  }

  return '';
};

const pickNumber = (record: Record<string, unknown>, keys: string[]): number => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return 0;
};

/** tool 结果可能是 JSON 字符串（历史回放），尽力解一层 */
const unwrapResult = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

/**
 * 把一条原始条目映射为手册出处；缺少章节标题与页码的条目视为非手册来源，丢弃，
 * 避免把联网检索的 sources（只有 url/title）误标成手册出处。
 */
const toManualHit = (value: unknown): PlatformAssistantManualHit | null => {
  if (!isRecord(value)) {
    return null;
  }

  const chapterTitle = pickString(value, ['chapterTitle', 'chapter', 'section', 'heading']);
  const pageStart = pickNumber(value, ['pageStart', 'page', 'pageNo', 'pageNumber']);

  if (!chapterTitle && pageStart <= 0) {
    return null;
  }

  const pageEnd = pickNumber(value, ['pageEnd']);

  return {
    chapterIndex: pickNumber(value, ['chapterIndex', 'index']),
    chapterTitle,
    pageStart,
    pageEnd: pageEnd >= pageStart ? pageEnd : pageStart,
    score: pickNumber(value, ['score', 'relevance']),
    excerpt: pickString(value, ['excerpt', 'snippet', 'quote', 'content']),
  };
};

const HIT_COLLECTION_KEYS = ['citations', 'hits', 'manualHits', 'manualMatches'] as const;

const collectHitArrays = (value: unknown, depth = 0): unknown[] => {
  if (depth > 2 || !isRecord(value)) {
    return [];
  }

  const arrays: unknown[] = [];

  for (const key of HIT_COLLECTION_KEYS) {
    const candidate = value[key];

    if (Array.isArray(candidate)) {
      arrays.push(...candidate);
    }
  }

  // tool.call.result 事件把工具返回值放在 result 里（可能是对象，也可能是 JSON 字符串）
  const result = unwrapResult(value.result);

  if (isRecord(result)) {
    arrays.push(...collectHitArrays(result, depth + 1));
  }

  return arrays;
};

/**
 * 从 SSE 事件载荷中解析手册出处。
 *
 * 平台助手 AskManual / SearchManual 工具返回：
 * `{ available, manualVersion, noManualMatch, answer, citations: [{ chapterTitle, pageStart, pageEnd, score, excerpt }] }`，
 * 由 ChatSessionService 以 `tool.call.result` 事件的 `result` 字段下发。
 */
export const extractManualCitations = (payload: unknown): PlatformAssistantManualHit[] => {
  const candidates = collectHitArrays(unwrapResult(payload));
  const hits: PlatformAssistantManualHit[] = [];

  for (const candidate of candidates) {
    const hit = toManualHit(candidate);

    if (!hit) {
      continue;
    }

    const duplicated = hits.some((existing) =>
      existing.chapterTitle === hit.chapterTitle
      && existing.pageStart === hit.pageStart
      && existing.pageEnd === hit.pageEnd
      && existing.excerpt === hit.excerpt);

    if (!duplicated) {
      hits.push(hit);
    }
  }

  return hits;
};

/** 合并出处（去重，保持原有顺序） */
export const mergeManualCitations = (
  current: PlatformAssistantManualHit[],
  incoming: PlatformAssistantManualHit[],
): PlatformAssistantManualHit[] => {
  if (!incoming.length) {
    return current;
  }

  const merged = [...current];

  for (const hit of incoming) {
    const duplicated = merged.some((existing) =>
      existing.chapterTitle === hit.chapterTitle
      && existing.pageStart === hit.pageStart
      && existing.pageEnd === hit.pageEnd
      && existing.excerpt === hit.excerpt);

    if (!duplicated) {
      merged.push(hit);
    }
  }

  return merged;
};

/** 时间展示：yyyy-MM-dd HH:mm（无法解析时原样返回；接受 ISO 字符串或毫秒时间戳） */
export const formatAssistantTime = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value).trim());

  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' ? value.trim() : '';
  }

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} `
    + `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

/** 毫秒耗时展示 */
export const formatDurationMs = (value: number | null | undefined): string => {
  const ms = Number(value ?? 0);

  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }

  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} 秒` : `${Math.round(ms)} 毫秒`;
};

/** 上下文/裁剪字段的中文名 */
export const PLATFORM_ASSISTANT_CONTEXT_FIELD_LABELS: Record<string, string> = {
  path: '当前路径',
  museumId: '场馆',
  collectionId: '典藏',
  routeId: '路线',
  stageId: '路线节点',
  guideId: '解说导游',
};

export const resolveContextFieldLabel = (field: string): string =>
  PLATFORM_ASSISTANT_CONTEXT_FIELD_LABELS[field] ?? field;
