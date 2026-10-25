export function createTranslationPlayer(context: AudioContext, onState: (playing: boolean) => void, onError: (error: Error) => void): {
  stop(): void
  busy(): boolean
  configure(payload: Record<string, unknown>): void
  push(payload: Record<string, unknown>): void
  flush(): void
  discardPending(): void
}
