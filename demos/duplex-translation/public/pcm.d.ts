export function createPcmEncoder(inputRate: number, send: (packet: ArrayBuffer) => void): { feed(frame: Float32Array): void; flush(): void }
