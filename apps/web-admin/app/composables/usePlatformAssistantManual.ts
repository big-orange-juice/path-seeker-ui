import { computed, ref, shallowRef } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import { PLATFORM_ASSISTANT_API } from '@/composables/usePlatformAssistant';
import type {
  PlatformAssistantManualAnswerResponse,
  PlatformAssistantManualHit,
  PlatformAssistantManualSearchResponse,
  PlatformAssistantManualStatusResponse,
} from '@/types/platform-assistant';
import {
  PLATFORM_ASSISTANT_ERROR_CODES,
  describePlatformAssistantError,
  formatDurationMs,
  readPlatformAssistantErrorCode,
} from '@/utils/platform-assistant';

/**
 * 平台助手操作手册（本地 PDF）面板状态。
 *
 * 对接后端：
 * - GET  /api/PlatformAssistant/manual/status   索引状态（未配置/文件缺失不抛异常）
 * - POST /api/PlatformAssistant/manual/reindex  强制重建索引
 * - GET  /api/PlatformAssistant/manual/search   章节检索（章节 + 页码区间）
 * - POST /api/PlatformAssistant/manual/ask      问答（答案 + 出处）
 *
 * 手册未配置（19002）或索引不可用（19003）时给出明确文案，而不是笼统报错。
 */
