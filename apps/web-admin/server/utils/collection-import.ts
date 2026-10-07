import type { H3Event } from 'h3';
import { backendFetch, resolveBackendAuthorization, unwrapApiResponse } from '~~/server/utils/backend';
import type { ApiResponse } from '~~/app/types/api';

/**
 * 典藏导入 / 检索 / 平台助手代理的共用包装。
 *
 * 保留后端业务错误，仅将没有标准业务响应的路由缺失归类为接口不可用。
 */

/** 后端未实现该接口时的 data.reason 标记，前端 isBackendEndpointMissing 依赖该值 */
export const BACKEND_ENDPOINT_MISSING_REASON = 'backend_endpoint_missing';

interface BackendErrorLike {
  statusCode?: number;
  data?: unknown;
}

const readBackendStatus = (error: unknown): number => {
  if (!error || typeof error !== 'object') {
    return 0;
  }
  const record = error as BackendErrorLike & { status?: number; statusCode?: number };
  const candidate = record.statusCode ?? record.status;
  return typeof candidate === 'number' ? candidate : 0;
};

const readBackendResponseStatus = (error: unknown): number => {
  if (!error || typeof error !== 'object') {
    return 0;
  }
  const data = (error as BackendErrorLike).data;
  if (!data || typeof data !== 'object') {
    return 0;
  }
  const candidate = (data as Record<string, unknown>).backendStatus;
  return typeof candidate === 'number' ? candidate : 0;
};

const isBackendBusinessError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const data = (error as BackendErrorLike).data;
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (typeof record.code === 'number') return true;
  const response = record.backendResponse;
  return Boolean(response && typeof response === 'object'
    && typeof (response as Record<string, unknown>).code === 'number');
};

export interface BackendProxyOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: object | null;
  /** 后端有该控制器但返回内容不是 JSON（例如 404 页面）时，同样按"接口缺失"提示 */
  treatNonJsonAsMissing?: boolean;
}

/**
 * 调用后端并解包 ApiResponse。
 * 业务错误保留状态和文案；路由缺失与响应格式错误分别提示。
 */
export const callBackendApi = async <T>(
  event: H3Event,
  path: string,
  options: BackendProxyOptions = {},
): Promise<T> => {
  try {
    const response = await backendFetch<ApiResponse<T>>(event, path, {
      method: options.method ?? 'POST',
      query: options.query,
      body: options.body ?? null,
    });

    if (!response || typeof response !== 'object' || typeof response.code !== 'number') {
      throw createError({
        statusCode: 502,
        message: `后端接口 ${path} 返回内容不是标准响应结构，请检查服务地址与发布版本。`,
        data: { path },
      });
    }

    return unwrapApiResponse(response) as T;
  } catch (error) {
    if (isBackendBusinessError(error)) throw error;
    const status = readBackendStatus(error) || readBackendResponseStatus(error);
    if (status === 405) {
      throw createError({
        statusCode: 405,
        message: `后端接口 ${path} 不支持 ${options.method ?? 'POST'} 请求，请检查接口版本。`,
        data: { path, backendStatus: status },
      });
    }
    const isMissing = status === 404 || status === 501;

    if (isMissing) {
      throw createError({
        statusCode: 501,
        message: `当前后端服务未提供接口 ${path}，请检查服务地址与发布版本。`,
        data: {
          reason: BACKEND_ENDPOINT_MISSING_REASON,
          path,
          backendStatus: status,
        },
      });
    }

    throw error;
  }
};

const trimString = (value: unknown): string => String(value ?? '').trim();

export interface CollectionImportRouteIds {
  batchId: string;
  candidateIds: string[];
  version: number | null;
}

/** 从请求体读取批次 ID / 候选条目 ID / 版本，并做一次显式校验 */
export const readCollectionImportRouteIds = (body: {
  batchId?: unknown;
  candidateIds?: unknown;
  version?: unknown;
} | null | undefined): CollectionImportRouteIds => {
  const batchId = trimString(body?.batchId);

  if (!batchId) {
    throw createError({
      statusCode: 400,
      message: '缺少批次 ID（batchId）。',
    });
  }

  const candidateIds = Array.isArray(body?.candidateIds)
    ? Array.from(new Set(body.candidateIds.map((item) => trimString(item)).filter(Boolean)))
    : [];

  const rawVersion = body?.version;
  const version = typeof rawVersion === 'number' && Number.isFinite(rawVersion)
    ? rawVersion
    : (typeof rawVersion === 'string' && rawVersion.trim() && Number.isFinite(Number(rawVersion))
        ? Number(rawVersion)
        : null);

  return { batchId, candidateIds, version };
};

export interface FileDownloadResult {
  body: ArrayBuffer;
  contentType: string;
  fileName: string;
  /** 后端返回 ApiResponse JSON 时（尚未实现文件下发的控制器）携带原始报文 */
  apiMessage: string;
}

interface RawBackendResult {
  ok: boolean;
  status: number;
  contentType: string;
  disposition: string;
  body: ArrayBuffer;
}

