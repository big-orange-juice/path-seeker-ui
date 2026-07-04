import {
  DIFFICULTY_MAP,
  PUZZLE_TYPE_MAP,
  TASK_KIND_MAP,
} from "@/mock/schema"
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

const TASK_KIND_LABEL_MAP: Record<TaskKind, string> = {
  family_adventure: "亲子冒险",
  story_detective: "剧情推理",
  deep_reasoning: "深度推理",
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
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, any> : {}
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
  return normalizeText(stage.stageId) || normalizeText(stage.refPuzzleId) || normalizeText(stage.puzzleId) || `stage-${index + 1}`
}

function getStageConfig(stage: StageLike) {
  return parseJsonObject(stage.config)
}

function getAnswerExtra(stage: StageLike, config: Record<string, any>) {
  const answerExtra = "answerExtra" in stage ? parseJsonObject((stage as StagePlayResponse).answerExtra) : {}
  return parseJsonObject(pickValue(config, "answer_extra", "answerExtra", "AnswerExtra") || answerExtra)
}

function makeChoiceOptions(rawOptions: any[], fallbackPrefix: string): ChoiceOption[] {
  const options = rawOptions
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

  return options
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
  const sorted = [...hints].sort((left, right) => Number(left?.sort_order ?? left?.sortOrder ?? 0) - Number(right?.sort_order ?? right?.sortOrder ?? 0))
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
  const stageTitle = normalizeText(stage.title, `第 ${index + 1} 站`)
  const content = normalizeText(
    "puzzleContent" in stage ? (stage as StagePlayResponse).puzzleContent : "",
    normalizeText(pickValue(config, "content", "Content", "prompt", "Prompt", "theme", "Theme", "rule_hint", "ruleHint", "RuleHint"), stageTitle),
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

  if (templateType === "sort") {
    const items = asArray(pickValue(config, "items", "Items", "options", "Options", "candidates", "Candidates")).map(mapCommonEntry).filter((item) => item.id && item.label)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        items,
        correctOrder: items.map((item) => item.id),
      },
    }
  }

  if (templateType === "match") {
    const left = asArray(pickValue(config, "left", "Left", "sources", "Sources")).map(mapCommonEntry).filter((item) => item.id && item.label)
    const right = asArray(pickValue(config, "right", "Right", "targets", "Targets")).map(mapCommonEntry).filter((item) => item.id && item.label)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        left,
        right,
        correctPairs: left.map((item, pairIndex) => ({
          leftId: item.id,
          rightId: right[pairIndex]?.id ?? "",
        })),
      },
    }
  }

  if (templateType === "image_puzzle") {
    const pieces = asArray(pickValue(config, "pieces", "Pieces", "items", "Items")).map((item, pieceIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `piece-${pieceIndex + 1}`),
      label: normalizeText(item?.label ?? item?.hint),
      hint: item?.hint ?? null,
    })).filter((item) => item.id && item.label)

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: pickValue(config, "base_image_url", "baseImageUrl", "BaseImageUrl") ?? null,
        gridSize: Math.max(2, Number(pickValue(config, "grid_cols", "gridCols", "GridCols") ?? Math.ceil(Math.sqrt(pieces.length || 4)))),
        pieces,
        correctOrder: pieces.map((item) => item.id),
        revealTitle: normalizeText(pickValue(config, "reveal_title", "revealTitle", "RevealTitle")),
        trayTitle: normalizeText(pickValue(config, "tray_title", "trayTitle", "TrayTitle")),
      },
    }
  }

  if (templateType === "select") {
    const answerExtra = getAnswerExtra(stage, config)
    const rawCandidates = pickValue(config, "candidates", "Candidates", "candidateList", "CandidateList", "options", "Options", "items", "Items") ?? pickValue(answerExtra, "options", "Options", "candidates", "Candidates")
    const candidates = asArray(rawCandidates).map((item, candidateIndex) => ({
      id: readItemText(item, "id", "Id", "key", "Key", "value", "Value", "exhibit_id", "exhibitId", "ExhibitId") || `candidate-${candidateIndex + 1}`,
      label: readItemText(item, "label", "Label", "text", "Text", "title", "Title", "name", "Name", "exhibit_name", "exhibitName", "ExhibitName", "exhibit_id", "exhibitId", "ExhibitId") || `候选 ${candidateIndex + 1}`,
      imageUrl: pickValue(item ?? {}, "image_url", "imageUrl", "ImageUrl", "url", "Url", "coverImageUrl", "CoverImageUrl") ?? null,
      description: pickValue(item ?? {}, "description", "Description", "summary", "Summary", "hint", "Hint") ?? null,
    })).filter((item) => item.id && item.label)
    const minPick = Math.max(1, Number(pickValue(config, "min_pick", "minPick", "MinPick") ?? 1))
    const rawMaxPick = pickValue(config, "max_pick", "maxPick", "MaxPick")
    const maxPick = rawMaxPick == null
      ? Math.max(minPick, candidates.length || minPick)
      : Math.max(minPick, Number(rawMaxPick) || minPick)
    const theme = normalizeText(pickValue(config, "theme", "Theme"))

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        theme: theme || null,
        minPick,
        maxPick,
        candidates,
        pickedTitle: normalizeText(pickValue(config, "picked_title", "pickedTitle", "PickedTitle")),
      },
    }
  }

  if (templateType === "multi_step_reasoning") {
    const candidates = asArray(pickValue(config, "candidates", "Candidates", "evidence", "Evidence", "items", "Items")).map((item, evidenceIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `evidence-${evidenceIndex + 1}`),
      label: normalizeText(item?.label ?? item?.text),
      note: item?.description ?? item?.hint ?? null,
      tag: null,
    })).filter((item) => item.id && item.label)
    const evidence = candidates

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        evidence,
        correctEvidenceOrder: evidence.map((item) => item.id),
        conclusions: [
          {
            id: "picked",
            label: normalizeText(pickValue(config, "theme", "Theme")),
            summary: null,
          },
        ].filter((item) => item.label),
        correctConclusionId: "picked",
        chainTitle: normalizeText(pickValue(config, "chain_title", "chainTitle", "ChainTitle")),
        slotLabels: [],
        conclusionTitle: normalizeText(pickValue(config, "conclusion_title", "conclusionTitle", "ConclusionTitle")),
      },
    }
  }

  if (templateType === "clue_find") {
    const diffs = asArray(pickValue(config, "diffs", "Diffs", "hotspots", "Hotspots"))
    const hotspots = diffs.map((item, hotspotIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `diff-${hotspotIndex + 1}`),
      x: Number(item?.x ?? 0.4) * 100,
      y: Number(item?.y ?? 0.4) * 100,
      width: Number(item?.r ?? 0.08) * 200,
      height: Number(item?.r ?? 0.08) * 200,
      label: normalizeText(item?.label),
    })).filter((item) => item.id && item.label)

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: pickValue(config, "altered_image_url", "alteredImageUrl", "AlteredImageUrl", "base_image_url", "baseImageUrl", "BaseImageUrl") ?? null,
        targetDescription: normalizeText(pickValue(config, "theme", "Theme")),
        hotspots,
        correctHotspotId: hotspots[0]?.id ?? "",
      },
    }
  }

  const answerExtra = getAnswerExtra(stage, config)
  const options = makeChoiceOptions(asArray(pickValue(answerExtra, "options", "Options") ?? pickValue(config, "options", "Options")), `${stageId}-option`)

  return {
    ...base,
    templateType: "observe_choice",
    questionPayload: {
      prompt: content,
      options,
      correctOptionId: options[0]?.id ?? "",
    },
  }
}

