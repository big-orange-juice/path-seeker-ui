/**
 * 典藏导入与 AI 联网检索契约（B 端）。
 *
 * 类型严格对应后端：
 * - CulturalTourismSystem.Model/Response/CollectionImportResponses.cs
 * - CulturalTourismSystem.Model/Request/CollectionImportRequests.cs
 * - CulturalTourismSystem.Service/CollectionImport/CollectionImportJson.cs（JSON 载荷结构）
 *
 * 注意：JSON 载荷（overwrite / fieldEvidence / imageLinks）由后端按 camelCase 序列化，
 * 这里保留为宽松记录类型，读取时统一用下方工具函数做安全取值，避免把 any 当兜底。
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonNode = JsonValue | undefined;

/** 批次状态（CollectionImportBatchStatuses） */
export const COLLECTION_IMPORT_BATCH_STATUS = {
  PENDING_PARSE: 0,
  PARSING: 1,
  PENDING_CONFIRM: 2,
  SUBMITTING: 3,
  COMPLETED: 4,
  PARTIAL_COMPLETED: 5,
  FAILED: 6,
  CANCELLED: 7,
} as const;
export type CollectionImportBatchStatus =
  (typeof COLLECTION_IMPORT_BATCH_STATUS)[keyof typeof COLLECTION_IMPORT_BATCH_STATUS];

/** 候选条目状态（CollectionImportCandidateStatuses） */
export const COLLECTION_IMPORT_CANDIDATE_STATUS = {
  PENDING_CONFIRM: 0,
  CONFIRMED: 1,
  SKIPPED: 2,
  COMMITTED: 3,
  FAILED: 4,
} as const;
export type CollectionImportCandidateStatus =
  (typeof COLLECTION_IMPORT_CANDIDATE_STATUS)[keyof typeof COLLECTION_IMPORT_CANDIDATE_STATUS];

/** 来源类型（CollectionImportSourceKinds）：首期固定 1 */
export const COLLECTION_IMPORT_SOURCE_KIND = {
  SPREADSHEET: 1,
  DOCUMENT: 2,
  IMAGE: 3,
  ARCHIVE: 4,
} as const;

/** 目标类型（CollectionImportTargetTypes） */
export const COLLECTION_IMPORT_TARGET_TYPE = {
  EXHIBIT: 1,
  CULTURAL_PLACE: 2,
} as const;
export type CollectionImportTargetType =
  (typeof COLLECTION_IMPORT_TARGET_TYPE)[keyof typeof COLLECTION_IMPORT_TARGET_TYPE];

/** 每页行数：设计文档 §2.3 第 8 条，单批上限 1000 行，预览每页 200 行 */
export const COLLECTION_IMPORT_PAGE_SIZE = 200;
export const COLLECTION_IMPORT_MAX_ROWS = 1000;

/** 内存分页时后端一次性返回的行数上限；超出时提示后端尚未提供检索结果分页接口 */
export const COLLECTION_IMPORT_IN_MEMORY_LIMIT = 1000;

const BATCH_STATUS_TEXT: Record<number, string> = {
  0: '待解析',
  1: '解析中',
  2: '待确认',
  3: '提交中',
  4: '已完成',
  5: '部分完成',
  6: '失败',
  7: '已取消',
};

const CANDIDATE_STATUS_TEXT: Record<number, string> = {
  0: '待确认',
  1: '已确认',
  2: '已跳过',
  3: '已写入',
  4: '写入失败',
};

export const batchStatusText = (status: number | null | undefined): string =>
  BATCH_STATUS_TEXT[Number(status)] ?? '未知状态';

export const candidateStatusText = (status: number | null | undefined): string =>
  CANDIDATE_STATUS_TEXT[Number(status)] ?? '未知状态';

export const targetTypeText = (targetType: number | null | undefined): string =>
  Number(targetType) === COLLECTION_IMPORT_TARGET_TYPE.CULTURAL_PLACE ? '文化点' : '文物';

// ---------------- 响应 ----------------

