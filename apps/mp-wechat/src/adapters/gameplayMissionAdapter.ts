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

const HINT_TEXT_FALLBACK: Record<HintLevel, string> = {
  observe: "先回到展品本体，找最显眼但又和题面有关的细节。",
  relation: "把标题、副标题和展品位置连起来看，通常能得到第二层线索。",
  direct: "如果仍然卡住，先提交你最有把握的答案，系统会按节点规则判定。",
}

function normalizeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : ""
  return text || fallback
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) {
    return {}
  }

  if (typeof value === "object") {
    return value as Record<string, any>
  }

  if (typeof value !== "string") {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
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
  return parseJsonObject(config.answer_extra || config.answerExtra || answerExtra)
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

  return options.length
    ? options
    : [
        { id: "A", label: "A", imageUrl: null, description: null },
        { id: "B", label: "B", imageUrl: null, description: null },
      ]
}

function mapCommonEntry(item: any, index: number) {
  return {
    id: normalizeText(item?.id ?? item?.key ?? item?.value, `item-${index + 1}`),
    label: normalizeText(item?.label ?? item?.text ?? item?.title, `项目 ${index + 1}`),
    imageUrl: item?.image_url ?? item?.imageUrl ?? item?.silhouette_url ?? null,
  }
}

function makeReward(stageId: string, stageTitle: string): PuzzleReward {
  return {
    clueId: `clue-${stageId}`,
    clueTitle: stageTitle,
    fragmentId: `fragment-${stageId}`,
    fragmentTitle: `${stageTitle}碎片`,
  }
}

function buildHintPayload(config: Record<string, any>): Record<HintLevel, string> {
  const hints = asArray(config.hints)
  const sorted = [...hints].sort((left, right) => Number(left?.sort_order ?? left?.sortOrder ?? 0) - Number(right?.sort_order ?? right?.sortOrder ?? 0))
  const values = sorted.map((item) => normalizeText(item?.content)).filter(Boolean)

  return {
    observe: values[0] || HINT_TEXT_FALLBACK.observe,
    relation: values[1] || HINT_TEXT_FALLBACK.relation,
    direct: values[2] || HINT_TEXT_FALLBACK.direct,
  }
}

