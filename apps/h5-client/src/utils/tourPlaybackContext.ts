export interface GuideVoiceContext {
  guideId: string | null
  providerVoiceId?: string | null
}

export function resolveTourVoiceContext(
  current: GuideVoiceContext | null,
  first: GuideVoiceContext | null,
): { guideId: string | null; voiceId: string | null } {
  const resolved = current?.providerVoiceId?.trim() ? current : first
  return {
    guideId: resolved?.providerVoiceId?.trim() ? resolved.guideId : current?.guideId ?? null,
    voiceId: resolved?.providerVoiceId?.trim() || null,
  }
}

export function hasStableApproach(startedAt: number, now: number, dwellMs: number): boolean {
  return now >= startedAt && now - startedAt >= dwellMs
}
