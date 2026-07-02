import { getCurrentInstance, nextTick, onMounted, shallowRef } from 'vue';

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UseMuseumMapViewportOptions {
  worldWidth: number;
  worldHeight: number;
  scaleBoost?: number;
  minScale?: number;
  maxScale?: number;
  minCoverRatio?: number;
  initialScaleMode?: 'cover' | 'contain';
  minScaleMode?: 'cover' | 'contain';
  resolveBounds?: () => ViewportBounds;
}

type TouchPoint = {
  x: number;
  y: number;
};

type InteractionMode = 'idle' | 'drag' | 'pinch';

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
}

function distance(p1: TouchPoint, p2: TouchPoint) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export function useMuseumMapViewport(options: UseMuseumMapViewportOptions) {
  const instance = getCurrentInstance();
  const offsetX = shallowRef(0);
  const offsetY = shallowRef(0);
  const scale = shallowRef(1);
  const viewportWidth = shallowRef(0);
  const viewportHeight = shallowRef(0);
  const dragMoved = shallowRef(false);
  const lastDragAt = shallowRef(0);

  let interactionMode: InteractionMode = 'idle';

  const dragState = {
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };

  const pinchState = {
    startDist: 0,
    originScale: 1,
    worldX: 0,
    worldY: 0
  };

  function clampOffset() {
    const resolvedBounds = options.resolveBounds?.();
    if (resolvedBounds) {
      offsetX.value = clamp(offsetX.value, resolvedBounds.minX, resolvedBounds.maxX);
      offsetY.value = clamp(offsetY.value, resolvedBounds.minY, resolvedBounds.maxY);
      return;
    }

    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    const minX = viewportWidth.value - stageWidth;
    const minY = viewportHeight.value - stageHeight;
    offsetX.value = clamp(offsetX.value, minX, 0);
    offsetY.value = clamp(offsetY.value, minY, 0);
  }

  function readRect(selector: string) {
    return new Promise<UniApp.NodeInfo>((resolve) => {
      uni
        .createSelectorQuery()
        .in(instance?.proxy)
        .select(selector)
        .boundingClientRect((rect) => {
          resolve((rect || {}) as UniApp.NodeInfo);
        })
        .exec();
    });
  }

  function getResetViewState() {
    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    return {
      offsetX: (viewportWidth.value - stageWidth) / 2,
      offsetY: (viewportHeight.value - stageHeight) / 2,
      scale: scale.value
    };
  }

  function setViewState(state: {
    offsetX: number;
    offsetY: number;
    scale: number;
  }) {
    offsetX.value = state.offsetX;
    offsetY.value = state.offsetY;
    scale.value = state.scale;
    clampOffset();
  }

  function resolveFitScale(
    viewportW: number,
    viewportH: number,
    mode: 'cover' | 'contain'
  ) {
    if (mode === 'contain') {
      return Math.min(
        viewportW / options.worldWidth,
        viewportH / options.worldHeight
      );
    }

    return Math.max(
      viewportW / options.worldWidth,
      viewportH / options.worldHeight
    );
  }

  function resolveMinScale() {
    const minCoverRatio = options.minCoverRatio ?? 1.5;
    const minScaleMode = options.minScaleMode ?? 'cover';

    if (options.minScale !== undefined) {
      return options.minScale;
    }

    if (minScaleMode === 'contain') {
      return resolveFitScale(viewportWidth.value, viewportHeight.value, 'contain');
    }

    return Math.max(
      (viewportWidth.value * minCoverRatio) / options.worldWidth,
      (viewportHeight.value * minCoverRatio) / options.worldHeight
    );
  }

  async function syncViewport() {
    const viewport = await readRect('.museum-map-viewport');

    if (!viewport.width || !viewport.height) {
      return;
    }

    viewportWidth.value = viewport.width;
    viewportHeight.value = viewport.height;

    const initialScaleMode = options.initialScaleMode ?? 'cover';
    const nextScale =
      resolveFitScale(viewport.width, viewport.height, initialScaleMode) *
      (options.scaleBoost || 1.04);

    scale.value = Math.max(nextScale, resolveMinScale());

    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    offsetX.value = (viewport.width - stageWidth) / 2;
    offsetY.value = (viewport.height - stageHeight) / 2;
    clampOffset();
  }

  function resetView() {
    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    offsetX.value = (viewportWidth.value - stageWidth) / 2;
    offsetY.value = (viewportHeight.value - stageHeight) / 2;
    clampOffset();
  }

  function readTouchPoint(event: TouchEvent) {
    const point = event.touches[0] || event.changedTouches[0];
    return {
      x: point?.clientX || 0,
      y: point?.clientY || 0
    };
  }

  function readTouchPoints(event: TouchEvent) {
    return {
      p1: {
        x: event.touches[0]?.clientX || 0,
        y: event.touches[0]?.clientY || 0
      },
      p2: {
        x: event.touches[1]?.clientX || 0,
        y: event.touches[1]?.clientY || 0
      }
    };
  }

  function readMidPoint(p1: TouchPoint, p2: TouchPoint) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  function startDrag(point: TouchPoint, preserveMoved = false) {
    interactionMode = 'drag';
    dragState.startX = point.x;
    dragState.startY = point.y;
    dragState.originX = offsetX.value;
    dragState.originY = offsetY.value;
    dragMoved.value = preserveMoved ? dragMoved.value : false;
  }

  function startPinch(event: TouchEvent) {
    const { p1, p2 } = readTouchPoints(event);
    const midpoint = readMidPoint(p1, p2);

    interactionMode = 'pinch';
    dragMoved.value = true;
    pinchState.startDist = distance(p1, p2);
    pinchState.originScale = scale.value;
    pinchState.worldX = (midpoint.x - offsetX.value) / scale.value;
    pinchState.worldY = (midpoint.y - offsetY.value) / scale.value;
  }

  function applyPinch(event: TouchEvent) {
    const { p1, p2 } = readTouchPoints(event);
    const currentDist = distance(p1, p2);
    if (pinchState.startDist <= 0) {
      startPinch(event);
      return;
    }

    const midpoint = readMidPoint(p1, p2);
    const minScale = resolveMinScale();
    const maxScale = options.maxScale ?? 8;
    const nextScale = clamp(
      pinchState.originScale * (currentDist / pinchState.startDist),
      minScale,
      maxScale
    );

    scale.value = nextScale;
    offsetX.value = midpoint.x - pinchState.worldX * nextScale;
    offsetY.value = midpoint.y - pinchState.worldY * nextScale;
    clampOffset();
  }

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length >= 2) {
      startPinch(event);
      return;
    }

    startDrag(readTouchPoint(event));
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length >= 2) {
      if (interactionMode !== 'pinch') {
        startPinch(event);
      }
      applyPinch(event);
      return;
    }

    const point = readTouchPoint(event);
    if (interactionMode !== 'drag') {
      startDrag(point, true);
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragMoved.value = true;
    }

    offsetX.value = dragState.originX + deltaX;
    offsetY.value = dragState.originY + deltaY;
    clampOffset();
  }

  function handleTouchEnd(event?: TouchEvent) {
    if (event?.touches.length === 1) {
      startDrag(readTouchPoint(event), true);
      return;
    }

    if (dragMoved.value || interactionMode === 'pinch') {
      lastDragAt.value = Date.now();
    }

    interactionMode = 'idle';
    pinchState.startDist = 0;
  }

  function canTriggerTap() {
    return Date.now() - lastDragAt.value >= 180;
  }

  onMounted(async () => {
    await nextTick();
    await syncViewport();
  });

  return {
    offsetX,
    offsetY,
    scale,
    viewportWidth,
    viewportHeight,
    syncViewport,
    resetView,
    clampOffset,
    getResetViewState,
    setViewState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canTriggerTap
  };
}