function buildPuzzle(stage: StageLike, route: RouteCardResponse | null | undefined, index: number): MissionPuzzle {
  const config = getStageConfig(stage)
  const stageId = getStageId(stage, index)
  const stageTitle = normalizeText(stage.title, `第 ${index + 1} 站`)
  const content = normalizeText(
    "puzzleContent" in stage ? (stage as StagePlayResponse).puzzleContent : "",
    normalizeText(config.content ?? config.prompt ?? config.theme ?? config.rule_hint, stageTitle),
  )
  const templateType = INTERACTION_TEMPLATE_MAP[Number(stage.interactionType || stage.puzzleType || 1)] ?? "observe_choice"
  const difficultyLevel = resolveDifficultyLevel(stage.difficultyLevel ?? route?.difficultyLevel)
  const schemaMeta = buildSchemaMeta(route, stage)
  const base = {
    id: stageId,
    puzzleTypeId: PUZZLE_TYPE_MAP[templateType],
    templateType,
    title: stageTitle,
    introText: normalizeText(stage.subtitle, "观察展品后完成这一站。"),
    prompt: content,
    difficultyLevel,
    schemaMeta,
    hintPayload: buildHintPayload(config),
    reward: makeReward(stageId, stageTitle),
    successCopy: "节点已完成，新的线索已经收入任务袋。",
    failureCopy: "还差一点，回到展品细节再确认一次。",
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
        clueFragments: asArray(config.clue_images).map((item, clueIndex) => normalizeText(item?.hint, `线索 ${clueIndex + 1}`)),
        derivationSteps: [],
        clueSourceTitle: normalizeText(config.rule_hint, "密码规则"),
        maskCharacter: "•",
      },
    }
  }

  if (templateType === "sort") {
    const items = asArray(config.items).map(mapCommonEntry)
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
    const left = asArray(config.left).map(mapCommonEntry)
    const right = asArray(config.right).map(mapCommonEntry)
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
    const pieces = asArray(config.pieces).map((item, pieceIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `piece-${pieceIndex + 1}`),
      label: normalizeText(item?.label ?? item?.hint, `碎片 ${pieceIndex + 1}`),
      hint: item?.hint ?? null,
    }))

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: config.base_image_url ?? config.baseImageUrl ?? null,
        gridSize: Math.max(2, Number(config.grid_cols ?? config.gridCols ?? Math.ceil(Math.sqrt(pieces.length || 4)))),
        pieces,
        correctOrder: pieces.map((item) => item.id),
        revealTitle: "拼回纹样",
        trayTitle: "碎片托盘",
      },
    }
  }

  if (templateType === "select") {
    const candidates = asArray(config.candidates ?? config.options).map((item, candidateIndex) => ({
      id: normalizeText(item?.id ?? item?.key ?? item?.value, `candidate-${candidateIndex + 1}`),
      label: normalizeText(item?.label ?? item?.text ?? item?.title, `候选 ${candidateIndex + 1}`),
      imageUrl: item?.image_url ?? item?.imageUrl ?? null,
      description: item?.description ?? item?.summary ?? item?.hint ?? null,
    }))
    const minPick = Math.max(1, Number(config.min_pick ?? config.minPick ?? 1))
    const rawMaxPick = config.max_pick ?? config.maxPick
    const maxPick = rawMaxPick == null
      ? Math.max(minPick, candidates.length || minPick)
      : Math.max(minPick, Number(rawMaxPick) || minPick)
    const theme = normalizeText(config.theme)

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        theme: theme || null,
        minPick,
        maxPick,
        candidates,
        pickedTitle: "候选展品",
      },
    }
  }

  if (templateType === "multi_step_reasoning") {
    const candidates = asArray(config.candidates).map((item, evidenceIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `evidence-${evidenceIndex + 1}`),
      label: normalizeText(item?.label ?? item?.text, `证据 ${evidenceIndex + 1}`),
      note: item?.description ?? item?.hint ?? null,
      tag: null,
    }))
    const evidence = candidates.length ? candidates : [{ id: "evidence-1", label: content, note: null, tag: null }]

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
            label: normalizeText(config.theme, "选择的证据可以支持当前判断"),
            summary: null,
          },
        ],
        correctConclusionId: "picked",
        chainTitle: "证据链",
        slotLabels: [],
        conclusionTitle: "结论",
      },
    }
  }

  if (templateType === "clue_find") {
    const diffs = asArray(config.diffs)
    const hotspots = diffs.map((item, hotspotIndex) => ({
      id: normalizeText(item?.id ?? item?.key, `diff-${hotspotIndex + 1}`),
      x: Number(item?.x ?? 0.4) * 100,
      y: Number(item?.y ?? 0.4) * 100,
      width: Number(item?.r ?? 0.08) * 200,
      height: Number(item?.r ?? 0.08) * 200,
      label: normalizeText(item?.label, `差异 ${hotspotIndex + 1}`),
    }))

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: config.altered_image_url ?? config.base_image_url ?? null,
        targetDescription: normalizeText(config.theme, "找出关键差异"),
        hotspots: hotspots.length ? hotspots : [{ id: "hotspot-1", x: 40, y: 40, width: 18, height: 18, label: "线索区域" }],
        correctHotspotId: hotspots[0]?.id ?? "hotspot-1",
      },
    }
  }

  const answerExtra = getAnswerExtra(stage, config)
  const options = makeChoiceOptions(asArray(answerExtra.options ?? config.options), `${stageId}-option`)

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
  const location = normalizeText(stage.galleryName, `第 ${index + 1} 站`)
  const exhibitName = normalizeText(stage.exhibitName, normalizeText(stage.title, `展品 ${index + 1}`))

  return {
    id: normalizeText(stage.refExhibitId, `artifact-${puzzle.id}`),
    title: exhibitName,
    subtitle: normalizeText(stage.subtitle, "路线节点"),
    location,
    observationPoint: normalizeText(config.rule_hint ?? config.theme, "先看展品，再开始互动。"),
    storyFragment: normalizeText(stage.subtitle, "这一站会把路线线索推进一步。"),
    suspiciousPoint: "不要急着提交，先把题面和展品细节对齐。",
    checklist: ["确认展品位置", "阅读题面", "找出关键细节"],
    detailCallout: normalizeText(config.rule_hint ?? config.theme, "题面提到的细节最值得先看。"),
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
    theme: normalizeText(route.theme, TASK_KIND_LABEL_MAP[taskKind]),
    summary: normalizeText(intro, "暂无简介"),
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
    rewardTitle: "完成任务",
    startLocation: "",
    badgeLabel: "已发布",
    persona: {
      id: normalizeText(route.persona?.id, "remote-persona"),
      code: normalizeText(route.persona?.personaCode, "remote-persona"),
      name: normalizeText(route.persona?.name, "任务向导"),
      intro: "",
      avatar: normalizeText(route.persona?.name, "任").slice(0, 1),
      voiceStyle: "",
    },
    taglines: (route.allowTeam ?? 0) === 1 ? ["支持组队"] : ["单人游玩"],
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
      objective: normalizeText(stage.subtitle, `完成${normalizeText(stage.title, `第 ${index + 1} 站`)}`),
      targetLocation: artifact.location,
      resultNarrative: `${normalizeText(stage.title, `第 ${index + 1} 站`)}已经完成，路线线索继续向前推进。`,
      nextTarget: "",
      artifact,
      puzzle,
    }
  })

  return {
    ...routeCard,
    puzzleCount: chapters.length || routeCard.puzzleCount,
    chapterCount: chapters.length || routeCard.chapterCount,
    startLocation: chapters[0]?.targetLocation || "路线起点",
    rewardTitle: routeCard.rewardTitle || "路线完成奖励",
    museumName: "Path Seeker 博物探索馆",
    prologue: (detail.stories ?? []).map((story, index) => ({
      eyebrow: `故事 ${index + 1}`,
      title: normalizeText(story.title, `线索 ${index + 1}`),
      content: normalizeText(story.content, routeCard.summary),
    })).slice(0, 3),
    introPanel: {
      narrative: routeCard.summary,
      playbook: ["先观察展品", "按节点完成互动", "卡住时使用提示", "完成全部节点解锁终局"],
      rewardPreview: [routeCard.rewardTitle || "路线完成奖励"],
    },
    chapters,
    finale: {
      title: `${routeCard.title}完成`,
      truth: "你已经按节点完成整条路线。",
      debrief: "所有关键线索已经收束，可以回顾你的路线成绩。",
      knowledgeNotes: ["路线节点来自后端配置", "完成状态会由游玩接口记录", "提示与得分由后端规则判定"],
      scoreTitle: "路线成绩",
      shareLine: `我完成了「${routeCard.title}」。`,
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
