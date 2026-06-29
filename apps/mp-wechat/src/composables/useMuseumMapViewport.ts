import { getCurrentInstance, nextTick, onMounted, shallowRef } from 'vue';

interface UseMuseumMapViewportOptions {
  worldWidth: number;
  worldHeight: number;
  scaleBoost?: number;
  minScale?: number;
  maxScale?: number;
  minCoverRatio?: number;
}

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value;
  }
  return Math.min(Math.max(value, min), max);
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
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

  const dragState = {
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };

  function clampOffset() {
    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    const minX = viewportWidth.value - stageWidth;
    const minY = viewportHeight.value - stageHeight;
    offsetX.value = clamp(offsetX.value, minX, 0);
    offsetY.value = clamp(offsetY.value, minY, 0);
  }

  const pinchState = {
    startDist: 0,
    originScale: 1,
    originX: 0,
    originY: 0,
    midX: 0,
    midY: 0
  };

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
  }

  async function syncViewport() {
    const viewport = await readRect('.museum-map-viewport');

    if (!viewport.width || !viewport.height) {
      return;
    }

    viewportWidth.value = viewport.width;
    viewportHeight.value = viewport.height;

    const coverRatio = options.minCoverRatio ?? 1.5;
    const minS = Math.max(
      (viewport.width * coverRatio) / options.worldWidth,
      (viewport.height * coverRatio) / options.worldHeight
    );
    const nextScale =
      Math.max(
        viewport.width / options.worldWidth,
        viewport.height / options.worldHeight
      ) * (options.scaleBoost || 1.04);

    scale.value = Math.max(nextScale, minS);

    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    offsetX.value = (viewport.width - stageWidth) / 2;
    offsetY.value = (viewport.height - stageHeight) / 2;
  }

  function resetView() {
    const stageWidth = options.worldWidth * scale.value;
    const stageHeight = options.worldHeight * scale.value;
    offsetX.value = (viewportWidth.value - stageWidth) / 2;
    offsetY.value = (viewportHeight.value - stageHeight) / 2;
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

  function applyScale(newScale: number, centerX: number, centerY: number) {
    const coverRatio = options.minCoverRatio ?? 1.5;
    const coverMin = Math.max(
      (viewportWidth.value * coverRatio) / options.worldWidth,
      (viewportHeight.value * coverRatio) / options.worldHeight
    );
    const minS = options.minScale ?? coverMin;
    const maxS = options.maxScale ?? 8;
    const clampedScale = clamp(newScale, minS, maxS);

    const ratio = clampedScale / scale.value;
    const nextX = centerX - (centerX - offsetX.value) * ratio;
    const nextY = centerY - (centerY - offsetY.value) * ratio;

    scale.value = clampedScale;
    offsetX.value = nextX;
    offsetY.value = nextY;
  }

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length >= 2) {
      const { p1, p2 } = readTouchPoints(event);
      pinchState.startDist = distance(p1, p2);
      pinchState.originScale = scale.value;
      pinchState.originX = offsetX.value;
      pinchState.originY = offsetY.value;
      pinchState.midX = (p1.x + p2.x) / 2;
      pinchState.midY = (p1.y + p2.y) / 2;
      return;
    }

    const point = readTouchPoint(event);
    dragState.startX = point.x;
    dragState.startY = point.y;
    dragState.originX = offsetX.value;
    dragState.originY = offsetY.value;
    dragMoved.value = false;
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length >= 2) {
      const { p1, p2 } = readTouchPoints(event);
      const currentDist = distance(p1, p2);
      if (pinchState.startDist > 0) {
        const ratio = currentDist / pinchState.startDist;
        const newScale = pinchState.originScale * ratio;
        applyScale(newScale, pinchState.midX, pinchState.midY);
        clampOffset();
      }
      return;
    }

    const point = readTouchPoint(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragMoved.value = true;
    }

    offsetX.value = dragState.originX + deltaX;
    offsetY.value = dragState.originY + deltaY;
    clampOffset();
  }

  function handleTouchEnd() {
    if (dragMoved.value) {
      lastDragAt.value = Date.now();
    }
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
    getResetViewState,
    setViewState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canTriggerTap
  };
}
