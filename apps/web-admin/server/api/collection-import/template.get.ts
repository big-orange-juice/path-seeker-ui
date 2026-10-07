import { downloadBackendFile, toDownloadEnvelope } from '~~/server/utils/collection-import';

/**
 * 下载导入模板（XLSX）。
 *
 * 模板列随目标类型变化：传 museumId 时后端按该目的地的 venue_type 判定——
 * 景区/古镇/户外景点给文化点模板（基础字段 + 补充资料 + 深度档案），
 * 其余给文物模板；不传时按文物模板输出。
 *
 * 后端契约：ICollectionImportService.BuildTemplateAsync() 返回 FileDownloadPayload，
 * 控制器组装 FileStreamResult。接口不存在时返回 501 并带
 * data.reason='backend_endpoint_missing'，页面提示"模板下载接口尚未上线"。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const museumId = typeof query.museumId === 'string' ? query.museumId.trim() : '';
  const path = museumId
    ? `/CollectionImport/template/download?museumId=${encodeURIComponent(museumId)}`
    : '/CollectionImport/template/download';
  const result = await downloadBackendFile(event, path, '典藏导入模板.xlsx');
  return toDownloadEnvelope(result);
});
