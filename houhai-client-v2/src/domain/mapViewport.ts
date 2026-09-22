export interface MapInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export function mapViewportInsets(width: number, height: number, toolbarHeight: number, sheetHeight: number): MapInsets {
  if (width > 760) return { top: 65, right: 80, bottom: 55, left: Math.min(450, Math.round(width * 0.42)) }
  const top = toolbarHeight + 42
  const bottom = sheetHeight + 64
  const available = Math.max(0, height - 80)
  const scale = Math.min(1, available / (top + bottom))
  return { top: Math.round(top * scale), right: 58, bottom: Math.round(bottom * scale), left: 35 }
}
