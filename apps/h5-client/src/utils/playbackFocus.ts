export type PlaybackOwner = 'tour' | 'ask' | 'room'

export function createPlaybackFocus() {
  let active: { owner: PlaybackOwner; interrupt: () => void } | null = null

  function channel(owner: PlaybackOwner, interrupt: () => void) {
    const participant = { owner, interrupt }
    return {
      claim() {
        if (active === participant) return
        const previous = active
        active = participant
        previous?.interrupt()
      },
      release() {
        if (active === participant) active = null
      },
      isCurrent: () => active === participant,
    }
  }

  return { channel, current: () => active?.owner ?? null }
}

export const playbackFocus = createPlaybackFocus()
