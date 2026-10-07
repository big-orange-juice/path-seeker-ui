import { computed, ref, shallowRef } from 'vue';
import type {
  CollectionImportBatch,
  CollectionImportBatchDetail,
  CollectionImportCandidate,
  CollectionImportParseResult,
  CollectionImportSource,
  CollectionImportSubmitResult,
  TotalPageResult,
} from '@/types/collection-import';
import {
  COLLECTION_IMPORT_BATCH_STATUS,
  COLLECTION_IMPORT_CANDIDATE_STATUS,
  COLLECTION_IMPORT_PAGE_SIZE,
} from '@/types/collection-import';
import { isBackendEndpointMissing } from '@/composables/useApiClient';

export type CollectionImportStep = 'prepare' | 'preview' | 'result';

/** 模板文件下载信封（服务端 base64 回传） */
interface DownloadEnvelope {
  fileName: string;
  contentType: string;
  size: number;
  contentBase64: string;
}

const EMPTY_SUMMARY = {
  total: 0,
  pendingConfirm: 0,
  confirmed: 0,
  skipped: 0,
  committed: 0,
  failed: 0,
};

const createIdempotencyKey = (museumId: string, file: File | null): string => {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const name = file?.name ?? 'manual';
  const size = file?.size ?? 0;
  return `import-${museumId}-${size}-${name}-${stamp}-${random}`.slice(0, 128);
};


const createSearchKey = (museumId: string, targetType: number, targetKey: string): string => {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `search-${museumId}-${targetType}-${targetKey}-${stamp}-${random}`.slice(0, 128);
};

