import type { RouteMapDetail } from '@/types/route-map';
import { parseRouteLine } from '@/utils/route-map-geometry';

export function routeMapGenerationFeedback(detail: RouteMapDetail, segmentNo?: number) {
  const messages = detail.validationMessages;
  if (segmentNo != null) {
    const stations = [...detail.stations].sort((left, right) => left.stationNo - right.stationNo);
    const index = stations.findIndex(station => station.stationNo === segmentNo);
    const from = stations[index];
    const to = stations[index + 1];
    const segment = detail.segments.find(item => item.segmentNo === segmentNo
      && item.fromStationId === from?.id && item.toStationId === to?.id);
    if (!segment || segment.status !== 1 || segment.validationMessage || parseRouteLine(segment.geometryGeoJson).length < 2) {
      return { tone: 'info' as const, title: '该路段仍需处理', description:
        segment?.validationMessage || segment?.errorMessage || `第 ${segmentNo} 段未生成有效路线，请检查提示后重试。` };
    }
  }
  if (detail.geometryStatus !== 'ready' || messages.length) {
    return { tone: 'info' as const, title: segmentNo == null ? '生成结果仍需处理' : `第 ${segmentNo} 段已生成，整线尚未完成`,
      description: messages.join('；') || '仍有路段待生成或修复，请查看标记为待处理的路段。' };
  }
  return { tone: 'success' as const, title: '生成完成', description: segmentNo == null
    ? '全部路段已就绪，可以确认路线。' : `第 ${segmentNo} 段已重新生成，全部路段已就绪，可以确认路线。` };
}
