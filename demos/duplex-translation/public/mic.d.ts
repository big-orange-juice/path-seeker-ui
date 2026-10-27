export function startTranslationMic(context: AudioContext, onFrame: (frame: Float32Array) => void, options?: { onError?: (error: Error) => void }): Promise<{
  stop(options?: { flush?: boolean }): Promise<void>
  getStats(): { frames: number; samples: number; sampleRate: number; lastFrameAgeMs: number; audioSettings: Omit<MediaTrackSettings, 'echoCancellation'> & { echoCancellation?: boolean | string } }
}>