export interface CollectionImportBatch {
  id: string;
  museumId: string;
  operatorId: string;
  idempotencyKey: string;
  sourceKind: number;
  status: number;
  statusText: string;
  taskId: string | null;
  templateVersion: string | null;
  rowCount: number;
  createCount: number;
  updateCount: number;
  failedCount: number;
  skippedCount: number;
  errorReportAttachmentId: string | null;
  version: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionImportSource {
  id: string;
  batchId: string;
  attachmentId: string;
  contentHash: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sheetName: string | null;
  rowCount: number;
  /** 表头原始列名、列顺序与列映射结论 */
  header: JsonNode;
  /** 0=待解析 1=解析中 2=已完成 3=失败 */
  parseStatus: number;
  parseError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionImportUncertainField {
  field: string;
  label: string;
  reason: string;
  rawValue: string | null;
}

export interface CollectionImportCandidate {
  id: string;
  batchId: string;
  sourceId: string;
  /** 原始行号（表格来源）；网络检索来源为序号 */
  rowNo: number;
  targetType: number;
  targetTypeText: string;
  targetId: string | null;
  targetName: string | null;
  matchConfidence: number | null;
  matchEvidence: string | null;
  /** 拟写入字段 */
  draft: JsonNode;
  /** 对象级覆盖时将被改写的字段与旧值 */
  overwrite: JsonNode;
  /** 逐字段证据 */
  fieldEvidence: JsonNode;
  uncertainFields: CollectionImportUncertainField[];
  /** 图片附件与用途 */
  imageLinks: JsonNode;
  status: number;
  statusText: string;
  targetVersion: number | null;
  committedId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionImportCandidateSummary {
  total: number;
  pendingConfirm: number;
  confirmed: number;
  skipped: number;
  committed: number;
  failed: number;
}

export interface CollectionImportBatchDetail {
  batch: CollectionImportBatch;
  sources: CollectionImportSource[];
  candidateSummary: CollectionImportCandidateSummary;
  /** 错误报告下载地址（服务端路径，由前端携带鉴权头调用） */
  errorReportDownloadUrl: string | null;
}

export interface CollectionImportParseResult {
  batch: CollectionImportBatch;
  source: CollectionImportSource;
  /** 解析出的数据行数（不含表头） */
  rowCount: number;
  /** 列映射结论是否需要人工确认 */
  mappingRequiresConfirmation: boolean;
  unmappedColumns: string[];
  duplicateColumns: string[];
  missingColumns: string[];
}

export interface CollectionImportIssue {
  rowNo: number;
  field: string;
  reason: string;
  rawValue: string | null;
  businessCode: string | null;
}

export interface CollectionImportSubmitResult {
  batchId: string;
  status: number;
  statusText: string;
  rowCount: number;
  createCount: number;
  updateCount: number;
  failedCount: number;
  skippedCount: number;
  errorReportAttachmentId: string | null;
  errorReportDownloadUrl: string | null;
  issues: CollectionImportIssue[];
}

export interface CollectionSearchTask {
  id: string;
  taskCode: string;
  /** 候选条目批次 ID（检索结果写入 collection_import_candidate） */
  batchId: string;
  museumId: string;
  targetType: number;
  targetId: string | null;
  objectName: string | null;
  fields: string[];
  /** 实际使用的模型渠道（豆包优先，DeepSeek 兜底） */
  provider: string | null;
  model: string | null;
  status: number;
  statusText: string;
  requestedByAdminId: string | null;
  candidateIds: string[];
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** 后端 TotalPageResult<List<T>> 的通用外壳 */
export interface TotalPageResult<T> {
  list: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------- 请求 ----------------

export interface CreateCollectionImportBatchPayload {
  museumId: string;
  idempotencyKey: string;
  sourceKind?: number;
  templateVersion?: string | null;
}

export interface ParseCollectionImportPayload {
  batchId: string;
  /** 已通过 UploadFile 上传的原文件附件 ID */
  attachmentId: string;
}

export interface CollectionImportCandidatePagePayload {
  batchId: string;
  pageIndex: number;
  pageSize: number;
  status?: number | null;
  targetType?: number | null;
}

export interface CollectionImportBatchPagePayload {
  pageIndex: number;
  pageSize: number;
  museumId?: string | null;
  status?: number | null;
}

export interface ConfirmCollectionImportCandidatesPayload {
  batchId: string;
  candidateIds: string[];
  /** 是否接受对象级覆盖；为 false 时命中既有对象的条目不允许确认 */
  acceptOverwrite?: boolean;
  /** 批次版本；传入时必须与当前版本一致 */
  version?: number | null;
}

export interface SkipCollectionImportCandidatesPayload {
  batchId: string;
  candidateIds: string[];
}

export interface SubmitCollectionImportPayload {
  batchId: string;
  version?: number | null;
  /** 限定提交的候选条目；为空时提交本批次全部已确认条目 */
  candidateIds?: string[] | null;
}

export interface CreateCollectionSearchPayload {
  museumId: string;
  targetType: number;
  targetId?: string | null;
  objectName?: string | null;
  objectCode?: string | null;
  fields?: string[] | null;
  idempotencyKey: string;
  priority?: number | null;
}

export interface CollectionSearchTaskPagePayload {
  pageIndex: number;
  pageSize: number;
  museumId?: string | null;
  status?: number | null;
  targetId?: string | null;
  mineOnly?: boolean;
}

// ---------------- JSON 载荷读取工具 ----------------

const asRecord = (node: JsonNode): Record<string, JsonValue> | null => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return null;
  }
  return node as Record<string, JsonValue>;
};

const asArray = (node: JsonNode): JsonValue[] => (Array.isArray(node) ? node : []);

export const readString = (value: JsonValue | undefined): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/** overwrite_json 的字段差异：update=改写既有值；fill=原值为空补全 */
export interface CollectionImportFieldChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  change: 'update' | 'fill' | string;
}

export interface CollectionImportOverwriteView {
  mode: string;
  targetId: string;
  matchedBy: string;
  /** 将被改写的字段 */
  fields: CollectionImportFieldChange[];
  /** 导入未提供、保留既有值的字段 */
  retained: CollectionImportFieldChange[];
}

const toFieldChange = (node: JsonValue): CollectionImportFieldChange | null => {
  const record = asRecord(node);
  if (!record) return null;
  return {
    field: readString(record.field),
    label: readString(record.label) || readString(record.field),
    oldValue: readString(record.oldValue),
    newValue: readString(record.newValue),
    change: readString(record.change) || 'update',
  };
};

/** 解析 overwrite_json，用于"将新增 / 将被覆盖"的旧值新值对比 */
export const parseOverwrite = (node: JsonNode): CollectionImportOverwriteView | null => {
  const record = asRecord(node);
  if (!record) return null;
  return {
    mode: readString(record.mode) || 'object',
    targetId: readString(record.targetId),
    matchedBy: readString(record.matchedBy),
    fields: asArray(record.fields)
      .map(toFieldChange)
      .filter((item): item is CollectionImportFieldChange => item !== null),
    retained: asArray(record.retained)
      .map(toFieldChange)
      .filter((item): item is CollectionImportFieldChange => item !== null),
  };
};

/** draft 里的扁平字段：value 已转为展示用字符串 */
export interface CollectionImportDraftEntry {
  field: string;
  value: string;
}

/**
 * 展平 draft_json 供差异预览。
 * 后端 draft 与 CreateExhibitRequest / CreateCulturalPlaceRequest 同构，
 * 因此子对象（扩展属性、档案）逐层展开为 "父.子" 形式，避免预览丢字段。
 */
export const flattenDraft = (node: JsonNode, prefix = ''): CollectionImportDraftEntry[] => {
  const entries: CollectionImportDraftEntry[] = [];

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      if (item && typeof item === 'object') {
        entries.push(...flattenDraft(item, `${prefix}[${index}]`));
        return;
      }
      entries.push({ field: `${prefix}[${index}]`, value: readString(item) });
    });
    return entries;
  }

  const record = asRecord(node);
  if (record) {
    for (const [key, value] of Object.entries(record)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') {
        entries.push(...flattenDraft(value, path));
        continue;
      }
      if (value === null || value === undefined || value === '') {
        continue;
      }
      entries.push({ field: path, value: readString(value) });
    }
    return entries;
  }

  if (node !== null && node !== undefined && node !== '') {
    entries.push({ field: prefix || 'value', value: readString(node) });
  }

  return entries;
};

