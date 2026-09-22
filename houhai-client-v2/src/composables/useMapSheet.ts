import { computed, shallowRef } from 'vue'
import { closestSheetSnap, sheetHeights, type SheetSnap } from '../domain/mapSheet'

export function useMapSheet(layout: () => { width: number; height: number; toolbar: number }) {
  const snap = shallowRef<SheetSnap>('collapsed')
  const dragging = shallowRef(false)
  const dragHeight = shallowRef<number | null>(null)
  const heights = computed(() => sheetHeights(layout().height, layout().width, layout().toolbar))
  const height = computed(() => dragHeight.value ?? heights.value[snap.value])
  const settledHeight = computed(() => heights.value[snap.value])
  const expanded = computed(() => snap.value !== 'collapsed' || dragging.value)
  let pointerId: number | undefined
  let startY = 0
  let startHeight = 0
  let startSnap: SheetSnap = 'collapsed'
  let lastY = 0
  let lastTime = 0
  let velocity = 0
  let suppressClick = false

  function setSnap(value: SheetSnap) {
    snap.value = value
    dragHeight.value = null
    dragging.value = false
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || pointerId !== undefined) return
    pointerId = event.pointerId
    startY = lastY = event.clientY
    startHeight = height.value
    startSnap = snap.value
    lastTime = event.timeStamp
    velocity = 0
    suppressClick = false
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    const delta = startY - event.clientY
    if (!dragging.value && Math.abs(delta) < 6) return
    dragging.value = true
    suppressClick = true
    const elapsed = event.timeStamp - lastTime
    if (elapsed > 0) velocity = (lastY - event.clientY) / elapsed
    lastTime = event.timeStamp
    lastY = event.clientY
    dragHeight.value = Math.max(heights.value.collapsed, Math.min(heights.value.full, startHeight + delta))
  }

  function pointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    if (dragging.value) setSnap(closestSheetSnap(heights.value, height.value, startSnap, event.timeStamp - lastTime < 100 ? velocity : 0))
    pointerId = undefined
    const handle = event.currentTarget as HTMLElement
    handle.releasePointerCapture(event.pointerId)
  }

  function pointerCancel() {
    if (pointerId === undefined) return
    pointerId = undefined
    dragHeight.value = null
    dragging.value = false
    suppressClick = false
  }

  function cycle() {
    if (suppressClick) { suppressClick = false; return }
    setSnap(snap.value === 'collapsed' ? 'preview' : snap.value === 'preview' ? 'full' : 'preview')
  }

  return { snap, height, settledHeight, expanded, dragging, setSnap, cycle, pointerDown, pointerMove, pointerUp, pointerCancel }
}
