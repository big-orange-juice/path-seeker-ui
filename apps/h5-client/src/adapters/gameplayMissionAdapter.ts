import {
  DIFFICULTY_MAP,
  PUZZLE_TYPE_MAP,
  TASK_KIND_MAP,
} from "@/constants/missionSchema"
import type {
  ExhibitResponse,
  MyRouteProgressResponse,
  RouteCardResponse,
  RouteDetailResponse,
  RouteNodeResponse,
  RouteResultResponse,
  RouteStageProgressItemResponse,
  StagePlayResponse,
} from "@/services/gameplay"
import type {
  AgeBand,
  ArtifactClue,
  ChoiceOption,
  DifficultyLevel,
  HintLevel,
  MatchPair,
  MissionChapter,
  MissionDetail,
  MissionPuzzle,
  MissionRouteBadge,
  MissionRouteCard,
  MissionRouteCollectible,
  MissionRouteResult,
  MissionSchemaMeta,
  MissionShareCard,
  MissionStageKind,
  PuzzleReward,
  PuzzleTemplateType,
  TaskKind,
} from "@/types/mission"

type StageLike = RouteNodeResponse | StagePlayResponse

/** 进度状态：1 进行中 2 已完成 3 放弃 4 失败 */
export const ROUTE_PROGRESS_STATUS = {
  inProgress: 1,
  completed: 2,
  abandoned: 3,
  failed: 4,
} as const

/** 展品媒体：3 = 短视频 */
const EXHIBIT_MEDIA_SHORT_VIDEO = 3

const AGE_GROUP_VALUE_MAP: Record<number, AgeBand> = {
  2: "6-10",
  3: "10-15",
  4: "15+",
}

const DIFFICULTY_VALUE_MAP: Record<number, DifficultyLevel> = {
  1: "L1",
  2: "L2",
  3: "L3",
}

const TASK_KIND_VALUE_MAP: Record<number, TaskKind> = {
  1: "family_adventure",
  2: "story_detective",
  3: "deep_reasoning",
}

/**
 * 主路径题型：选择（observe_choice / select）+ 拼图（image_puzzle）。
 * 其余交互仍保留映射以便兼容后台存量配置，但产品主推选择与拼图。
 */
const INTERACTION_TEMPLATE_MAP: Record<number, PuzzleTemplateType> = {
  1: "observe_choice", // Answer → 有选项为选择；无选项为自由文本
  2: "code_break",
  3: "sort",
  4: "match",
  5: "select", // Select → 选择
  6: "image_puzzle", // Jigsaw → 拼图
  7: "match",
  8: "clue_find",
  9: "match",
  // 10 / 11 不进 PuzzleRenderer；占位仅保证 puzzle 对象可构造
  10: "clue_find",
  11: "observe_choice",
}

/** 产品主路径题型（选择 + 拼图） */
export const PRIMARY_PUZZLE_TEMPLATES: PuzzleTemplateType[] = [
  "observe_choice",
  "select",
  "image_puzzle",
]

export function isPrimaryPuzzleTemplate(type: PuzzleTemplateType) {
  return PRIMARY_PUZZLE_TEMPLATES.includes(type)
}

/** 按 interactionType 分流 H5 页面链路 */
export function resolveStageKind(interactionType?: number | null): MissionStageKind {
  const type = Number(interactionType || 0)
  if (type === 11) {
    return "narration"
  }
  if (type === 10) {
    return "find_scan"
  }
  return "puzzle"
}

export function isNarrationStage(interactionType?: number | null) {
  return resolveStageKind(interactionType) === "narration"
}

export function isFindScanStage(interactionType?: number | null) {
  return resolveStageKind(interactionType) === "find_scan"
}

function normalizeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : ""
  return text || fallback
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  try {
    const parsed = JSON.parse(text) as unknown
    return typeof parsed === "string" ? parseJsonValue(parsed) : parsed
  } catch {
    return value
  }
}

function parseJsonObject(value: unknown): Record<string, any> {
  const parsed = parseJsonValue(value)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, any>) : {}
}

function asArray<T = any>(value: unknown): T[] {
  const parsed = parseJsonValue(value)

  if (Array.isArray(parsed)) {
    return parsed as T[]
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { $values?: unknown[] }).$values)) {
    return (parsed as { $values: T[] }).$values
  }

  return []
}

