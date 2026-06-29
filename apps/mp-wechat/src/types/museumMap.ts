export type MuseumFloorId = "1F" | "2F" | "3F" | "4F"

export interface MuseumHallBlock {
  id: string
  label: string
  shortLabel: string
  description: string
  x: number
  y: number
  width: number
  height: number
  accent: string
  radius?: number
}

export interface MuseumFloorLayout {
  id: MuseumFloorId
  label: string
  summary: string
  axisLabel: string
  halls: MuseumHallBlock[]
}
