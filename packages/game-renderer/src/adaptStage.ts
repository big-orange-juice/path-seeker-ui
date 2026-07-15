/**
 * 后端 stage config → 渲染器 PuzzleDefinition 的唯一映射入口。
 *
 * 目标：
 * - web-admin 预览与 h5/mp 作答共用同一套字段归一
 * - 渲染器组件只认 canonical 契约，不处理 transport 别名
 * - app 侧 adapter 只负责业务外壳（会话、奖励、提交流程）
 */

import type {
  ChoiceOption,
  MatchPair,
  PuzzleDefinition,
  PuzzleTemplateType,
} from "./contracts"

/** 后端 interactionType → 渲染器 templateType */
export const INTERACTION_TO_TEMPLATE_MAP: Record<number, PuzzleTemplateType> = {
  1: "observe_choice",
  2: "code_break",
  3: "sort",
  4: "match",
  5: "select",
  6: "image_puzzle",
  7: "match",
  8: "clue_find",
  9: "match",
  // 10 / 11 不进 PuzzleRendererHost；占位仅保证对象可构造
  10: "clue_find",
  11: "observe_choice",
}

/** 产品主路径题型（选择 + 拼图） */
export const PRIMARY_PUZZLE_TEMPLATES: PuzzleTemplateType[] = [
  "observe_choice",
  "select",
  "image_puzzle",
]

export type StageKind = "puzzle" | "find_scan" | "narration"

/**
 * 各端 stage 输入的最小公共形状。
 * 允许 string/object 混用的 config，由本模块统一解析。
 */
export interface StageAdaptInput {
  stageId?: string | null
  title?: string | null
  subtitle?: string | null
  interactionType?: number | null
  /** 部分接口用 puzzleType 兜底 interactionType */
  puzzleType?: number | null
  /** JSON 字符串或已解析对象 */
  config?: unknown
  /** StagePlay 可能单独下发 answerExtra */
  answerExtra?: unknown
  /** StagePlay 可能单独下发题干 */
  puzzleContent?: string | null
  /** 无 stageId 时用于生成稳定 id */
  index?: number
}

export function isPrimaryPuzzleTemplate(type: PuzzleTemplateType) {
  return PRIMARY_PUZZLE_TEMPLATES.includes(type)
}

export function resolvePuzzleTemplateType(interactionType?: number | null): PuzzleTemplateType {
  const type = Number(interactionType || 0)
  return INTERACTION_TO_TEMPLATE_MAP[type] ?? "observe_choice"
}