function pickValue(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

function readItemText(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ""
}

function resolveAgeBand(ageGroup?: number | null): AgeBand {
  return AGE_GROUP_VALUE_MAP[ageGroup || 0] ?? "10-15"
}

function resolveDifficultyLevel(level?: number | null): DifficultyLevel {
  return DIFFICULTY_VALUE_MAP[level || 0] ?? "L2"
}

function resolveTaskKind(scaleType?: number | null): TaskKind {
  return TASK_KIND_VALUE_MAP[scaleType || 0] ?? "story_detective"
}

function buildSchemaMeta(route: RouteCardResponse | null | undefined, stage?: StageLike): MissionSchemaMeta {
  const difficultyLevel = resolveDifficultyLevel(stage?.difficultyLevel ?? route?.difficultyLevel)
  const taskKind = resolveTaskKind(stage?.scaleType ?? route?.scaleType)
  const ageBand = resolveAgeBand(route?.ageGroup)

  return {
    ageGroup: route?.ageGroup ?? (ageBand === "6-10" ? 2 : ageBand === "15+" ? 4 : 3),
    difficultyLevel: stage?.difficultyLevel ?? route?.difficultyLevel ?? DIFFICULTY_MAP[difficultyLevel],
    scaleType: stage?.scaleType ?? route?.scaleType ?? TASK_KIND_MAP[taskKind],
  }
}

function getStageId(stage: StageLike, index: number) {
  return normalizeText(stage.stageId)
    || normalizeText(stage.refPuzzleId)
    || normalizeText(stage.puzzleId)
    || `stage-${index + 1}`
}

function getStageConfig(stage: StageLike) {
  return parseJsonObject(stage.config)
}

function getAnswerExtra(stage: StageLike, config: Record<string, any>) {
  const answerExtra = "answerExtra" in stage ? parseJsonObject((stage as StagePlayResponse).answerExtra) : {}
  return parseJsonObject(pickValue(config, "answer_extra", "answerExtra", "AnswerExtra") || answerExtra)
}

function makeChoiceOptions(rawOptions: any[], fallbackPrefix: string): ChoiceOption[] {
  return rawOptions
    .map((item, index) => {
      const id = normalizeText(item?.id ?? item?.key ?? item?.value, `${fallbackPrefix}-${index + 1}`)
      const label = normalizeText(item?.label ?? item?.text ?? item?.title, `选项 ${index + 1}`)
      return {
        id,
        label,
        imageUrl: item?.image_url ?? item?.imageUrl ?? null,
        description: item?.description ?? item?.summary ?? null,
      }
    })
    .filter((item) => item.id && item.label)
}

function mapCommonEntry(item: any, index: number) {
  return {
    id: readItemText(item, "id", "Id", "key", "Key", "value", "Value") || `item-${index + 1}`,
    label: readItemText(item, "label", "Label", "text", "Text", "title", "Title", "name", "Name") || `项目 ${index + 1}`,
    imageUrl: pickValue(item ?? {}, "image_url", "imageUrl", "ImageUrl", "silhouette_url", "silhouetteUrl", "url", "Url") ?? null,
  }
}

function makeReward(stageId: string, stageTitle: string): PuzzleReward {
  return {
    clueId: `clue-${stageId}`,
    clueTitle: stageTitle,
    fragmentId: `fragment-${stageId}`,
    fragmentTitle: stageTitle,
  }
}

function buildHintPayload(config: Record<string, any>): Record<HintLevel, string> {
  const hints = asArray(config.hints)
  const sorted = [...hints].sort(
    (left, right) => Number(left?.sort_order ?? left?.sortOrder ?? 0) - Number(right?.sort_order ?? right?.sortOrder ?? 0),
  )
  const values = sorted.map((item) => normalizeText(item?.content)).filter(Boolean)

  return {
    observe: values[0] || "",
    relation: values[1] || "",
    direct: values[2] || "",
  }
}

function buildPuzzle(stage: StageLike, route: RouteCardResponse | null | undefined, index: number): MissionPuzzle {
  const config = getStageConfig(stage)
  const stageId = getStageId(stage, index)
  const stageTitle = normalizeText(stage.title)
  const content = normalizeText(
    "puzzleContent" in stage ? (stage as StagePlayResponse).puzzleContent : "",
    normalizeText(
      pickValue(config, "content", "Content", "prompt", "Prompt", "theme", "Theme", "rule_hint", "ruleHint", "RuleHint"),
    ),
  )
  const interactionType = Number(stage.interactionType || stage.puzzleType || 1)
  const templateType = INTERACTION_TEMPLATE_MAP[interactionType] ?? "observe_choice"
  const difficultyLevel = resolveDifficultyLevel(stage.difficultyLevel ?? route?.difficultyLevel)
  const schemaMeta = buildSchemaMeta(route, stage)
  const base = {
    id: stageId,
    puzzleTypeId: PUZZLE_TYPE_MAP[templateType],
    interactionType,
    templateType,
    title: stageTitle,
    introText: normalizeText(stage.subtitle),
    prompt: content,
    difficultyLevel,
    schemaMeta,
    hintPayload: buildHintPayload(config),
    reward: makeReward(stageId, stageTitle),
    successCopy: "节点已完成。",
    failureCopy: "本次未通过。",
  }

  if (templateType === "code_break") {
    const digits = Math.max(1, Number(config.digits ?? config.codeLength ?? 4))
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        codeLength: digits,
        acceptedCode: "",
        clueFragments: asArray(config.clue_images).map((item) => normalizeText(item?.hint)).filter(Boolean),
        derivationSteps: [],
        clueSourceTitle: normalizeText(config.rule_hint),
        maskCharacter: "•",
      },
    }
  }

  if (templateType === "sort" || templateType === "image_puzzle") {
    const items = asArray(
      config.items
      ?? config.fragments
      ?? config.options
      ?? config.pieces,
    )
    let entries = items.map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const correctOrder = asArray<string>(config.correct_order ?? config.correctOrder).map((item) => normalizeText(item))
    if (templateType === "sort") {
      return {
        ...base,
        templateType,
        questionPayload: {
          prompt: content,
          items: entries,
          correctOrder: correctOrder.length ? correctOrder : entries.map((entry) => entry.id),
        },
      }
    }

    // 纹样拼图：与 demo 对齐，默认 3×3；config 无 pieces 时按宫格合成碎片
    // 后端常见字段：grid / grid_size / grid_rows / grid_cols / image_url / base_image_url
    const rawGrid = Number(
      config.grid
      ?? config.gridSize
      ?? config.grid_size
      ?? config.gridRows
      ?? config.grid_rows
      ?? 0,
    )
    const inferredFromPieces = entries.length > 0
      ? Math.max(2, Math.round(Math.sqrt(entries.length)))
      : 0
    const gridSize = Math.max(2, Math.min(4, rawGrid || inferredFromPieces || 3))
    const gridRows = Math.max(2, Number(config.gridRows ?? config.grid_rows ?? gridSize))
    const gridCols = Math.max(2, Number(config.gridCols ?? config.grid_cols ?? gridSize))
    const cellCount = gridSize * gridSize

    if (entries.length < cellCount) {
      const padFrom = entries.length
      for (let index = padFrom; index < cellCount; index += 1) {
        entries.push({
          id: `${stageId}-piece-${index + 1}`,
          label: `${index + 1}`,
          imageUrl: null,
        })
      }
    } else if (entries.length > cellCount) {
      entries = entries.slice(0, cellCount)
    }

    const imageUrl = normalizeText(
      config.image_url
      ?? config.imageUrl
      ?? config.base_image_url
      ?? config.baseImageUrl
      ?? config.cover_image_url
      ?? config.coverImageUrl,
    ) || null

    const pieceList = entries.map((entry, index) => ({
      id: entry.id || `${stageId}-piece-${index + 1}`,
      label: entry.label || `${index + 1}`,
      imageUrl: entry.imageUrl || imageUrl,
      hint: null as string | null,
    }))
    const resolvedCorrectOrder = correctOrder.length >= cellCount
      ? correctOrder.slice(0, cellCount)
      : pieceList.map((piece) => piece.id)

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl,
        gridSize,
        gridRows,
        gridCols,
        pieces: pieceList,
        correctOrder: resolvedCorrectOrder,
        revealTitle: normalizeText(config.revealTitle ?? config.reveal_title) || "纹样拼图",
        trayTitle:
          normalizeText(config.trayTitle ?? config.tray_title)
          || "将碎片拖回正确位置，完成纹样复原。",
      },
    }
  }

  if (templateType === "match") {
    const leftItems = asArray(config.left_items ?? config.leftItems).map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const rightItems = asArray(config.right_items ?? config.rightItems).map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const correctPairs = asArray(config.correct_pairs ?? config.correctPairs).map((pair: any) => ({
      leftId: readItemText(pair, "leftId", "left_id", "left"),
      rightId: readItemText(pair, "rightId", "right_id", "right"),
    })) as MatchPair[]

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        left: leftItems,
        right: rightItems,
        correctPairs,
      },
    }
  }

  if (templateType === "select") {
    const options = makeChoiceOptions(asArray(config.options ?? config.targets), `${stageId}-select`)
    const answerExtra = getAnswerExtra(stage, config)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        candidates: options,
        minPick: Number(answerExtra.minPick ?? config.minPick ?? 1),
        maxPick: Number(answerExtra.maxPick ?? config.maxPick ?? Math.max(1, options.length)),
        theme: normalizeText(config.theme) || null,
        pickedTitle: normalizeText(config.pickedTitle ?? config.picked_title) || null,
      },
    }
  }

  if (templateType === "clue_find") {
    const hotspots = asArray(config.hotspots ?? config.targets)
    const correctHotspotId = normalizeText(config.correct_hotspot_id ?? config.correctHotspotId ?? hotspots[0]?.id)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: normalizeText(config.image_url ?? config.imageUrl),
        hotspots: hotspots.map((item: any, itemIndex) => ({
          id: normalizeText(item?.id, `${stageId}-hotspot-${itemIndex + 1}`),
          label: normalizeText(item?.label ?? item?.title, `热点 ${itemIndex + 1}`),
          x: Number(item?.x ?? 0),
          y: Number(item?.y ?? 0),
          width: Number(item?.width ?? item?.radius ?? 12),
          height: Number(item?.height ?? item?.radius ?? 12),
        })),
        targetDescription: normalizeText(config.target_description ?? config.targetDescription) || null,
        requiredHits: Number(config.required_hits ?? config.requiredHits ?? 1),
        correctHotspotId,
      },
    }
  }

  if (templateType === "story_branch") {
    const options = makeChoiceOptions(asArray(config.options), `${stageId}-branch`)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        sceneIntro: normalizeText(config.scene_intro ?? config.sceneIntro) || null,
        options: options.map((option) => ({
          id: option.id,
          label: option.label,
          summary: option.description ?? null,
          outcomeTitle: null,
          outcomeText: null,
        })),
        correctOptionId: normalizeText(config.correct_option_id ?? config.correctOptionId ?? options[0]?.id),
      },
    }
  }

  if (templateType === "multi_step_reasoning") {
    const evidenceItems = asArray(config.evidence_items ?? config.evidenceItems).map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const conclusionOptions = makeChoiceOptions(asArray(config.conclusions ?? config.options), `${stageId}-conclusion`)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        evidence: evidenceItems.map((item) => ({
          id: item.id,
          label: item.label,
          note: null,
          tag: null,
        })),
        correctEvidenceOrder: asArray<string>(config.correct_evidence_order ?? config.correctEvidenceOrder).map((item) => normalizeText(item)),
        conclusions: conclusionOptions.map((item) => ({
          id: item.id,
          label: item.label,
          summary: item.description ?? null,
        })),
        correctConclusionId: normalizeText(config.correct_conclusion_id ?? config.correctConclusionId ?? conclusionOptions[0]?.id),
        chainTitle: normalizeText(config.chainTitle ?? config.chain_title) || null,
        slotLabels: asArray<string>(config.slotLabels ?? config.slot_labels).map((item) => normalizeText(item)).filter(Boolean),
        conclusionTitle: normalizeText(config.conclusionTitle ?? config.conclusion_title) || null,
      },
    }
  }

  const options = makeChoiceOptions(asArray(config.options ?? config.choices), `${stageId}-choice`)
  return {
    ...base,
    templateType: "observe_choice",
    questionPayload: {
      prompt: content,
      options,
      correctOptionId: normalizeText(config.correct_option_id ?? config.correctOptionId ?? options[0]?.id),
    },
  }
}