function buildArtifact(stage: StageLike, index: number, puzzle: MissionPuzzle): ArtifactClue {
  const config = getStageConfig(stage)
  const location = normalizeText(stage.galleryName)
  const exhibitName = normalizeText(stage.exhibitName, normalizeText(stage.title, `展品 ${index + 1}`))

  return {
    id: normalizeText(stage.refExhibitId, `artifact-${puzzle.id}`),
    title: exhibitName,
    subtitle: normalizeText(stage.subtitle),
    location,
    observationPoint: normalizeText(pickValue(config, "rule_hint", "ruleHint", "RuleHint", "theme", "Theme")),
    storyFragment: normalizeText(stage.subtitle),
    suspiciousPoint: "",
    checklist: [],
    detailCallout: normalizeText(pickValue(config, "rule_hint", "ruleHint", "RuleHint", "theme", "Theme")),
  }
}

export function adaptRouteCard(route: RouteCardResponse, intro?: string | null): MissionRouteCard | null {
  const id = normalizeText(route.id)
  const title = normalizeText(route.title)

  if (!id || !title) {
    return null
  }

  const recommendedAgeBand = resolveAgeBand(route.ageGroup)
  const difficultyLevel = resolveDifficultyLevel(route.difficultyLevel)
  const taskKind = resolveTaskKind(route.scaleType)
  const schemaMeta = buildSchemaMeta(route)

  return {
    id,
    hallId: "",
    routeCode: id,
    title,
    theme: normalizeText(route.theme),
    summary: normalizeText(intro),
    highlight: "",
    recommendedAgeBand,
    availableAgeBands: [recommendedAgeBand],
    difficultyLevel,
    taskKind,
    estimatedMinutes: route.estimatedMinutes ?? 0,
    totalScore: route.totalScore ?? 0,
    puzzleCount: route.puzzleCount ?? 0,
    chapterCount: route.puzzleCount ?? 0,
    allowTeam: (route.allowTeam ?? 0) === 1,
    rewardTitle: "",
    startLocation: "",
    badgeLabel: "已发布",
    persona: {
      id: normalizeText(route.persona?.id),
      code: normalizeText(route.persona?.personaCode),
      name: normalizeText(route.persona?.name),
      intro: "",
      avatar: normalizeText(route.persona?.name).slice(0, 1),
      voiceStyle: "",
    },
    taglines: (route.allowTeam ?? 0) === 1 ? ["支持组队"] : [],
    schemaMeta,
  }
}

