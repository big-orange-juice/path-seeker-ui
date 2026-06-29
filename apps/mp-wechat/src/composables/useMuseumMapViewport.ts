import { getCurrentInstance, nextTick, onMounted, shallowRef } from "vue"

interface DragBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface UseMuseumMapViewportOptions {
  worldWidth: number
  worldHeight: number
  scaleBoost?: number
}

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return value
  }

  return Math.min(Math.max(value, min), max)
}

export function useMuseumMapViewport(options: UseMuseumMapViewportOptions) {
  const instance = getCurrentInstance()
  const offsetX = shallowRef(0)
  const offsetY = shallowRef(0)
  const scale = shallowRef(1)
  const viewportWidth = shallowRef(0)
  const viewportHeight = shallowRef(0)
  const dragMoved = shallowRef(false)
  const lastDragAt = shallowRef(0)
  const dragBounds = shallowRef<DragBounds>({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
  })

  const dragState = {
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  }

  function readRect(selector: string) {
    return new Promise<UniApp.NodeInfo>((resolve) => {
      uni
        .createSelectorQuery()
        .in(instance?.proxy)
        .select(selector)
        .boundingClientRect((rect) => {
          resolve((rect || {}) as UniApp.NodeInfo)
        })
        .exec()
    })
  }

  async function syncViewport(preserveOffset = false) {
    const viewport = await readRect(".museum-map-viewport")

    if (!viewport.width || !viewport.height) {
      return
    }

    viewportWidth.value = viewport.width
    viewportHeight.value = viewport.height

    const nextScale = Math.max(
      viewport.width / options.worldWidth,
      viewport.height / options.worldHeight,
    ) * (options.scaleBoost || 1.04)
    const stageWidth = options.worldWidth * nextScale
    const stageHeight = options.worldHeight * nextScale
    const nextBounds = {
      minX: Math.min(0, viewport.width - stageWidth),
      maxX: 0,
      minY: Math.min(0, viewport.height - stageHeight),
      maxY: 0,
    }

    scale.value = nextScale
    dragBounds.value = nextBounds

    if (preserveOffset) {
      offsetX.value = clamp(offsetX.value, nextBounds.minX, nextBounds.maxX)
      offsetY.value = clamp(offsetY.value, nextBounds.minY, nextBounds.maxY)
      return
    }

    offsetX.value = clamp((viewport.width - stageWidth) / 2, nextBounds.minX, nextBounds.maxX)
    offsetY.value = clamp((viewport.height - stageHeight) / 2, nextBounds.minY, nextBounds.maxY)
  }

  function resetView() {
    const stageWidth = options.worldWidth * scale.value
    const stageHeight = options.worldHeight * scale.value

    offsetX.value = clamp((viewportWidth.value - stageWidth) / 2, dragBounds.value.minX, dragBounds.value.maxX)
    offsetY.value = clamp((viewportHeight.value - stageHeight) / 2, dragBounds.value.minY, dragBounds.value.maxY)
  }

  function readTouchPoint(event: TouchEvent) {
    const point = event.touches[0] || event.changedTouches[0]

    return {
      x: point?.clientX || 0,
      y: point?.clientY || 0,
    }
  }

  function handleTouchStart(event: TouchEvent) {
    const point = readTouchPoint(event)
    dragState.startX = point.x
    dragState.startY = point.y
    dragState.originX = offsetX.value
    dragState.originY = offsetY.value
    dragMoved.value = false
  }

  function handleTouchMove(event: TouchEvent) {
    const point = readTouchPoint(event)
    const deltaX = point.x - dragState.startX
    const deltaY = point.y - dragState.startY

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragMoved.value = true
    }

    offsetX.value = clamp(dragState.originX + deltaX, dragBounds.value.minX, dragBounds.value.maxX)
    offsetY.value = clamp(dragState.originY + deltaY, dragBounds.value.minY, dragBounds.value.maxY)
  }

  function handleTouchEnd() {
    if (dragMoved.value) {
      lastDragAt.value = Date.now()
    }
  }

  function canTriggerTap() {
    return Date.now() - lastDragAt.value >= 180
  }

  onMounted(async () => {
    await nextTick()
    await syncViewport(false)
  })

  return {
    offsetX,
    offsetY,
    scale,
    syncViewport,
    resetView,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canTriggerTap,
  }
}
