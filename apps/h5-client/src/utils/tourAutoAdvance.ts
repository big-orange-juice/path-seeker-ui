/**
 * 下一节点自动推进策略（方案 §4.5）：
 *
 * - `proximity`：定位可用。音频播完只标记完成、不切站；走到下一节点范围内且队列空闲时自动开始播放。
 * - `sequential`：定位不可用。音频播完标记完成并自动开始下一节点。
 *
 * 这里只做纯判定，方便单测；状态与播放动作由 useTourJourney 负责。
 */

export type AutoAdvanceMode = 'proximity' | 'sequential'

export interface AutoAdvanceInput {
  /** 是否正在监听定位 */
  tracking: boolean
  /** 定位是否报错（权限被拒 / 监听失败） */
  locationError: boolean
  /** 最近一次定位是否通过质量校验（精度、时效） */
  fixUsable: boolean
}

/** 定位可用 = 正在监听 + 没有报错 + 最近定位通过质量校验；否则退化为顺序播放 */
export function resolveAutoAdvanceMode(input: AutoAdvanceInput): AutoAdvanceMode {
  return input.tracking && !input.locationError && input.fixUsable ? 'proximity' : 'sequential'
}

/** 队列结束后是否要自动切下一站 */
export function shouldAdvanceAfterQueue(mode: AutoAdvanceMode): boolean {
  return mode === 'sequential'
}

export interface AutoStartInput {
  mode: AutoAdvanceMode
  /** 播放队列状态 */
  status: 'idle' | 'playing' | 'paused'
  /** 本次进入周期内是否已经自动播放过该景点 */
  autoPlayed: boolean
  /** 用户手动播过该景点（本次进入周期） */
  userPlayed: boolean
  /** 本次进入周期内用户主动关掉过接近提示：视为"保持当前"，不再自动播 */
  dismissed: boolean
  /** 接近候选数量；多候选时不自动播，交给用户选 */
  candidateCount: number
  /** 是否处于忙碌（切换节点 / 保存进度） */
  busy: boolean
  /** 是否被抑制（问一问浮层、抽屉交互、页面后台等） */
  suppressed: boolean
  /** 是否正在结束行程 */
  ending: boolean
}

/** 接近时是否应该自动开始播放（只有"定位可用 + 队列空闲 + 唯一候选 + 未被抑制"才播） */
export function shouldAutoStartOnApproach(input: AutoStartInput): boolean {
  return input.mode === 'proximity'
    && input.status === 'idle'
    && input.candidateCount === 1
    && !input.autoPlayed
    && !input.userPlayed
    && !input.dismissed
    && !input.busy
    && !input.suppressed
    && !input.ending
}

/** 接近时是否应该自动打开内容抽屉（在播 / 暂停 / 多候选都仍然打开，只不自动播） */
export function shouldAutoOpenOnApproach(input: Pick<AutoStartInput, 'suppressed' | 'busy' | 'ending'> & { alreadyOpened: boolean }): boolean {
  return !input.alreadyOpened && !input.suppressed && !input.busy && !input.ending
}
