import { downloadBackendFile, toDownloadEnvelope } from '~~/server/utils/collection-import';

/**
 * 下载导入模板（XLSX）。
 *
 * 后端契约：ICollectionImportService.BuildTemplateAsync() 返回 FileDownloadPayload，
 * 控制器组装 FileStreamResult。模板列见 CollectionImportSchema.Columns：
 * 业务编码、名称、分类、所属场馆、所属区域、简介、年代、尺寸、来源、图片文件名（逗号分隔多值）。
 *
 * 该控制器在当前仓库中尚未实现，接口不存在时返回 501 并带
 * data.reason='backend_endpoint_missing'，页面提示"模板下载接口尚未上线"。
 */
export default defineEventHandler(async (event) => {
  const result = await downloadBackendFile(event, '/CollectionImport/template/download', '典藏导入模板.xlsx');
  return toDownloadEnvelope(result);
});
