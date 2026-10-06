import { downloadBackendFile, toDownloadEnvelope } from '~~/server/utils/collection-import';

/**
 * 下载批次错误报告（XLSX，全部后台账号可用）。
 *
 * 后端契约：ICollectionImportService.DownloadErrorReportAsync(batchId) 返回 FileDownloadPayload。
 * 报告包含行号、字段、原因与原始值；后端负责对以 =、+、-、@ 开头的单元格做转义（设计文档 §4.4）。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const batchId = String(query.batchId ?? '').trim();

  if (!batchId) {
    throw createError({ statusCode: 400, message: '缺少批次 ID（batchId）。' });
  }

  const result = await downloadBackendFile(
    event,
    `/CollectionImport/error-report/download?batchId=${encodeURIComponent(batchId)}`,
    `典藏导入错误报告-${batchId}.xlsx`,
  );

  return toDownloadEnvelope(result);
});
