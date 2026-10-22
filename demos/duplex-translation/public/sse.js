export async function readSse(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data = [];
  let id = "";
  function consume(line) {
    if (!line) {
      if (data.length) onEvent({ event, id, data: JSON.parse(data.join("\n")) });
      event = "message";
      data = [];
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
    if (field === "id") id = value;
  }
  function drain(final) {
    let match;
    while ((match = /\r\n|\r|\n/.exec(buffer))) {
      if (!final && match[0] === "\r" && match.index === buffer.length - 1) break;
      consume(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
    }
    if (final && buffer) consume(buffer);
    if (final) consume("");
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      drain(done);
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
