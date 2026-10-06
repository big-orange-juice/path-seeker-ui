import { computed, ref, shallowRef } from 'vue';
import type {
  RouteMapDetail,
  RouteMapSegment,
  RouteMapStation,
} from '@/types/route-map';
import {
  normalizePoints,
  parseRouteLine,
  polylineLengthMeters,
  pointsSignature,
  ROUTE_SEGMENT_SOURCE,
  serializeRouteLine,
  type LngLat,
} from '@/utils/route-map-geometry';

/** 编辑会话内的单个路段草稿 */
export interface RouteMapEditorSegment {
  /** 路段序号，与 route_map_segment.segment_no 一致，也等于起点站序号 */
  segmentNo: number;
  fromStationId: string;
  toStationId: string;
  fromTitle: string;
  toTitle: string;
  /** 服务端当前来源类型：1=自动 2=人工；无路段时为 0（待生成） */
  serverSourceType: number;
  /** 服务端当前几何顶点，用于"还原"与差异比较；数据库值，不随编辑变化 */
  serverPoints: LngLat[];
  /** 编辑中的顶点（含起终点，WGS84） */
  points: LngLat[];
  /** 是否被编辑过（与 serverPoints 不同） */
  dirty: boolean;
  distanceMeters: number | null;
  estimatedMinutes: number | null;
  /** 会话内错误提示（例如顶点不足） */
  error: string;
}

export interface UseRouteMapEditorOptions {
  /** 加载后应用到宿主的状态；保存成功后回写，便于宿主同步统计 */
  onDetailApplied?: (detail: RouteMapDetail) => void;
}

const HISTORY_LIMIT = 50;

const clonePoints = (points: readonly LngLat[]): LngLat[] =>
  points.map((point) => [point[0], point[1]] as LngLat);

const interpolate = (from: LngLat, to: LngLat): LngLat => [
  (from[0] + to[0]) / 2,
  (from[1] + to[1]) / 2,
];

/**
 * 路线手动编辑（顶点级）会话状态。
 *
 * 设计依据 doc/b-admin-functional-optimization-plan.md §6：
 * - 编辑在既有分段模型上扩展：顶点拖动、增删顶点、撤销重做（仅会话内）。
 * - 起终点强制固定为站点坐标，保存时后端会再次校验相邻站点与端点连接。
 * - 吸附开关只影响本次保存，不改变已保存几何（保存时作为 snapToRoad 提交）。
 * - 版本冲突时保留草稿，由调用方提示并提供"重新载入"。
 */
