export type SheetSnap = 'collapsed' | 'preview' | 'full'
export type SheetHeights = Record<SheetSnap, number>

export function sheetHeights(height: number, width: number, toolbar: number): SheetHeights {
  const full = Math.max(130, height - (width <= 760 ? 30 : toolbar + 70))
  return { collapsed: Math.min(130, full), preview: Math.min(full, Math.max(340, Math.min(420, height * 0.66))), full }
}

export function closestSheetSnap(heights: SheetHeights, height: number, start: SheetSnap, velocity: number): SheetSnap {
  const snaps: SheetSnap[] = ['collapsed', 'preview', 'full']
  if (Math.abs(velocity) > 0.5) return snaps[Math.max(0, Math.min(2, snaps.indexOf(start) + (velocity > 0 ? 1 : -1)))]
  return snaps.reduce((closest, snap) => Math.abs(heights[snap] - height) < Math.abs(heights[closest] - height) ? snap : closest, start)
}
