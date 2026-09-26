/**
 * 供应商 SSE 解析工具：按行读取 `data: {json}`，忽略注释与空行。
 * MiniMax T2A、MiniMax ASR（stream=true）与 DeepSeek 都返回这种格式。
 */
export async function* readSseJson(body) {
  if (!body) return;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      const parsed = parseLine(line);
      if (parsed !== undefined) yield parsed;
      newlineIndex = buffer.indexOf("\n");
    }
  }
  const tail = parseLine(buffer.replace(/\r$/, ""));
  if (tail !== undefined) yield tail;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return undefined;
  if (!trimmed.startsWith("data:")) return undefined;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    // 分片边界或供应商非 JSON 心跳，直接跳过
    return undefined;
  }
}

export function joinUrl(baseUrl, pathname) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const suffix = String(pathname || "").startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${suffix}`;
}
