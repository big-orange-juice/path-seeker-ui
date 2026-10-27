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
