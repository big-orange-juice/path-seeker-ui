export interface SseRawEvent {
  id: string
  event: string
  data: string
}

/**
 * 增量 SSE 解析（对齐 B 端 createSseParser）。
 * 空行结束一个事件块时触发 onEvent。
 */
export function createSseParser(onEvent: (event: SseRawEvent) => void) {
  let buffer = ""
  let eventId = ""
  let eventName = ""
  let dataLines: string[] = []

  const flush = () => {
    if (!eventId && !eventName && dataLines.length === 0) {
      return
    }

    onEvent({
      id: eventId,
      event: eventName || "message",
      data: dataLines.join("\n"),
    })

    eventId = ""
    eventName = ""
    dataLines = []
  }

  const push = (chunk: string) => {
    buffer += chunk

    while (true) {
      const newlineIndex = buffer.indexOf("\n")
      if (newlineIndex < 0) {
        break
      }

      let line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)

      if (line.endsWith("\r")) {
        line = line.slice(0, -1)
      }

      if (!line) {
        flush()
        continue
      }

      if (line.startsWith(":")) {
        continue
      }

      const separatorIndex = line.indexOf(":")
      const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line
      let value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : ""

      if (value.startsWith(" ")) {
        value = value.slice(1)
      }

      if (field === "id") {
        eventId = value
      } else if (field === "event") {
        eventName = value
      } else if (field === "data") {
        dataLines.push(value)
      }
    }
  }

  const end = () => {
    if (buffer.trim()) {
      push("\n\n")
    } else {
      flush()
    }
    buffer = ""
  }

  return { push, end }
}