/** image_links_json：已解析的图片归属 */
export interface CollectionImportImageLink {
  attachmentId: string;
  fileName: string;
  /** cover=封面/主图；detail=细节图 */
  usage: string;
}

export interface CollectionImportImageView {
  resolved: CollectionImportImageLink[];
  /** 表格里写了但没有匹配到附件的文件名 */
  unresolved: string[];
}

export const parseImageLinks = (node: JsonNode): CollectionImportImageView => {
  const record = asRecord(node);
  if (!record) {
    return { resolved: [], unresolved: [] };
  }
  return {
    resolved: asArray(record.resolved)
      .map((item) => {
        const link = asRecord(item);
        if (!link) return null;
        return {
          attachmentId: readString(link.attachmentId),
          fileName: readString(link.fileName),
          usage: readString(link.usage) || 'detail',
        } satisfies CollectionImportImageLink;
      })
      .filter((item): item is CollectionImportImageLink => item !== null),
    unresolved: asArray(record.unresolved)
      .map((item) => readString(item))
      .filter((item) => item.length > 0),
  };
};

/** field_evidence_json：逐字段证据（表格或网络） */
export interface CollectionImportFieldEvidence {
  source: string;
  sourceId: string;
  fileName: string;
  sheetName: string;
  provider: string;
  model: string;
  retrievedAt: string;
  /** 字段名 → 证据明细（行号/列名/原始值，或 URL/标题/摘录） */
  fields: Record<string, Record<string, string>>;
}