/** 把 base64 信封落成浏览器下载 */
const triggerDownload = (envelope: DownloadEnvelope) => {
  const binary = atob(envelope.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: envelope.contentType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = envelope.fileName || 'download';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/**
 * 典藏导入前端会话状态。
 *
 * 设计依据 doc/b-admin-functional-optimization-plan.md §4：
 * 下载模板 → 上传 → 后台解析 → 候选分页预览（差异对比）→ 逐条/批量确认或跳过 → 提交入库 → 结果与错误报告。
 *
 * 后端 WebApi 目前还没有 CollectionImportController（只有 ICollectionImportService 契约）。
 * 接口不存在时 server 代理返回 501 + reason='backend_endpoint_missing'，
 * 本 composable 会把 backendUnavailable 置为 true，页面据此整体降级提示，而不是让每个按钮各自报错。
 */
export const useCollectionImport = () => {
  let activeImportAttemptKey = '';
  const { request, upload } = useApiClient();

  const activeMuseumId = ref('');
  const step = ref<CollectionImportStep>('prepare');

  const batch = shallowRef<CollectionImportBatch | null>(null);
  // 同 candidates：来源资料含递归 JsonValue(headerJson/extraJson)，用 shallowRef 避免深层解包，
  // 该数组只做整体赋值，不做原地修改。
  const sources = shallowRef<CollectionImportSource[]>([]);
  const candidateSummary = ref({ ...EMPTY_SUMMARY });
  const parseResult = shallowRef<CollectionImportParseResult | null>(null);
  const submitResult = shallowRef<CollectionImportSubmitResult | null>(null);
  const errorReportUrl = ref('');

  // 候选条目含递归 JsonValue 字段，用 shallowRef 避免 Vue 的深层类型解包触发 TS2589；
  // 该数组只做整体赋值，不做原地修改，因此浅引用完全够用。
  const candidates = shallowRef<CollectionImportCandidate[]>([]);
  const selectedCandidateIds = ref<string[]>([]);
  const pageIndex = ref(1);
  const totalPages = ref(1);
  const total = ref(0);

  /** 所选文件（先上传取附件 ID，再按批次解析） */
  const selectedFile = shallowRef<File | null>(null);
  const uploadedAttachmentId = ref('');
  const columnMapping = ref<Record<string, string>>({});
  const imageAttachmentIds = ref<string[]>([]);
  const mappingAccepted = ref(false);

  const busy = ref(false);
  const uploadPercent = ref(0);
  const error = ref('');
  /** 后端接口尚未实现：整页降级 */
  const backendUnavailable = ref(false);

  const rowsPerPage = COLLECTION_IMPORT_PAGE_SIZE;

  const hasBatch = computed(() => Boolean(batch.value?.id));
  const canParse = computed(() => Boolean(batch.value?.id) && Boolean(selectedFile.value) && !busy.value);

  // 说明：候选类型较重，这里显式标注并用循环替代 Array.filter + computed 的泛型推断，
  // 否则 vue-tsc 会报 TS2589（类型实例化过深）。
  const confirmableCandidates = computed<CollectionImportCandidate[]>(() => {
    const target: number = COLLECTION_IMPORT_CANDIDATE_STATUS.PENDING_CONFIRM;
    const result: CollectionImportCandidate[] = [];
    for (const candidate of candidates.value) {
      if (candidate.status === target) {
        result.push(candidate);
      }
    }
    return result;
  });

  const selectedCount = computed(() => selectedCandidateIds.value.length);

  const createCount = computed(() => batch.value?.createCount ?? candidateSummary.value.committed);
  const updateCount = computed(() => batch.value?.updateCount ?? 0);
  const failedCount = computed(() => batch.value?.failedCount ?? candidateSummary.value.failed);
  const skippedCount = computed(() => batch.value?.skippedCount ?? candidateSummary.value.skipped);

  const markBackendUnavailable = (caught: unknown, fallback: string): boolean => {
    if (isBackendEndpointMissing(caught)) {
      backendUnavailable.value = true;
      error.value = `${fallback}后端 CollectionImport 接口尚未实现（当前仓库只有 ICollectionImportService 契约）。功能已按"接口不存在时明确提示"降级，接口上线后无需改动前端。`;
      return true;
    }
    return false;
  };

  /** 采纳后端返回的批次对象（Create 返回批次对象；Parse 返回 batch + source） */
  const applyBatch = (next: CollectionImportBatch) => {
    batch.value = next;
  };

  function resetSession() {
    activeImportAttemptKey = '';
    batch.value = null;
    sources.value = [];
    candidateSummary.value = { ...EMPTY_SUMMARY };
    parseResult.value = null;
    submitResult.value = null;
    errorReportUrl.value = '';
    candidates.value = [];
    selectedCandidateIds.value = [];
    pageIndex.value = 1;
    totalPages.value = 1;
    total.value = 0;
    selectedFile.value = null;
    columnMapping.value = {};
    imageAttachmentIds.value = [];
    uploadedAttachmentId.value = '';
    uploadPercent.value = 0;
    error.value = '';
    step.value = 'prepare';
  }

  function selectFile(file: File | null) {
    selectedFile.value = file;
    uploadedAttachmentId.value = '';
    uploadPercent.value = 0;
    error.value = '';
    activeImportAttemptKey = '';
  }

  /** 上传所选文件（走既有 /api/uploads/file，先拿 attachmentId） */
  async function uploadSelectedFile(): Promise<string> {
    const file = selectedFile.value;
    if (!file) {
      error.value = '请先选择要导入的 XLSX 或 CSV 文件。';
      return '';
    }

    const formData = new FormData();
    formData.append('file', file);
    uploadPercent.value = 0;

    const attachment = await upload<{ fileId: string | null; fileUrl: string | null }>(
      '/api/uploads/file',
      formData,
      (percentage) => { uploadPercent.value = percentage; },
    );

    const attachmentId = String(attachment?.fileId ?? '').trim();
    if (!attachmentId) {
      throw new Error('文件上传后未返回附件 ID，请重试。');
    }

    uploadedAttachmentId.value = attachmentId;
    uploadPercent.value = 100;
    return attachmentId;
  }

  /**
   * 下载导入模板。
   * 模板分文物 / 景点两套（景点模板含补充资料与深度档案），由后端按目的地类型决定；
   * 未选目的地时后端回落到文物模板。
   */
  async function downloadTemplate(museumId = ''): Promise<boolean> {
    error.value = '';
    busy.value = true;
    try {
      const envelope = await request<DownloadEnvelope>('/api/collection-import/template', {
        query: museumId ? { museumId } : undefined,
      });
      triggerDownload(envelope);
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '模板下载失败：')) {
        error.value = caught instanceof Error ? caught.message : '模板下载失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 创建批次 → 上传文件 → 解析 */
  async function startImport(): Promise<boolean> {
    if (!activeMuseumId.value) {
      error.value = '请先选择目标场馆/目的地。';
      return false;
    }

    if (!selectedFile.value) {
      error.value = '请先选择要导入的 XLSX 或 CSV 文件。';
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      const created = await request<CollectionImportBatch>('/api/collection-import/create', {
        method: 'POST',
        body: {
          museumId: activeMuseumId.value,
          idempotencyKey: activeImportAttemptKey || (activeImportAttemptKey = createIdempotencyKey(activeMuseumId.value, selectedFile.value)),
          sourceKind: 1,
        },
      });

      const batchId = String(created?.id ?? '').trim();
      if (!batchId) {
        throw new Error('创建导入批次失败：未返回批次 ID。');
      }
      applyBatch(created);

      const attachmentId = uploadedAttachmentId.value || await uploadSelectedFile();

      const parsed = await request<CollectionImportParseResult>('/api/collection-import/parse', {
        method: 'POST',
        body: { batchId, attachmentId, columnMapping: columnMapping.value, imageAttachmentIds: imageAttachmentIds.value, runAsync: true },
      });

      parseResult.value = parsed;
      if (parsed?.batch) {
        applyBatch(parsed.batch);
      }
      if (parsed?.source) {
        sources.value = [parsed.source];
      }
      if (!await waitForImportTask()) return false;

      step.value = 'preview';
      pageIndex.value = 1;
      await loadCandidates(1);
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '解析失败：')) {
        error.value = caught instanceof Error ? caught.message : '解析失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 候选条目分页预览 */
  async function loadCandidates(targetPage = pageIndex.value, status: number | null = null): Promise<boolean> {
    if (!batch.value?.id) {
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      const result = await request<TotalPageResult<CollectionImportCandidate>>(
        '/api/collection-import/candidates',
        {
          method: 'POST',
          body: {
            batchId: batch.value.id,
            pageIndex: targetPage,
            pageSize: rowsPerPage,
            status,
          },
        },
      );

      candidates.value = result?.list ?? [];
      pageIndex.value = result?.pageIndex ?? targetPage;
      totalPages.value = Math.max(1, result?.totalPages ?? 1);
      total.value = result?.total ?? candidates.value.length;
      selectedCandidateIds.value = [];
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '候选条目加载失败：')) {
        error.value = caught instanceof Error ? caught.message : '候选条目加载失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 刷新批次详情与候选统计 */
  async function refreshBatch(): Promise<boolean> {
    if (!batch.value?.id) {
      return false;
    }

    try {
      const detail = await request<CollectionImportBatchDetail>('/api/collection-import/detail', {
        method: 'POST',
        body: { batchId: batch.value.id },
      });
      applyBatch(detail.batch);
      sources.value = detail.sources ?? [];
      const source = sources.value[0];
      if (source?.header && typeof source.header === 'object' && !Array.isArray(source.header)) {
        const header = source.header as Record<string, unknown>;
        if (Array.isArray(header.image_attachment_ids)) imageAttachmentIds.value = header.image_attachment_ids.map(String);
        parseResult.value = {
          batch: detail.batch, source, rowCount: source.rowCount,
          mappingRequiresConfirmation: header.requires_confirmation === true,
          missingColumns: Array.isArray(header.missing) ? header.missing.map(String) : [],
          duplicateColumns: Array.isArray(header.duplicates) ? header.duplicates.map(String) : [],
          unmappedColumns: Array.isArray(header.unmapped) ? header.unmapped.map(String) : [],
        };
      }
      candidateSummary.value = detail.candidateSummary ?? { ...EMPTY_SUMMARY };
      errorReportUrl.value = detail.errorReportDownloadUrl ?? '';
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '批次详情加载失败：')) {
        error.value = caught instanceof Error ? caught.message : '批次详情加载失败。';
      }
      return false;
    }
  }

  async function waitForImportTask(): Promise<boolean> {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (!await refreshBatch()) return false;
      const status = batch.value?.taskStatus;
      if (status === 5 || status == null) return true;
      if (status === 6 || status === 8) {
        error.value = batch.value?.taskError || '后台任务失败或已取消，请查看失败记录。';
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    error.value = '任务仍在后台处理，可稍后刷新批次查看结果。';
    return false;
  }

  async function reparseMapping(): Promise<boolean> {
    const source = sources.value[0];
    if (!batch.value?.id || !source?.attachmentId || busy.value) return false;
    busy.value = true;
    error.value = '';
    mappingAccepted.value = false;
    try {
      await request<CollectionImportParseResult>('/api/collection-import/parse', {
        method: 'POST',
        body: { batchId: batch.value.id, attachmentId: source.attachmentId, columnMapping: columnMapping.value, imageAttachmentIds: imageAttachmentIds.value, runAsync: true },
      });
      if (!await waitForImportTask()) return false;
      await loadCandidates(1);
      return true;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '重新映射失败。';
      return false;
    } finally { busy.value = false; }
  }

  /**
   * 直接按批次 ID 加载候选条目。
   *
   * AI 联网检索（ICollectionSearchService）把结果写进同一张 collection_import_candidate
   * 表并通过 batchId 暴露，因此检索入口不需要先创建导入批次，直接把批次 ID 灌进来
   * 复用同一份预览 / 确认 / 跳过 / 提交逻辑（设计文档 §7）。
   */
  async function loadBatchCandidates(targetBatchId: string): Promise<boolean> {
    const batchId = String(targetBatchId ?? '').trim();
    if (!batchId) {
      error.value = '缺少候选条目批次 ID。';
      return false;
    }

    batch.value = { id: batchId } as CollectionImportBatch;
    step.value = 'preview';
    pageIndex.value = 1;

    // 批次详情可能不存在（检索场景），失败不阻塞预览
    await refreshBatch();
    return loadCandidates(1);
  }

  function toggleCandidate(candidateId: string, checked: boolean) {
    const next = new Set(selectedCandidateIds.value);
    if (checked) {
      next.add(candidateId);
    } else {
      next.delete(candidateId);
    }
    selectedCandidateIds.value = [...next];
  }

  function toggleAllCandidates(checked: boolean) {
    selectedCandidateIds.value = checked
      ? confirmableCandidates.value.map((candidate) => candidate.id)
      : [];
  }

  /** 确认候选条目：ids 为空时使用当前勾选 */
  async function confirmCandidates(ids: string[] = []): Promise<boolean> {
    const target = ids.length ? ids : selectedCandidateIds.value;
    if (!batch.value?.id) {
      error.value = '请先创建导入批次。';
      return false;
    }
    if (!target.length) {
      error.value = '请至少选择一条候选条目。';
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      await request<number>('/api/collection-import/confirm', {
        method: 'POST',
        body: {
          batchId: batch.value.id,
          candidateIds: target,
          acceptOverwrite: true,
          acceptMapping: mappingAccepted.value,
          version: batch.value.version,
        },
      });
      await refreshBatch();
      await loadCandidates(pageIndex.value);
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '确认失败：')) {
        error.value = caught instanceof Error ? caught.message : '确认失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 跳过候选条目 */
  async function skipCandidates(ids: string[] = []): Promise<boolean> {
    const target = ids.length ? ids : selectedCandidateIds.value;
    if (!batch.value?.id) {
      error.value = '请先创建导入批次。';
      return false;
    }
    if (!target.length) {
      error.value = '请至少选择一条候选条目。';
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      await request<number>('/api/collection-import/skip', {
        method: 'POST',
        body: { batchId: batch.value.id, candidateIds: target },
      });
      await refreshBatch();
      await loadCandidates(pageIndex.value);
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '跳过失败：')) {
        error.value = caught instanceof Error ? caught.message : '跳过失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 提交入库：只写入已确认条目 */
  async function commitImport(): Promise<boolean> {
    if (!batch.value?.id) {
      error.value = '请先创建导入批次。';
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      const result = await request<CollectionImportSubmitResult>('/api/collection-import/commit', {
        method: 'POST',
        body: { batchId: batch.value.id, version: batch.value.version, runAsync: true },
      });
      submitResult.value = result;
      errorReportUrl.value = result?.errorReportDownloadUrl ?? '';
      if (!await waitForImportTask()) return false;
      submitResult.value = { ...result, status: batch.value?.status ?? result.status, createCount: createCount.value, updateCount: updateCount.value, failedCount: failedCount.value, skippedCount: skippedCount.value };
      step.value = 'result';
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '提交入库失败：')) {
        error.value = caught instanceof Error ? caught.message : '提交入库失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 下载错误报告 */
  async function downloadErrorReport(): Promise<boolean> {
    if (!batch.value?.id) {
      return false;
    }

    error.value = '';
    busy.value = true;
    try {
      const envelope = await request<DownloadEnvelope>('/api/collection-import/error-report', {
        query: { batchId: batch.value.id },
      });
      triggerDownload(envelope);
      return true;
    } catch (caught) {
      if (!markBackendUnavailable(caught, '错误报告下载失败：')) {
        error.value = caught instanceof Error ? caught.message : '错误报告下载失败。';
      }
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 探测后端接口是否可用（进入页面时调用一次，提前给出整体提示） */
  async function probeBackend(): Promise<boolean> {
    try {
      await request<TotalPageResult<CollectionImportBatch[]>>('/api/collection-import/page', {
        method: 'POST',
        body: { pageIndex: 1, pageSize: 1 },
      });
      backendUnavailable.value = false;
      return true;
    } catch (caught) {
      if (markBackendUnavailable(caught, '导入批次查询不可用：')) {
        return false;
      }
      // 其它错误（例如未选择场馆）不影响功能可用性
      return true;
    }
  }

  return {
    // 状态
    activeMuseumId,
    step,
    batch,
    sources,
    candidateSummary,
    parseResult,
    submitResult,
    errorReportUrl,
    candidates,
    selectedCandidateIds,
    pageIndex,
    totalPages,
    total,
    rowsPerPage,
    selectedFile,
    uploadedAttachmentId,
    columnMapping,
    imageAttachmentIds,
    mappingAccepted,
    uploadPercent,
    busy,
    error,
    backendUnavailable,
    // 计算
    hasBatch,
    canParse,
    confirmableCandidates,
    selectedCount,
    createCount,
    updateCount,
    failedCount,
    skippedCount,
    // 操作
    resetSession,
    selectFile,
    downloadTemplate,
    startImport,
    reparseMapping,
    loadCandidates,
    loadBatchCandidates,
    refreshBatch,
    toggleCandidate,
    toggleAllCandidates,
    confirmCandidates,
    skipCandidates,
    commitImport,
    downloadErrorReport,
    probeBackend,
  };
};

/**
 * AI 联网检索：提交单条任务并轮询状态，结果写入同一份候选条目契约。
 * 与导入共用候选预览 / 确认 / 跳过 / 提交接口，不另写一套。
 */
export const useCollectionSearch = () => {
  const { request } = useApiClient();

  const submitting = ref(false);
  const error = ref('');
  const backendUnavailable = ref(false);
  const task = shallowRef<{ id: string; batchId: string; status: number; statusText: string; provider: string | null; model: string | null; errorMessage: string | null } | null>(null);
  const polling = ref(false);

  const candidateBatchId = computed(() => task.value?.batchId ?? '');
  const finished = computed(() => Boolean(task.value) && [4, 5, 6, 7].includes(Number(task.value?.status)));

  const markUnavailable = (caught: unknown, fallback: string): boolean => {
    if (isBackendEndpointMissing(caught)) {
      backendUnavailable.value = true;
      error.value = `${fallback}后端 CollectionSearch 接口尚未实现（当前仓库只有 ICollectionSearchService 契约）。`;
      return true;
    }
    return false;
  };

  /**
   * 提交单条检索。
   * targetId 为空时按 ObjectName 检索并生成新建草稿（后端契约行为）。
   */
  async function submit(payload: {
    museumId: string;
    targetType: number;
    targetId?: string | null;
    objectName?: string | null;
    objectCode?: string | null;
    fields?: string[] | null;
  }): Promise<boolean> {
    if (!payload.museumId) {
      error.value = '缺少目标场馆/目的地 ID。';
      return false;
    }

    const targetKey = String(payload.targetId || payload.objectName || '').trim();
    if (!targetKey) {
      error.value = '请提供目标对象 ID 或对象名称。';
      return false;
    }

    error.value = '';
    submitting.value = true;
    try {
      const created = await request<typeof task.value>('/api/collection-search/submit', {
        method: 'POST',
        body: {
          ...payload,
          idempotencyKey: createSearchKey(payload.museumId, payload.targetType, targetKey),
        },
      });
      task.value = created;
      return Boolean(created?.id);
    } catch (caught) {
      if (!markUnavailable(caught, '提交联网检索失败：')) {
        error.value = caught instanceof Error ? caught.message : '提交联网检索失败。';
      }
      return false;
    } finally {
      submitting.value = false;
    }
  }

  /** 轮询任务状态；由调用方在进入预览前等待完成 */
  async function pollTask(options: { intervalMs?: number; maxAttempts?: number } = {}): Promise<boolean> {
    const intervalMs = options.intervalMs ?? 3000;
    const maxAttempts = options.maxAttempts ?? 60;
    const taskId = task.value?.id;

    if (!taskId) {
      error.value = '尚未提交检索任务。';
      return false;
    }

    polling.value = true;
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const current = await request<typeof task.value>('/api/collection-search/task', {
          query: { taskId },
        });
        task.value = current;
        const status = Number(current?.status);
        if ([4, 5, 6, 8].includes(status)) {
          if (status === 6 && current?.errorMessage) {
            error.value = current.errorMessage;
          }
          return status === 4 || status === 5;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      error.value = '检索任务超时，请稍后在批次列表中查看结果。';
      return false;
    } catch (caught) {
      if (!markUnavailable(caught, '查询检索任务失败：')) {
        error.value = caught instanceof Error ? caught.message : '查询检索任务失败。';
      }
      return false;
    } finally {
      polling.value = false;
    }
  }

  function reset() {
    task.value = null;
    error.value = '';
  }

  return {
    submitting,
    polling,
    error,
    backendUnavailable,
    task,
    candidateBatchId,
    finished,
    submit,
    pollTask,
    reset,
  };
};