export const usePlatformAssistantManual = () => {
  const { request } = useApiClient();

  const status = shallowRef<PlatformAssistantManualStatusResponse | null>(null);
  const statusLoading = ref(false);
  const statusLoaded = ref(false);
  const statusError = ref('');

  const reindexing = ref(false);
  const reindexNotice = ref('');
  const reindexError = ref('');

  const keyword = ref('');
  const searchLoading = ref(false);
  const searchError = ref('');
  const searchErrorCode = ref<number | null>(null);
  const searchResult = shallowRef<PlatformAssistantManualSearchResponse | null>(null);

  const question = ref('');
  const askLoading = ref(false);
  const askError = ref('');
  const askErrorCode = ref<number | null>(null);
  const answer = shallowRef<PlatformAssistantManualAnswerResponse | null>(null);

  const configured = computed(() => Boolean(status.value?.configured));
  const fileExists = computed(() => Boolean(status.value?.fileExists));
  const indexAvailable = computed(() => Boolean(status.value?.indexAvailable));

  /** 手册是否可用于检索/问答 */
  const manualReady = computed(() => indexAvailable.value);

  const version = computed(() => String(status.value?.version ?? '').trim());
  const chapterCount = computed(() => Number(status.value?.chapterCount ?? 0));
  const pageCount = computed(() => Number(status.value?.pageCount ?? 0));
  const builtAt = computed(() => String(status.value?.builtAt ?? '').trim());
  const lastError = computed(() => String(status.value?.lastError ?? '').trim());
  const filePath = computed(() => String(status.value?.filePath ?? '').trim());
  const cachePath = computed(() => String(status.value?.cachePath ?? '').trim());
  const buildDurationLabel = computed(() => formatDurationMs(status.value?.buildDurationMs));

  const hits = computed<PlatformAssistantManualHit[]>(() => searchResult.value?.hits ?? []);
  const citations = computed<PlatformAssistantManualHit[]>(() => answer.value?.citations ?? []);

  /** 索引不可用时的明确原因（未配置 / 文件缺失 / 构建失败） */
  const unavailableReason = computed(() => {
    const current = status.value;

    if (!current) {
      return '';
    }

    if (!current.configured) {
      return '后端未配置操作手册路径（PlatformAssistant:Manual:Path 为空），手册检索与问答不可用。'
        + '手册为本地 PDF、更新为线下操作：需要运维在配置文件里指定路径并放置 PDF。';
    }

    if (!current.fileExists) {
      return `手册文件不存在：${filePath.value || '（未返回路径）'}。`
        + '请把 PDF 放到该路径后点击"重建索引"。';
    }

    if (!current.indexAvailable) {
      return current.lastError
        ? `手册索引不可用：${current.lastError}`
        : '手册索引不可用：后端尚未成功构建索引，可点击"重建索引"重试。';
    }

    return '';
  });

  const loadStatus = async () => {
    if (statusLoading.value) {
      return status.value;
    }

    statusLoading.value = true;
    statusError.value = '';

    try {
      const result = await request<PlatformAssistantManualStatusResponse>(
        PLATFORM_ASSISTANT_API.manualStatus,
        { method: 'GET' },
      );
      status.value = result ?? null;
      statusLoaded.value = true;
      return status.value;
    } catch (error) {
      statusError.value = describePlatformAssistantError(error, '手册索引状态读取失败。');
      return null;
    } finally {
      statusLoading.value = false;
    }
  };

  const reindex = async () => {
    if (reindexing.value) {
      return null;
    }

    reindexing.value = true;
    reindexError.value = '';
    reindexNotice.value = '';

    try {
      const result = await request<PlatformAssistantManualStatusResponse>(
        PLATFORM_ASSISTANT_API.manualReindex,
        { method: 'POST' },
      );
      status.value = result ?? null;
      statusLoaded.value = true;

      const pages = Number(result?.pageCount ?? 0);
      const chapters = Number(result?.chapterCount ?? 0);
      const duration = formatDurationMs(result?.buildDurationMs);
      const versionLabel = String(result?.version ?? '').trim();

      reindexNotice.value = `手册索引已重建：版本 ${versionLabel || '未知'}，`
        + `${pages} 页 / ${chapters} 个章节${duration ? `，耗时 ${duration}` : ''}。`;
      return status.value;
    } catch (error) {
      reindexError.value = describePlatformAssistantError(error, '手册索引重建失败。');
      return null;
    } finally {
      reindexing.value = false;
    }
  };

  const search = async () => {
    const text = keyword.value.trim();

    if (!text) {
      searchErrorCode.value = null;
      searchError.value = '请输入检索关键词（建议用手册里出现的功能名或字段名）。';
      return null;
    }

    searchLoading.value = true;
    searchError.value = '';
    searchErrorCode.value = null;

    try {
      const result = await request<PlatformAssistantManualSearchResponse>(
        PLATFORM_ASSISTANT_API.manualSearch,
        { method: 'GET', query: { keyword: text, topK: 5 } },
      );
      searchResult.value = result ?? null;
      return searchResult.value;
    } catch (error) {
      searchResult.value = null;
      searchErrorCode.value = readPlatformAssistantErrorCode(error);
      searchError.value = describePlatformAssistantError(error, '手册章节检索失败，请稍后重试。');
      return null;
    } finally {
      searchLoading.value = false;
    }
  };

  const ask = async () => {
    const text = question.value.trim();

    if (!text) {
      askErrorCode.value = null;
      askError.value = '请输入要问手册的问题。';
      return null;
    }

    askLoading.value = true;
    askError.value = '';
    askErrorCode.value = null;

    try {
      const result = await request<PlatformAssistantManualAnswerResponse>(
        PLATFORM_ASSISTANT_API.manualAsk,
        { method: 'POST', body: { question: text } },
      );
      answer.value = result ?? null;
      return answer.value;
    } catch (error) {
      answer.value = null;
      askErrorCode.value = readPlatformAssistantErrorCode(error);
      askError.value = describePlatformAssistantError(error, '手册问答失败，请稍后重试。');
      return null;
    } finally {
      askLoading.value = false;
    }
  };

  const clearSearch = () => {
    searchResult.value = null;
    searchError.value = '';
    searchErrorCode.value = null;
  };

  const clearAnswer = () => {
    answer.value = null;
    askError.value = '';
    askErrorCode.value = null;
  };

  /** 是否因为手册不可用（19002/19003）而失败，便于 UI 提示去重建索引 */
  const isManualUnavailableCode = (code: number | null): boolean =>
    code === PLATFORM_ASSISTANT_ERROR_CODES.manualNotConfigured
    || code === PLATFORM_ASSISTANT_ERROR_CODES.manualIndexUnavailable;

  return {
    // 状态
    status,
    statusLoading,
    statusLoaded,
    statusError,
    configured,
    fileExists,
    indexAvailable,
    manualReady,
    version,
    chapterCount,
    pageCount,
    builtAt,
    lastError,
    filePath,
    cachePath,
    buildDurationLabel,
    unavailableReason,
    // 重建
    reindexing,
    reindexNotice,
    reindexError,
    reindex,
    // 检索
    keyword,
    searchLoading,
    searchError,
    searchErrorCode,
    searchResult,
    hits,
    search,
    clearSearch,
    // 问答
    question,
    askLoading,
    askError,
    askErrorCode,
    answer,
    citations,
    ask,
    clearAnswer,
    // 状态加载
    loadStatus,
    isManualUnavailableCode,
  };
};