export const parseFieldEvidence = (node: JsonNode): CollectionImportFieldEvidence | null => {
  const record = asRecord(node);
  if (!record) return null;

  const fields: Record<string, Record<string, string>> = {};
  const rawFields = asRecord(record.fields);
  if (rawFields) {
    for (const [field, detail] of Object.entries(rawFields)) {
      const detailRecord = asRecord(detail);
      if (!detailRecord) {
        fields[field] = { value: readString(detail) };
        continue;
      }
      const flattened: Record<string, string> = {};
      for (const [key, value] of Object.entries(detailRecord)) {
        if (value && typeof value === 'object') {
          flattened[key] = JSON.stringify(value);
          continue;
        }
        flattened[key] = readString(value);
      }
      fields[field] = flattened;
    }
  }

  return {
    source: readString(record.source) || 'spreadsheet',
    sourceId: readString(record.sourceId),
    fileName: readString(record.fileName),
    sheetName: readString(record.sheetName),
    provider: readString(record.provider),
    model: readString(record.model),
    retrievedAt: readString(record.retrievedAt),
    fields,
  };
};

/** 证据来源中文名，用于"表格证据 / 网络证据"分栏展示 */
export const evidenceSourceText = (source: string): string =>
  source === 'web' ? '联网检索' : source === 'spreadsheet' ? '导入表格' : source || '未知来源';

/**
 * 图片列的原始多值表达（设计文档 §2.3 第 9 条：单列用逗号分隔多个文件名）。
 * 后端 CollectionImportSchema.ImageSeparators 还接受中文逗号、分号、竖线与换行。
 */
export const IMAGE_NAME_SEPARATORS = /[,，;；|\n\r]+/;

export const splitImageNames = (raw: string): string[] =>
  raw.split(IMAGE_NAME_SEPARATORS).map((item) => item.trim()).filter(Boolean);