function buildArtifact(stage: StageLike, index: number): ArtifactClue {
  const config = getStageConfig(stage)
  const stageId = getStageId(stage, index)
  const title = normalizeText(stage.title)
  const location = normalizeText(stage.galleryName ?? stage.exhibitName) || undefined
  const subtitle = normalizeText(stage.subtitle) || undefined

  return {
    id: `artifact-${stageId}`,
    title,
    subtitle,
    location,
    observationPoint: normalizeText(config.observation_point ?? config.observationPoint) || undefined,
    storyFragment: normalizeText(config.story_fragment ?? config.storyFragment) || undefined,
    suspiciousPoint: normalizeText(config.suspicious_point ?? config.suspiciousPoint) || undefined,
    checklist: asArray<string>(config.checklist).map((item) => normalizeText(item)).filter(Boolean),
    detailCallout: normalizeText(config.detail_callout ?? config.detailCallout) || undefined,
  }
}

function buildChapter(stage: StageLike, route: RouteCardResponse | null | undefined, index: number): MissionChapter {
  const config = getStageConfig(stage)
  const title = normalizeText(stage.title)
  const targetLocation = normalizeText(stage.galleryName ?? stage.exhibitName) || undefined
  const refExhibitId = normalizeText(stage.refExhibitId) || undefined
  const videoFromConfig = normalizeText(
    pickValue(config, "video_url", "videoUrl", "intro_video_url", "introVideoUrl", "media_url", "mediaUrl"),
  ) || undefined
  const interactionType = Number(stage.interactionType || stage.puzzleType || 1)
  const sortOrder = Number(stage.sortOrder ?? stage.stageNo ?? index + 1)
  const puzzle = buildPuzzle(stage, route, index)

  return {
    id: getStageId(stage, index),
    stageNo: sortOrder,
    sortOrder,
    title,
    objective: normalizeText(config.objective ?? config.goal) || undefined,
    targetLocation,
    resultNarrative: normalizeText(config.result_narrative ?? config.resultNarrative) || undefined,
    nextTarget: normalizeText(config.next_target ?? config.nextTarget) || undefined,
    refExhibitId,
    videoUrl: videoFromConfig,
    interactionType,
    stageKind: resolveStageKind(interactionType),
    artifact: buildArtifact(stage, index),
    puzzle: {
      ...puzzle,
      interactionType,
    },
  }
}