export const useRouteMapEditor = (options: UseRouteMapEditorOptions = {}) => {
  const { request } = useApiClient();

  const routeId = ref('');
  const detail = shallowRef<RouteMapDetail | null>(null);
  const segments = ref<RouteMapEditorSegment[]>([]);
  const activeSegmentNo = ref<number | null>(null);
  /** null = 使用服务端已有几何；否则为本次编辑中的顶点 */
  const editingPoints = shallowRef<LngLat[] | null>(null);
  const snapToRoad = ref(true);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  /** 服务端在本次编辑会话开始时的几何版本，用于冲突检测 */
  const baseGeometryVersion = ref<number | null>(null);
  const undoStack = shallowRef<string[]>([]);
  const redoStack = shallowRef<string[]>([]);

  const stations = computed<RouteMapStation[]>(() => detail.value?.stations ?? []);

  const activeSegment = computed(() =>
    segments.value.find((segment) => segment.segmentNo === activeSegmentNo.value) ?? null);

  const dirtySegments = computed(() => segments.value.filter((segment) => segment.dirty));

  const hasDirty = computed(() => dirtySegments.value.length > 0);

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  /** 渲染用几何：编辑中的路段用草稿覆盖，其余用服务端几何 */
  const previewPointsBySegmentNo = computed<Record<number, LngLat[]>>(() => {
    const map: Record<number, LngLat[]> = {};
    for (const segment of segments.value) {
      map[segment.segmentNo] = segment.dirty
        ? clonePoints(segment.points)
        : clonePoints(segment.serverPoints);
    }
    return map;
  });

  const dirtySegmentNos = computed(() =>
    segments.value.filter((segment) => segment.dirty).map((segment) => segment.segmentNo));

  const geometryVersion = computed(() => detail.value?.geometryVersion ?? 0);
  const validationMessages = computed(() => detail.value?.validationMessages ?? []);

  /** 顶点是否固定：起点与终点必须回到站点坐标 */
  const isFixedVertex = (segment: RouteMapEditorSegment, index: number): boolean =>
    index === 0 || index === segment.points.length - 1;

  const pushHistory = (points: readonly LngLat[]) => {
    const next = [...undoStack.value, pointsSignature(points)];
    undoStack.value = next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    redoStack.value = [];
  };

  const settleSegment = (segment: RouteMapEditorSegment) => {
    segment.points = normalizePoints(segment.points);
    segment.dirty = pointsSignature(segment.points) !== pointsSignature(segment.serverPoints);
    segment.error = '';
  };

  function buildSegments(source: RouteMapDetail): RouteMapEditorSegment[] {
    const ordered = [...source.stations].sort((left, right) => left.stationNo - right.stationNo);
    const result: RouteMapEditorSegment[] = [];

    for (let index = 1; index < ordered.length; index += 1) {
      const from = ordered[index - 1]!;
      const to = ordered[index]!;
      const server: RouteMapSegment | undefined = source.segments
        .find((item) => item.segmentNo === from.stationNo);
      const serverPoints = parseRouteLine(server?.geometryGeoJson ?? null);
      const points = serverPoints.length >= 2
        ? clonePoints(serverPoints)
        : [
            [Number(from.longitude), Number(from.latitude)] as LngLat,
            [Number(to.longitude), Number(to.latitude)] as LngLat,
          ];

      result.push({
        segmentNo: from.stationNo,
        fromStationId: from.id,
        toStationId: to.id,
        fromTitle: from.title,
        toTitle: to.title,
        serverSourceType: server?.sourceType ?? 0,
        serverPoints: clonePoints(serverPoints),
        points,
        dirty: false,
        distanceMeters: server?.distanceMeters ?? null,
        estimatedMinutes: server?.estimatedMinutes ?? null,
        error: '',
      });
    }

    return result;
  }

  /** 服务端返回后重新装载；有草稿时由调用方决定是否覆盖 */
  function applyDetail(source: RouteMapDetail) {
    detail.value = source;
    segments.value = buildSegments(source);
    baseGeometryVersion.value = source.geometryVersion;
    activeSegmentNo.value = segments.value.length
      ? (segments.value.some((item) => item.segmentNo === activeSegmentNo.value)
          ? activeSegmentNo.value
          : segments.value[0]!.segmentNo)
      : null;
    editingPoints.value = null;
    undoStack.value = [];
    redoStack.value = [];
    options.onDetailApplied?.(source);
  }

  function resetEditor() {
    detail.value = null;
    segments.value = [];
    activeSegmentNo.value = null;
    editingPoints.value = null;
    baseGeometryVersion.value = null;
    undoStack.value = [];
    redoStack.value = [];
    error.value = '';
    routeId.value = '';
  }

  async function load(targetRouteId?: string, force = false): Promise<RouteMapDetail | null> {
    const nextRouteId = String(targetRouteId ?? routeId.value ?? '').trim();
    if (!nextRouteId) {
      resetEditor();
      return null;
    }

    if (hasDirty.value && !force) {
      error.value = '存在未保存的路段草稿，请先保存或放弃草稿。';
      return detail.value;
    }

    routeId.value = nextRouteId;
    loading.value = true;
    error.value = '';
    try {
      const result = await request<RouteMapDetail>('/api/route-map/get', {
        query: { routeId: nextRouteId },
      });
      applyDetail(result);
      return result;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '路线地图加载失败。';
      return null;
    } finally {
      loading.value = false;
    }
  }

  /** 放弃当前路段草稿，回到服务端几何 */
  function discardActive(segmentNo?: number) {
    const target = segmentNo ?? activeSegmentNo.value;
    if (target === null) {
      return;
    }
    const segment = segments.value.find((item) => item.segmentNo === target);
    if (!segment) {
      return;
    }
    pushHistory(segment.points);
    segment.points = clonePoints(segment.serverPoints);
    settleSegment(segment);
    editingPoints.value = null;
  }

  /** 放弃全部草稿，回到服务端几何 */
  function discardAll() {
    for (const segment of segments.value) {
      segment.points = clonePoints(segment.serverPoints);
      segment.dirty = false;
      segment.error = '';
    }
    undoStack.value = [];
    redoStack.value = [];
    editingPoints.value = null;
    error.value = '';
  }

  /** 进入某路段的编辑模式：以当前草稿（或服务端几何）为起点 */
  function enterEdit(segmentNo: number) {
    const segment = segments.value.find((item) => item.segmentNo === segmentNo);
    if (!segment) {
      return;
    }
    activeSegmentNo.value = segmentNo;
    editingPoints.value = clonePoints(segment.points);
    segment.error = '';
  }

  /** 退出编辑模式，把编辑中的顶点写回路段草稿 */
  function exitEdit() {
    const segment = activeSegment.value;
    if (segment && editingPoints.value) {
      commit(segment, editingPoints.value);
    }
    editingPoints.value = null;
  }

  function commit(segment: RouteMapEditorSegment, points: readonly LngLat[]) {
    pushHistory(segment.points);
    segment.points = clonePoints(points);
    settleSegment(segment);
  }

  /** 画线：追加一个顶点（插在终点之前） */
  function addVertex(point: LngLat, segmentNo?: number) {
    const segment = resolveSegment(segmentNo);
    if (!segment) {
      return;
    }
    const base = editingPoints.value ?? segment.points;
    const next = [...base];
    next.splice(Math.max(1, next.length - 1), 0, [point[0], point[1]]);
    editingPoints.value = next;
    commit(segment, next);
  }

  /** 拖动顶点；起点与终点固定，返回是否生效 */
  function moveVertex(index: number, point: LngLat, segmentNo?: number): boolean {
    const segment = resolveSegment(segmentNo);
    if (!segment) {
      return false;
    }
    const base = editingPoints.value ?? segment.points;
    if (index <= 0 || index >= base.length - 1) {
      return false;
    }
    const next = clonePoints(base);
    next[index] = [point[0], point[1]];
    editingPoints.value = next;
    commit(segment, next);
    return true;
  }

  /** 删除顶点；非固定顶点才允许删除 */
  function removeVertex(index: number, segmentNo?: number): boolean {
    const segment = resolveSegment(segmentNo);
    if (!segment) {
      return false;
    }
    const base = editingPoints.value ?? segment.points;
    if (index <= 0 || index >= base.length - 1 || base.length <= 2) {
      return false;
    }
    const next = clonePoints(base);
    next.splice(index, 1);
    editingPoints.value = next;
    commit(segment, next);
    return true;
  }

  /** 在 fromIndex 与 fromIndex+1 之间插入中点 */
  function insertVertexBetween(fromIndex: number, point?: LngLat, segmentNo?: number): boolean {
    const segment = resolveSegment(segmentNo);
    if (!segment) {
      return false;
    }
    const base = editingPoints.value ?? segment.points;
    if (fromIndex < 0 || fromIndex >= base.length - 1) {
      return false;
    }
    const next = clonePoints(base);
    const inserted = point ?? interpolate(base[fromIndex]!, base[fromIndex + 1]!);
    next.splice(fromIndex + 1, 0, [inserted[0], inserted[1]]);
    editingPoints.value = next;
    commit(segment, next);
    return true;
  }

  /** 起终点随站点移动后重新固定 */
  function pinSegmentEndpoints(segment: RouteMapEditorSegment) {
    if (segment.points.length < 2) {
      return;
    }
    const from = findStation(segment.fromStationId);
    const to = findStation(segment.toStationId);
    const next = clonePoints(segment.points);
    if (from) {
      next[0] = [Number(from.longitude), Number(from.latitude)];
    }
    if (to) {
      next[next.length - 1] = [Number(to.longitude), Number(to.latitude)];
    }
    commit(segment, next);
  }

  /** 撤销：单段级别的顶点快照栈 */
  function undo() {
    const segment = activeSegment.value;
    const last = undoStack.value[undoStack.value.length - 1];
    if (!segment || last === undefined) {
      return;
    }
    const current = pointsSignature(segment.points);
    undoStack.value = undoStack.value.slice(0, -1);
    redoStack.value = [...redoStack.value, current];

    const restored = deserialize(last);
    segment.points = restored.length >= 2
      ? restored
      : (editingPoints.value ? clonePoints(editingPoints.value) : clonePoints(segment.points));
    settleSegment(segment);
    editingPoints.value = clonePoints(segment.points);
  }

  function redo() {
    const segment = activeSegment.value;
    const last = redoStack.value[redoStack.value.length - 1];
    if (!segment || last === undefined) {
      return;
    }
    const current = pointsSignature(segment.points);
    redoStack.value = redoStack.value.slice(0, -1);
    undoStack.value = [...undoStack.value, current];

    const restored = deserialize(last);
    segment.points = restored.length >= 2 ? restored : clonePoints(segment.points);
    settleSegment(segment);
    editingPoints.value = clonePoints(segment.points);
  }

  /** 单段保存：携带 geometryVersion 语义由调用方通过 conflict 处理 */
  async function saveSegment(segmentNo?: number): Promise<boolean> {
    const segment = resolveSegment(segmentNo);
    if (!segment) {
      error.value = '请先选择要保存的路段。';
      return false;
    }

    const points = normalizePoints(editingPoints.value ?? segment.points);
    if (points.length < 2) {
      segment.error = '至少需要两个顶点才能保存路段。';
      return false;
    }

    const from = findStation(segment.fromStationId);
    const to = findStation(segment.toStationId);
    if (!from || !to) {
      segment.error = '路段起终点站点缺失，请先同步站点。';
      return false;
    }

    saving.value = true;
    error.value = '';
    segment.error = '';
    try {
      const result = await request<RouteMapDetail>('/api/route-map/save-segment', {
        method: 'POST',
        body: {
          routeId: routeId.value,
          fromStationId: segment.fromStationId,
          toStationId: segment.toStationId,
          segmentNo: segment.segmentNo,
          // 后端 ValidateLine 只接受单条 LineString；解析侧仍兼容 MultiLineString 以读取历史数据
          geometryGeoJson: JSON.stringify({
            type: 'LineString',
            coordinates: points.map((point) => [point[0], point[1]]),
          }),
          snapToRoad: snapToRoad.value,
          // 服务端据此拒绝"基于旧版本编辑"的保存，避免静默覆盖他人改动
          geometryVersion: baseGeometryVersion.value,
        },
      });
      applyAfterSave(result, segment.segmentNo);
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '路段保存失败。';
      segment.error = message;
      error.value = message;
      return false;
    } finally {
      saving.value = false;
    }
  }

  /** 保存全部草稿路段 */
  async function saveAll(): Promise<boolean> {
    const targets = dirtySegments.value.length
      ? dirtySegments.value.map((segment) => segment.segmentNo)
      : (activeSegmentNo.value === null ? [] : [activeSegmentNo.value]);

    if (!targets.length) {
      error.value = '没有需要保存的路段。';
      return false;
    }

    for (const segmentNo of targets) {
      const ok = await saveSegment(segmentNo);
      if (!ok) {
        return false;
      }
    }

    return true;
  }

  /**
   * 保存成功后重载并保留未保存草稿。
   * 服务端返回的 detail 可能不包含其他段的草稿，因此只覆盖刚保存的那一段。
   */
  function applyAfterSave(result: RouteMapDetail, savedSegmentNo: number) {
    const previousSegments = segments.value;
    const previousActive = activeSegmentNo.value;
    const previousEditing = editingPoints.value;

    detail.value = result;
    baseGeometryVersion.value = result.geometryVersion;
    options.onDetailApplied?.(result);

    const rebuilt = buildSegments(result);
    const merged = rebuilt.map((segment) => {
      const previous = previousSegments.find((item) => item.segmentNo === segment.segmentNo);
      if (!previous || segment.segmentNo === savedSegmentNo) {
        return segment;
      }
      return previous;
    });

    // 服务端新增的站点会带来新路段；被删除的路段直接丢弃
    segments.value = merged;
    activeSegmentNo.value = merged.some((item) => item.segmentNo === previousActive)
      ? previousActive
      : (merged[0]?.segmentNo ?? null);
    editingPoints.value = previousEditing
      ? clonePoints(merged.find((item) => item.segmentNo === previousActive)?.points ?? previousEditing)
      : null;
    undoStack.value = [];
    redoStack.value = [];
  }

  /** 检测本次会话内服务端几何是否被其他人改写 */
  const hasVersionConflict = computed(() =>
    baseGeometryVersion.value !== null
    && detail.value !== null
    && detail.value.geometryVersion !== baseGeometryVersion.value);

  function resolveSegment(segmentNo?: number): RouteMapEditorSegment | null {
    const target = segmentNo ?? activeSegmentNo.value;
    if (target === null || target === undefined) {
      return null;
    }
    return segments.value.find((item) => item.segmentNo === target) ?? null;
  }

  function findStation(stationId: string): RouteMapStation | null {
    return stations.value.find((station) => station.id === stationId) ?? null;
  }

  return {
    // 状态
    routeId,
    detail,
    segments,
    activeSegmentNo,
    activeSegment,
    editingPoints,
    previewPointsBySegmentNo,
    dirtySegmentNos,
    snapToRoad,
    loading,
    saving,
    error,
    stations,
    geometryVersion,
    baseGeometryVersion,
    validationMessages,
    hasDirty,
    hasVersionConflict,
    dirtySegments,
    canUndo,
    canRedo,
    // 操作
    load,
    resetEditor,
    applyDetail,
    enterEdit,
    exitEdit,
    addVertex,
    moveVertex,
    removeVertex,
    insertVertexBetween,
    isFixedVertex,
    pinSegmentEndpoints,
    discardActive,
    discardAll,
    undo,
    redo,
    saveSegment,
    saveAll,
  };
};

function deserialize(signature: string): LngLat[] {
  if (!signature) {
    return [];
  }
  return signature.split(';').map((pair) => {
    const [longitude, latitude] = pair.split(',');
    return [Number(longitude), Number(latitude)] as LngLat;
  }).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

/** 单段长度提示（米），供路段列表展示 */
export const segmentLengthMeters = (segment: RouteMapEditorSegment): number =>
  polylineLengthMeters(segment.points);

export { ROUTE_SEGMENT_SOURCE };