const readRawBackend = async (event: H3Event, path: string): Promise<RawBackendResult> => {
  const config = useRuntimeConfig(event);
  const backendBaseUrl = String(config.backendBaseUrl ?? '').trim();

  if (!backendBaseUrl) {
    throw createError({
      statusCode: 500,
      message: '服务端未配置 backendBaseUrl（请设置 NUXT_BACKEND_BASE_URL）。',
      data: { path },
    });
  }

  const normalizedBaseUrl = backendBaseUrl.endsWith('/') ? backendBaseUrl : `${backendBaseUrl}/`;
  const targetUrl = new URL(String(path).replace(/^\//, ''), normalizedBaseUrl);
  const authorization = resolveBackendAuthorization(event);

  const headers: Record<string, string> = { accept: '*/*' };
  if (authorization) {
    headers.authorization = authorization;
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, { method: 'GET', headers });
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: '无法连接后端服务，文件下载失败。',
      data: { path, cause: error instanceof Error ? error.message : String(error) },
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType: String(response.headers.get('content-type') || ''),
    disposition: String(response.headers.get('content-disposition') || ''),
    body: await response.arrayBuffer(),
  };
};

const decodeFileName = (disposition: string, fallback: string): string => {
  // 兼容 filename*=UTF-8''xxx 与 filename="xxx"（后端 FileDownloadPayload 已做 ASCII 回退）
  const extended = /filename\*\s*=\s*([^;]+)/i.exec(disposition)?.[1];
  if (extended) {
    const value = extended.trim().replace(/^UTF-8''/i, '').replace(/^"|"$/g, '');
    try {
      return decodeURIComponent(value);
    } catch {
      return value || fallback;
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)?.[1];
  return plain?.trim() || fallback;
};

const sniffExtension = (contentType: string, fallback: string): string => {
  if (contentType.includes('spreadsheetml') || contentType.includes('sheet')) return 'xlsx';
  if (contentType.includes('csv')) return 'csv';
  if (contentType.includes('pdf')) return 'pdf';
  return fallback;
};

/**
 * 下载后端文件（导入模板 / 错误报告）。
 *
 * 后端契约里的 ICollectionImportService.BuildTemplateAsync / DownloadErrorReportAsync
 * 返回 FileDownloadPayload，控制器应组装 FileStreamResult；若控制器尚未实现，
 * 或返回的是 ApiResponse JSON，则统一转成明确的"接口缺失"错误，避免前端拿到
 * 一个 0 字节文件。
 */
export const downloadBackendFile = async (
  event: H3Event,
  path: string,
  fallbackFileName: string,
): Promise<FileDownloadResult> => {
  const raw = await readRawBackend(event, path);

  if (!raw.ok) {
    const missing = raw.status === 404 || raw.status === 405 || raw.status === 501;
    if (missing) {
      throw createError({
        statusCode: 501,
        message: `后端接口 ${path} 尚未实现或不可用。`,
        data: { reason: BACKEND_ENDPOINT_MISSING_REASON, path, backendStatus: raw.status },
      });
    }
    throw createError({
      statusCode: raw.status,
      message: `后端返回 ${raw.status}，文件下载失败。`,
      data: { path, backendStatus: raw.status },
    });
  }

  const contentType = raw.contentType || 'application/octet-stream';

  // 控制器未实现文件下发、走了全局异常/JSON 通道时，content-type 会是 JSON
  if (contentType.includes('json')) {
    const text = new TextDecoder('utf-8').decode(raw.body);
    throw createError({
      statusCode: 501,
      message: `后端接口 ${path} 尚未支持文件下载。`,
      data: {
        reason: BACKEND_ENDPOINT_MISSING_REASON,
        path,
        apiMessage: text.slice(0, 300),
      },
    });
  }

  const extension = sniffExtension(contentType, 'bin');
  const fileName = raw.disposition
    ? decodeFileName(raw.disposition, fallbackFileName)
    : `${fallbackFileName}.${extension}`;

  return {
    body: raw.body,
    contentType,
    fileName,
    apiMessage: '',
  };
};

/** 把下载结果以附件形式回给浏览器（base64 信封，前端转 Blob 后触发下载） */
export const toDownloadEnvelope = (result: FileDownloadResult) => ({
  fileName: result.fileName,
  contentType: result.contentType,
  size: result.body.byteLength,
  contentBase64: Buffer.from(result.body).toString('base64'),
});

/**
 * 探测后端接口是否存在，用于"接口未实现时前端优雅降级"。
 *
 * 典藏导入模板下载与错误报告是文件流接口，无法用 callBackendApi 的 JSON 解包；
 * 这里独立探测，404/405/501 一律按未实现处理。
 */
export const probeBackendEndpoint = async (event: H3Event, path: string): Promise<boolean> => {
  try {
    const raw = await readRawBackend(event, path);
    return raw.ok || (raw.status !== 404 && raw.status !== 405 && raw.status !== 501);
  } catch {
    return false;
  }
};