/**
 * Stages ⊕ Detail.nodes：以 Stages 为主（通关态/题面），用 nodes 补
 * exhibitName / galleryName / refExhibitId / difficulty 等详情字段。
 */
export function mergeStagesWithDetailNodes(
  stages: StagePlayResponse[] | undefined,
  nodes: RouteNodeResponse[] | undefined,
): StageLike[] {
  const nodeList = nodes || []
  const stageList = stages || []

  if (!stageList.length) {
    return nodeList
  }

  const nodeByKey = new Map<string, RouteNodeResponse>()
  nodeList.forEach((node, index) => {
    const keys = [
      normalizeText(node.stageId),
      normalizeText(node.refPuzzleId),
      normalizeText(node.puzzleId),
    ].filter(Boolean)
    keys.forEach((key) => {
      if (!nodeByKey.has(key)) {
        nodeByKey.set(key, node)
      }
    })
    // 按序兜底：同下标节点
    nodeByKey.set(`__index__${index}`, node)
  })

  return stageList.map((stage, index) => {
    const stageKey = normalizeText(stage.stageId)
      || normalizeText(stage.refPuzzleId)
      || normalizeText(stage.puzzleId)
    const node =
      (stageKey ? nodeByKey.get(stageKey) : undefined)
      || nodeByKey.get(`__index__${index}`)

    if (!node) {
      return stage
    }

    return {
      ...node,
      ...stage,
      title: normalizeText(stage.title) || node.title,
      subtitle: normalizeText(stage.subtitle) || node.subtitle,
      config: stage.config || node.config,
      nextRule: stage.nextRule || node.nextRule,
      refExhibitId: normalizeText(stage.refExhibitId) || node.refExhibitId,
      refPuzzleId: normalizeText(stage.refPuzzleId) || node.refPuzzleId,
      puzzleId: normalizeText(stage.puzzleId) || node.puzzleId,
      exhibitName: normalizeText(stage.exhibitName) || node.exhibitName,
      galleryName: normalizeText(stage.galleryName) || node.galleryName,
      interactionType: stage.interactionType || node.interactionType,
      puzzleType: stage.puzzleType || node.puzzleType,
      scaleType: stage.scaleType ?? node.scaleType,
      difficultyLevel: stage.difficultyLevel ?? node.difficultyLevel,
      stageNo: stage.stageNo || node.stageNo,
      sortOrder: stage.sortOrder || node.sortOrder,
      score: stage.score ?? node.score,
      isRequired: stage.isRequired ?? node.isRequired,
      unlockRule: stage.unlockRule ?? node.unlockRule,
    }
  })
}