export function adaptRouteDetailToMission(detail: RouteDetailResponse, stages?: StageLike[]): MissionDetail | null {
  const routeCard = detail.route ? adaptRouteCard(detail.route, detail.intro) : null

  if (!routeCard) {
    return null
  }

  const sortedStages = [...(stages?.length ? stages : detail.nodes ?? [])].sort(
    (left, right) => Number(left.sortOrder ?? left.stageNo ?? 0) - Number(right.sortOrder ?? right.stageNo ?? 0),
  )
  const chapters: MissionChapter[] = sortedStages.map((stage, index) => {
    const puzzle = buildPuzzle(stage, detail.route, index)
    const artifact = buildArtifact(stage, index, puzzle)

    return {
      id: puzzle.id,
      stageNo: stage.stageNo ?? index + 1,
      title: normalizeText(stage.title, `第 ${index + 1} 站`),
      objective: normalizeText(stage.subtitle),
      targetLocation: artifact.location,
      resultNarrative: "",
      nextTarget: "",
      artifact,
      puzzle,
    }
  })

  return {
    ...routeCard,
    puzzleCount: chapters.length || routeCard.puzzleCount,
    chapterCount: chapters.length || routeCard.chapterCount,
    startLocation: chapters[0]?.targetLocation || "",
    rewardTitle: routeCard.rewardTitle,
    museumName: "",
    prologue: (detail.stories ?? []).map((story, index) => ({
      eyebrow: `故事 ${index + 1}`,
      title: normalizeText(story.title, `线索 ${index + 1}`),
      content: normalizeText(story.content, routeCard.summary),
    })).slice(0, 3),
    introPanel: {
      narrative: routeCard.summary,
      playbook: [],
      rewardPreview: routeCard.rewardTitle ? [routeCard.rewardTitle] : [],
    },
    chapters,
    finale: {
      title: `${routeCard.title}完成`,
      truth: "",
      debrief: "",
      knowledgeNotes: [],
      scoreTitle: "路线成绩",
      shareLine: "",
    },
  }
}

export function resolveCurrentChapterIndex(mission: MissionDetail, joinResult?: JoinRouteResponse | null) {
  const currentStageId = normalizeText(joinResult?.currentStageId)
  if (!currentStageId) {
    return 0
  }

  const index = mission.chapters.findIndex((chapter) => chapter.id === currentStageId)
  return index >= 0 ? index : 0
}

export function getSolvedStageIds(stages: StagePlayResponse[]) {
  return stages
    .filter((stage) => Boolean(stage.mySolved ?? stage.solved))
    .map((stage, index) => getStageId(stage, index))
}

export function encodeStageSubmitPayload(puzzle: MissionPuzzle, value: unknown): string | null {
  if (puzzle.templateType === "observe_choice" || puzzle.templateType === "story_branch") {
    return typeof value === "string" ? value : null
  }

  if (puzzle.templateType === "code_break") {
    return JSON.stringify({
      code: typeof value === "string" ? value : "",
    })
  }

  if (puzzle.templateType === "sort") {
    return JSON.stringify({
      order: Array.isArray(value) ? value : [],
    })
  }

  if (puzzle.templateType === "image_puzzle") {
    return JSON.stringify({
      pieces: Array.isArray(value) ? value : [],
    })
  }

  if (puzzle.templateType === "select") {
    return JSON.stringify({
      picked: Array.isArray(value) ? value : [],
    })
  }

  if (puzzle.templateType === "match") {
    const pairs = Array.isArray(value)
      ? (value as MatchPair[]).reduce<Record<string, string>>((result, pair) => {
          result[pair.leftId] = pair.rightId
          return result
        }, {})
      : {}

    return JSON.stringify({ pairs })
  }

  if (puzzle.templateType === "clue_find") {
    return JSON.stringify({
      hits: typeof value === "string" ? [{ key: value }] : [],
    })
  }

  return JSON.stringify(value ?? {})
}






