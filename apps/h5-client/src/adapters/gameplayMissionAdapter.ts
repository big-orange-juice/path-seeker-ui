import {
  DIFFICULTY_MAP,
  PUZZLE_TYPE_MAP,
  TASK_KIND_MAP,
} from "@/constants/missionSchema"
import type {
  JoinRouteResponse,
  RouteCardResponse,
  RouteDetailResponse,
  RouteNodeResponse,
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
  MissionRouteCard,
  MissionSchemaMeta,
  PuzzleReward,
  PuzzleTemplateType,
  TaskKind,
} from "@/types/mission"

type StageLike = RouteNodeResponse | StagePlayResponse

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

const INTERACTION_TEMPLATE_MAP: Record<number, PuzzleTemplateType> = {
  1: "observe_choice",
  2: "code_break",
  3: "sort",
  4: "match",
  5: "select",
  6: "image_puzzle",
  7: "match",
  8: "clue_find",
  9: "match",
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
    const items = asArray(config.items ?? config.fragments ?? config.options)
    const entries = items.map((item, itemIndex) => mapCommonEntry(item, itemIndex))
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

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: normalizeText(config.image_url ?? config.imageUrl) || null,
        gridSize: Math.max(2, Number(config.gridSize ?? config.grid_size ?? 2)),
        gridRows: Number(config.gridRows ?? config.grid_rows ?? 2),
        gridCols: Number(config.gridCols ?? config.grid_cols ?? 2),
        pieces: entries.map((entry) => ({
          id: entry.id,
          label: entry.label,
          imageUrl: entry.imageUrl,
          hint: null,
        })),
        correctOrder: correctOrder.length ? correctOrder : entries.map((entry) => entry.id),
        revealTitle: normalizeText(config.revealTitle ?? config.reveal_title) || null,
        trayTitle: normalizeText(config.trayTitle ?? config.tray_title) || null,
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

  return {
    id: `artifact-${stageId}`,
    title,
    subtitle: normalizeText(stage.subtitle),
    location: normalizeText(stage.galleryName ?? stage.exhibitName),
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
  const targetLocation = normalizeText(stage.galleryName ?? stage.exhibitName)

  return {
    id: getStageId(stage, index),
    stageNo: Number(stage.stageNo ?? stage.sortOrder ?? index + 1),
    title,
    objective: normalizeText(config.objective ?? config.goal) || undefined,
    targetLocation,
    resultNarrative: normalizeText(config.result_narrative ?? config.resultNarrative) || undefined,
    nextTarget: normalizeText(config.next_target ?? config.nextTarget) || undefined,
    artifact: buildArtifact(stage, index),
    puzzle: buildPuzzle(stage, route, index),
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
  const routeId = normalizeText(route.id, "route-unknown")
  const recommendedAgeBand = resolveAgeBand(route.ageGroup)
  const difficultyLevel = resolveDifficultyLevel(route.difficultyLevel)
  const taskKind = resolveTaskKind(route.scaleType)
  const chapterCount = (detail?.nodes || []).length || Number(route.puzzleCount ?? 0)

  return {
    id: routeId,
    hallId: normalizeText(detail?.museumId),
    routeCode: routeId,
    title: normalizeText(route.title),
    theme: normalizeText(route.theme),
    summary: normalizeText(detail?.intro ?? route.intro),
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    taskKind,
    estimatedMinutes: Number(route.estimatedMinutes ?? 0),
    totalScore: Number(route.totalScore ?? 0),
    puzzleCount: Number(route.puzzleCount ?? chapterCount),
    chapterCount,
    allowTeam: Number(route.allowTeam ?? 0) === 1,
    rewardTitle: normalizeText(route.rewardTitle) || undefined,
    startLocation: undefined,
    badgeLabel: undefined,
    persona: route.persona
      ? {
        id: normalizeText(route.persona.id),
        code: normalizeText(route.persona.personaCode),
        name: normalizeText(route.persona.name),
        avatar: normalizeText(route.persona.avatarUrl) || undefined,
      }
      : null,
    taglines: [],
    schemaMeta: buildSchemaMeta(route),
  }
}

export function adaptRouteDetailToMission(detail: RouteDetailResponse, stages?: StagePlayResponse[]) {
  const route = detail.route
  if (!route?.id) {
    return null
  }

  const baseCard = adaptRouteCard(route, detail)
  const stageList = stages?.length ? stages : (detail.nodes || [])
  const chapters = stageList.map((stage, index) => buildChapter(stage, route, index))

  const mission: MissionDetail = {
    ...baseCard,
    chapterCount: chapters.length,
    puzzleCount: chapters.length,
    museumName: normalizeText(detail.museumId),
    prologue: buildPrologue(detail),
    chapters,
    finale: {
      title: "",
      truth: "",
      debrief: "",
      knowledgeNotes: [],
      scoreTitle: "",
      shareLine: "",
    },
  }

  return mission
}

export function getSolvedStageIds(stages: StagePlayResponse[]) {
  return stages
    .filter((stage) => stage.mySolved || stage.solved || stage.teamSolved)
    .map((stage, index) => getStageId(stage, index))
}

export function resolveCurrentChapterIndex(mission: MissionDetail, joinResult: JoinRouteResponse) {
  const currentStageId = normalizeText(joinResult.currentStageId)
  if (!currentStageId) {
    return 0
  }

  const foundIndex = mission.chapters.findIndex((chapter) => chapter.id === currentStageId)
  return foundIndex >= 0 ? foundIndex : 0
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