/** 判断附件/媒体字段是否可直接作为播放地址 */
export function isPlayableMediaUrl(value?: string | null) {
  const text = normalizeText(value)
  if (!text) {
    return false
  }
  return /^https?:\/\//i.test(text) || text.startsWith("/") || text.startsWith("blob:") || text.startsWith("data:")
}

function pickExhibitShortVideoUrl(exhibit: ExhibitResponse) {
  const mediaList = [...(exhibit.mediaList || [])]
    .filter((item) => Number(item.mediaType) === EXHIBIT_MEDIA_SHORT_VIDEO && Number(item.status ?? 1) === 1)
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))

  for (const item of mediaList) {
    if (isPlayableMediaUrl(item.mediaUrl)) {
      return normalizeText(item.mediaUrl)
    }
  }

  return ""
}

/** 用 Exhibit/Get 回填位置与可播短视频（有则补，无则保持） */
export function applyExhibitToChapter(chapter: MissionChapter, exhibit: ExhibitResponse): MissionChapter {
  const exhibitName = normalizeText(exhibit.name)
  const showcase = normalizeText(exhibit.showcaseNo)
  const locationParts = [exhibitName, showcase ? `展柜 ${showcase}` : ""].filter(Boolean)
  const location = locationParts.join(" · ") || undefined
  const shortVideo = pickExhibitShortVideoUrl(exhibit) || undefined

  return {
    ...chapter,
    targetLocation: chapter.targetLocation || location,
    videoUrl: chapter.videoUrl || shortVideo,
    artifact: {
      ...chapter.artifact,
      title: chapter.artifact.title || exhibitName || chapter.title,
      location: chapter.artifact.location || location,
      storyFragment: chapter.artifact.storyFragment || normalizeText(exhibit.description) || undefined,
    },
  }
}

