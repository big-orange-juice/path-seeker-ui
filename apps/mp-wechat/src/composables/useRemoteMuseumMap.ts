import { computed, onMounted, shallowRef } from 'vue'
import { request, resolveRequestErrorMessage } from '@/services/http'
import type {
  FloorResponse,
  GalleryQueryPayload,
  GalleryResponse,
  GalleryResponseListTotalPageResult,
  MuseumFloorLayout,
  MuseumHallBlock,
} from '@/types/museumMap'

const FLOOR_WORLD_MIN_WIDTH = 320
const FLOOR_WORLD_MIN_HEIGHT = 640
const MARKER_PADDING_X = 72
const MARKER_PADDING_Y = 136
const MARKER_ACCENTS = ['#d1b26f', '#86a4a5', '#b89d95', '#98a495', '#7d948d', '#a68579']

function normalizeList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeFloorList(value: unknown) {
  if (Array.isArray(value)) {
    return value as FloorResponse[]
  }

  if (value && typeof value === 'object' && Array.isArray((value as { list?: unknown }).list)) {
    return (value as { list: FloorResponse[] }).list
  }

  return []
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function trimText(value: string | null | undefined) {
  return String(value || '').trim()
}

function buildShortLabel(name: string) {
  if (!name) {
    return '展馆'
  }

  return name.length <= 4 ? name : name.slice(0, 4)
}

function buildFloorWorld(halls: MuseumHallBlock[]) {
  const maxX = halls.reduce((result, hall) => Math.max(result, hall.x), 0)
  const maxY = halls.reduce((result, hall) => Math.max(result, hall.y), 0)

  return {
    worldWidth: Math.max(FLOOR_WORLD_MIN_WIDTH, Math.round(maxX + MARKER_PADDING_X)),
    worldHeight: Math.max(FLOOR_WORLD_MIN_HEIGHT, Math.round(maxY + MARKER_PADDING_Y)),
  }
}

function buildFloorLayout(
  floor: FloorResponse,
  galleries: GalleryResponse[],
  hallIndexSeed: number,
): MuseumFloorLayout {
  const halls = galleries
    .map<MuseumHallBlock | null>((gallery, index) => {
      const x = toNumber(gallery.x)
      const y = toNumber(gallery.y)
      const id = trimText(gallery.id)
      const label = trimText(gallery.name)

      if (x === null || y === null || !id || !label) {
        return null
      }

      const subtitle = trimText(gallery.subtitle)
      const description = trimText(gallery.description) || subtitle || '点击查看当前展馆任务。'

      return {
        id,
        label,
        shortLabel: buildShortLabel(label),
        subtitle,
        description,
        x,
        y,
        sortOrder: gallery.sortOrder ?? index + 1,
        accent: MARKER_ACCENTS[(hallIndexSeed + index) % MARKER_ACCENTS.length],
      }
    })
    .filter((hall): hall is MuseumHallBlock => Boolean(hall))
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))

  const floorCode = trimText(floor.floorCode)
  const floorName = trimText(floor.floorName)
  const label = floorName ? `${floorCode || '楼层'} · ${floorName}` : (floorCode || '未命名楼层')
  const { worldWidth, worldHeight } = buildFloorWorld(halls)

  return {
    id: trimText(floor.id),
    label,
    summary: trimText(floor.description) || `${label} 当前已配置 ${halls.length} 个点位。`,
    axisLabel: floorName || floorCode || '馆内楼层',
    mapImageUrl: trimText(floor.mapImageUrl),
    sortOrder: floor.sortOrder ?? 0,
    floorLevel: floor.floorLevel ?? 0,
    worldWidth,
    worldHeight,
    halls,
  }
}

function sortFloors(list: MuseumFloorLayout[]) {
  return [...list].sort((left, right) => {
    if ((left.floorLevel ?? 0) !== (right.floorLevel ?? 0)) {
      return (left.floorLevel ?? 0) - (right.floorLevel ?? 0)
    }

    if ((left.sortOrder ?? 0) !== (right.sortOrder ?? 0)) {
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    }

    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

export function useRemoteMuseumMap(museumId: string) {
  const floors = shallowRef<MuseumFloorLayout[]>([])
  const pending = shallowRef(false)
  const error = shallowRef('')

  const hasFloors = computed(() => floors.value.length > 0)

  async function fetchMuseumMap() {
    pending.value = true
    error.value = ''

    try {
      const [floorResponse, galleryResponse] = await Promise.all([
        request<FloorResponse[] | { list: FloorResponse[] }>('/api/Museum/Floors', {
          query: { museumId },
        }),
        request<GalleryResponseListTotalPageResult<GalleryResponse>>('/api/Gallery/PageList', {
          method: 'POST',
          data: {
            pageIndex: 1,
            pageSize: 1000,
            museumId,
          } satisfies GalleryQueryPayload,
        }),
      ])

      const floorList = normalizeFloorList(floorResponse)
      const galleryList = normalizeList<GalleryResponse>(galleryResponse?.list)
      const galleriesByFloorId = new Map<string, GalleryResponse[]>()

      galleryList.forEach((gallery) => {
        const floorId = trimText(gallery.floorId)
        if (!floorId) {
          return
        }

        const current = galleriesByFloorId.get(floorId) ?? []
        current.push(gallery)
        galleriesByFloorId.set(floorId, current)
      })

      const normalizedFloors = floorList
        .map((floor, index) => {
          const floorId = trimText(floor.id)
          if (!floorId) {
            return null
          }

          return buildFloorLayout(
            floor,
            galleriesByFloorId.get(floorId) ?? [],
            index * 4,
          )
        })
        .filter((floor): floor is MuseumFloorLayout => floor !== null)

      floors.value = sortFloors(normalizedFloors)
    }
    catch (fetchError) {
      console.error('加载博物馆地图失败', fetchError)
      floors.value = []
      error.value = resolveRequestErrorMessage(fetchError, '地图数据加载失败')
    }
    finally {
      pending.value = false
    }
  }

  onMounted(() => {
    void fetchMuseumMap()
  })

  return {
    floors,
    pending,
    error,
    hasFloors,
    reload: fetchMuseumMap,
  }
}