/** 按 interactionType 分流页面链路（1–9 闯关 / 10 找一找 / 11 解说） */
export function resolveStageKind(interactionType?: number | null): StageKind {
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

/** interactionType 1–9 走 PuzzleRendererHost */
export function isPuzzleInteraction(interactionType?: number | null) {
  const type = Number(interactionType || 0)
  return type >= 1 && type <= 9
}

export function normalizeText(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim() : ""
  return text || fallback
}

export function parseJsonValue(value: unknown): unknown {
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

export function parseStageConfig(value: unknown): Record<string, any> {
  const parsed = parseJsonValue(value)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, any>)
    : {}
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

function getAnswerExtra(config: Record<string, any>, answerExtra?: unknown) {
  const fromStage = parseStageConfig(answerExtra)
  const fromConfig = parseStageConfig(
    pickValue(config, "answer_extra", "answerExtra", "AnswerExtra"),
  )
  return { ...fromConfig, ...fromStage }
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
    label:
      readItemText(item, "label", "Label", "text", "Text", "title", "Title", "name", "Name", "hint", "Hint", "exhibit_id", "exhibitId")
      || `项目 ${index + 1}`,
    imageUrl:
      pickValue(item ?? {}, "image_url", "imageUrl", "ImageUrl", "silhouette_url", "silhouetteUrl", "url", "Url")
      ?? null,
  }
}

/**
 * 提示分层：config.hints 按 sort_order 取前三条 → observe / relation / direct
 */
export function buildHintPayloadFromConfig(config: Record<string, any>): Partial<Record<"observe" | "relation" | "direct", string>> {
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

function resolveStageId(input: StageAdaptInput) {
  const index = input.index ?? 0
  return (
    normalizeText(input.stageId)
    || `stage-${index + 1}`
  )
}

function resolveContent(input: StageAdaptInput, config: Record<string, any>) {
  return normalizeText(
    input.puzzleContent,
    normalizeText(
      pickValue(config, "content", "Content", "prompt", "Prompt", "theme", "Theme", "rule_hint", "ruleHint", "RuleHint"),
    ),
  )
}

/**
 * 将后端 stage 映射为渲染器 PuzzleDefinition。
 * 应用层可在返回值上再叠加 reward / difficulty 等业务字段。
 */
export function adaptStageToPuzzle(input: StageAdaptInput): PuzzleDefinition {
  const config = parseStageConfig(input.config)
  const stageId = resolveStageId(input)
  const stageTitle = normalizeText(input.title, "未命名节点")
  const content = resolveContent(input, config)
  const interactionType = Number(input.interactionType || input.puzzleType || 1)
  const templateType = resolvePuzzleTemplateType(interactionType)

  const base = {
    id: stageId,
    interactionType,
    title: stageTitle,
    introText: normalizeText(input.subtitle) || undefined,
    prompt: content,
    hintPayload: buildHintPayloadFromConfig(config),
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
        clueFragments: asArray(config.clue_images ?? config.clueImages)
          .map((item) => normalizeText(item?.hint ?? item?.label ?? item?.text))
          .filter(Boolean),
        derivationSteps: [],
        clueSourceTitle: normalizeText(config.rule_hint ?? config.ruleHint) || null,
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
    // 兼容 admin 预览用 left/right 与后端 left_items/right_items
    const leftSource = asArray(
      config.left_items ?? config.leftItems ?? config.left ?? config.Left,
    )
    const rightSource = asArray(
      config.right_items ?? config.rightItems ?? config.right ?? config.Right,
    )
    const leftItems = leftSource.map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const rightItems = rightSource.map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const correctPairs = asArray(config.correct_pairs ?? config.correctPairs).map((pair: any) => ({
      leftId: readItemText(pair, "leftId", "left_id", "left"),
      rightId: readItemText(pair, "rightId", "right_id", "right"),
    })) as MatchPair[]

    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content || (
          interactionType === 7
            ? "听声音，找对应图像。"
            : interactionType === 9
              ? "把剪影与原图配对。"
              : "把左右两侧档案配对。"
        ),
        left: leftItems,
        right: rightItems,
        correctPairs,
      },
    }
  }

  if (templateType === "select") {
    const options = makeChoiceOptions(
      asArray(config.options ?? config.targets ?? config.candidates),
      `${stageId}-select`,
    )
    const answerExtra = getAnswerExtra(config, input.answerExtra)
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        candidates: options,
        minPick: Number(answerExtra.minPick ?? answerExtra.min_pick ?? config.minPick ?? config.min_pick ?? 1),
        maxPick: Number(
          answerExtra.maxPick
          ?? answerExtra.max_pick
          ?? config.maxPick
          ?? config.max_pick
          ?? Math.max(1, options.length),
        ),
        theme: normalizeText(config.theme) || null,
        pickedTitle: normalizeText(config.pickedTitle ?? config.picked_title) || null,
      },
    }
  }

  if (templateType === "clue_find") {
    const hotspots = asArray(config.hotspots ?? config.targets)
    const correctHotspotId = normalizeText(
      config.correct_hotspot_id ?? config.correctHotspotId ?? hotspots[0]?.id,
    )
    return {
      ...base,
      templateType,
      questionPayload: {
        prompt: content,
        imageUrl: normalizeText(config.image_url ?? config.imageUrl ?? config.base_image_url ?? config.baseImageUrl) || null,
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
    const evidenceItems = asArray(config.evidence_items ?? config.evidenceItems ?? config.evidence)
      .map((item, itemIndex) => mapCommonEntry(item, itemIndex))
    const conclusionOptions = makeChoiceOptions(
      asArray(config.conclusions ?? config.options),
      `${stageId}-conclusion`,
    )
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
        correctEvidenceOrder: asArray<string>(config.correct_evidence_order ?? config.correctEvidenceOrder)
          .map((item) => normalizeText(item)),
        conclusions: conclusionOptions.map((item) => ({
          id: item.id,
          label: item.label,
          summary: item.description ?? null,
        })),
        correctConclusionId: normalizeText(
          config.correct_conclusion_id ?? config.correctConclusionId ?? conclusionOptions[0]?.id,
        ),
        chainTitle: normalizeText(config.chainTitle ?? config.chain_title) || null,
        slotLabels: asArray<string>(config.slotLabels ?? config.slot_labels)
          .map((item) => normalizeText(item))
          .filter(Boolean),
        conclusionTitle: normalizeText(config.conclusionTitle ?? config.conclusion_title) || null,
      },
    }
  }

  // observe_choice：优先 options/choices；线性答题也可从 answer_extra.options 取
  const answerExtra = getAnswerExtra(config, input.answerExtra)
  const rawOptions = asArray(
    config.options
    ?? config.choices
    ?? answerExtra.options
    ?? answerExtra.choices,
  )
  const options = makeChoiceOptions(rawOptions, `${stageId}-choice`)
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