export function collectChapterExhibitIds(mission: MissionDetail) {
  const ids = new Set<string>()
  mission.chapters.forEach((chapter) => {
    const id = normalizeText(chapter.refExhibitId)
    if (id) {
      ids.add(id)
    }
  })
  return [...ids]
}

export function enrichMissionWithExhibits(
  mission: MissionDetail,
  exhibitMap: Record<string, ExhibitResponse | null | undefined>,
): MissionDetail {
  const chapters = mission.chapters.map((chapter) => {
    const exhibitId = normalizeText(chapter.refExhibitId)
    if (!exhibitId) {
      return chapter
    }
    const exhibit = exhibitMap[exhibitId]
    return exhibit ? applyExhibitToChapter(chapter, exhibit) : chapter
  })

  return {
    ...mission,
    chapters,
  }
}

function buildPrologue(detail: RouteDetailResponse): MissionDetail["prologue"] {
  const stories = [...(detail.stories || [])].sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))

  if (stories.length) {
    return stories.map((item, index) => ({
      title: normalizeText(item.title) || undefined,
      content: normalizeText(item.content) || undefined,
    }))
  }

  if (detail.intro) {
    return [
      {
        content: normalizeText(detail.intro) || undefined,
      },
    ]
  }

  return []
}

function adaptRouteCard(route: RouteCardResponse, detail?: RouteDetailResponse | null): MissionRouteCard {
  const routeId = normalizeText(route.id)
  const recommendedAgeBand = resolveAgeBand(route.ageGroup)
  const difficultyLevel = resolveDifficultyLevel(route.difficultyLevel)
  const taskKind = resolveTaskKind(route.scaleType)
  const chapterCount = (detail?.nodes || []).length || Number(route.puzzleCount ?? 0)
  const theme = normalizeText(route.theme) || undefined
  const summary = normalizeText(detail?.intro ?? route.intro) || undefined
  const hallId = normalizeText(detail?.museumId ?? route.museumId) || undefined
  const estimatedMinutes = route.estimatedMinutes == null ? undefined : Number(route.estimatedMinutes)
  const totalScore = route.totalScore == null ? undefined : Number(route.totalScore)
  const rewardTitle = normalizeText(route.rewardTitle) || undefined
  const coverImageUrl = normalizeText(route.coverImageUrl) || undefined
  const routeCode = normalizeText(route.routeCode) || undefined

  return {
    id: routeId,
    hallId,
    routeCode,
    title: normalizeText(route.title),
    theme,
    summary,
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    taskKind,
    estimatedMinutes,
    totalScore,
    puzzleCount: Number(route.puzzleCount ?? chapterCount),
    chapterCount,
    allowTeam: Number(route.allowTeam ?? 0) === 1,
    rewardTitle,
    coverImageUrl,
    startLocation: undefined,
    badgeLabel: undefined,
    persona: route.persona
      ? {
        id: normalizeText(route.persona.id),
        code: normalizeText(route.persona.personaCode),
        name: normalizeText(route.persona.name),
        avatar: normalizeText(route.persona.avatarUrl) || undefined,
        intro: normalizeText(route.persona.intro) || undefined,
        voiceStyle: normalizeText(route.persona.voiceStyle) || undefined,
      }
      : null,
    taglines: [],
    schemaMeta: buildSchemaMeta(route),
  }
}

export function adaptRouteDetailToMission(detail: RouteDetailResponse, stages?: StagePlayResponse[]) {
  const route = detail.route
  if (!route?.id || !normalizeText(route.title)) {
    return null
  }

  const baseCard = adaptRouteCard(route, detail)
  // Stages 为主，Detail.nodes 补位置/展品等；无 Stages 时退回 nodes
  const stageList = mergeStagesWithDetailNodes(stages, detail.nodes || [])
  const chapters = stageList.map((stage, index) => buildChapter(stage, route, index))

  const mission: MissionDetail = {
    ...baseCard,
    chapterCount: chapters.length,
    puzzleCount: chapters.length,
    museumName: normalizeText(detail.museumId) || "",
    prologue: buildPrologue(detail),
    chapters,
    // 终局文案以 RouteResult 为准；此处不编造叙事
    finale: {
      knowledgeNotes: [],
    },
  }

  return mission
}

export function getSolvedStageIds(stages: StagePlayResponse[]) {
  return stages
    .filter((stage) => stage.mySolved || stage.solved || stage.teamSolved)
    .map((stage, index) => getStageId(stage, index))
}

/** 从 MyRouteProgress / RouteResult 的 stages 取已通关 stageId */
export function getSolvedStageIdsFromProgress(stages: RouteStageProgressItemResponse[] | null | undefined) {
  return (stages || [])
    .filter((stage) => stage.mySolved || stage.teamSolved)
    .map((stage) => normalizeText(stage.stageId))
    .filter(Boolean)
}

/**
 * 恢复时优先 MyRouteProgress.stages；否则用 Stages 接口 solved 标记。
 * 两者都有时取并集，避免进度接口滞后漏标。
 */
export function resolveSolvedChapterIds(input: {
  progress?: MyRouteProgressResponse | null
  stages?: StagePlayResponse[] | null
}) {
  const fromProgress = getSolvedStageIdsFromProgress(input.progress?.stages)
  const fromStages = input.stages?.length ? getSolvedStageIds(input.stages) : []
  return [...new Set([...fromProgress, ...fromStages])]
}

export function isRouteProgressCompleted(progress?: MyRouteProgressResponse | null) {
  if (!progress) {
    return false
  }
  if (progress.myStatus === ROUTE_PROGRESS_STATUS.completed) {
    return true
  }
  const total = Number(progress.totalStageCount ?? 0)
  const solved = Number(progress.mySolvedCount ?? 0)
  return total > 0 && solved >= total
}

export function resolveCurrentChapterIndex(
  mission: MissionDetail,
  progress?: { currentStageId?: string | null } | null,
) {
  const currentStageId = normalizeText(progress?.currentStageId)
  if (!currentStageId) {
    return 0
  }

  const foundIndex = mission.chapters.findIndex((chapter) => chapter.id === currentStageId)
  return foundIndex >= 0 ? foundIndex : 0
}

function adaptBadge(item: NonNullable<RouteResultResponse["badges"]>[number]): MissionRouteBadge | null {
  const id = normalizeText(item.id)
  const name = normalizeText(item.name)
  if (!id || !name) {
    return null
  }
  return {
    id,
    name,
    description: normalizeText(item.description) || undefined,
    iconUrl: normalizeText(item.iconUrl) || undefined,
    rarity: item.rarity,
  }
}

function adaptCollectible(item: NonNullable<RouteResultResponse["collectibles"]>[number]): MissionRouteCollectible | null {
  const id = normalizeText(item.id)
  const name = normalizeText(item.name)
  if (!id || !name) {
    return null
  }
  return {
    id,
    name,
    description: normalizeText(item.description) || undefined,
    iconUrl: normalizeText(item.iconUrl) || undefined,
    type: item.type,
    rarity: item.rarity,
  }
}

function adaptShareCard(card: RouteResultResponse["shareCard"]): MissionShareCard | null {
  if (!card) {
    return null
  }
  return {
    nickname: normalizeText(card.nickname) || undefined,
    routeTitle: normalizeText(card.routeTitle) || undefined,
    theme: normalizeText(card.theme) || undefined,
    rewardTitle: normalizeText(card.rewardTitle) || undefined,
    totalScore: Number(card.totalScore ?? 0),
    solvedCount: Number(card.solvedCount ?? 0),
    puzzleCount: Number(card.puzzleCount ?? 0),
    durationSec: card.durationSec ?? null,
    noCluePerfect: Boolean(card.noCluePerfect),
    completedAt: card.completedAt ?? null,
    shareCode: normalizeText(card.shareCode) || undefined,
  }
}

export function adaptRouteResult(result: RouteResultResponse): MissionRouteResult | null {
  const routeId = normalizeText(result.routeId)
  if (!routeId) {
    return null
  }

  const badges = (result.badges || [])
    .map(adaptBadge)
    .filter((item): item is MissionRouteBadge => Boolean(item))
  const collectibles = (result.collectibles || [])
    .map(adaptCollectible)
    .filter((item): item is MissionRouteCollectible => Boolean(item))

  return {
    routeId,
    teamId: result.teamId ?? null,
    isTeamMode: Boolean(result.isTeamMode),
    routeTitle: normalizeText(result.routeTitle),
    theme: normalizeText(result.theme) || undefined,
    rewardTitle: normalizeText(result.rewardTitle) || undefined,
    status: Number(result.status ?? 0),
    completed: Boolean(result.completed || result.teamCompleted),
    totalScore: Number(result.totalScore ?? 0),
    solvedCount: Number(result.solvedCount ?? 0),
    puzzleCount: Number(result.puzzleCount ?? 0),
    usedClueCount: Number(result.usedClueCount ?? 0),
    noCluePerfect: Boolean(result.noCluePerfect),
    durationSec: result.durationSec ?? null,
    startedAt: result.startedAt ?? null,
    completedAt: result.completedAt ?? null,
    badges,
    collectibles,
    shareCard: adaptShareCard(result.shareCard),
  }
}

export function formatDurationSec(durationSec?: number | null) {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec < 0) {
    return ""
  }
  const total = Math.floor(durationSec)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours} 时 ${minutes} 分`
  }
  if (minutes > 0) {
    return `${minutes} 分 ${seconds} 秒`
  }
  return `${seconds} 秒`
}


export function encodeStageSubmitPayload(puzzle: MissionPuzzle, value: unknown) {
  if (puzzle.templateType === "code_break" && typeof value === "string") {
    return JSON.stringify({
      answer: value,
    })
  }

  return JSON.stringify({
    templateType: puzzle.templateType,
    answer: value,
  })
}
