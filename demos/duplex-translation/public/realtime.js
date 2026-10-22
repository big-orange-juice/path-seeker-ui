export function createRealtimeConnection({ url, token, start, onEvent, onClose, WebSocketClass = WebSocket }) {
  const socket = new WebSocketClass(url, ["translation", `bearer.${token.replace(/^Bearer\s+/i, "").trim()}`]);
  let accepting = false;
  let terminal = false;
  let ending = false;
  let opened;
  let rejected;
  const ready = new Promise((resolve, reject) => { opened = resolve; rejected = reject; });
  const timeout = setTimeout(() => fail("实时连接启动超时，请检查 WebSocket 代理和后端状态。"), 20000);
  function fail(message) {
    terminal = true;
    accepting = false;
    clearTimeout(timeout);
    rejected(new Error(message));
    socket.close();
  }
  socket.onopen = () => socket.send(JSON.stringify(start));
  socket.onmessage = ({ data }) => {
    try {
      const event = JSON.parse(data);
      if (event.type === "session.started") {
        if (ending || terminal) return;
        const payload = event.payload || {};
        if (payload.sampleRate !== 16000 || payload.channels !== 1 || payload.format !== "pcm_s16le") {
          throw new Error("后端返回了不支持的采音格式。");
        }
        clearTimeout(timeout);
        accepting = true;
        opened();
      }
      if (event.type === "input.ended") accepting = false;
      if (event.type === "session.done" || event.type === "session.error") {
        clearTimeout(timeout);
        accepting = false;
        terminal = true;
        rejected(new Error(event.payload?.message || "实时会话已结束"));
      }
      onEvent(event);
    } catch (error) {
      fail(error.message);
      onEvent({ type: "session.error", payload: { message: error.message } });
    }
  };
  socket.onerror = () => fail("实时连接失败，请检查登录状态、后端路由和 WebSocket Upgrade 配置。");
  socket.onclose = () => {
    clearTimeout(timeout);
    accepting = false;
    rejected(new Error("实时连接在启动前关闭"));
    onClose({ complete: terminal });
  };
  function sendPcm(buffer) {
    if (!accepting || socket.readyState !== 1) return;
    if (buffer.byteLength > 65536 || buffer.byteLength % 2) throw new Error("PCM 消息必须为不超过 64 KiB 的完整 16bit 采样。");
    if (socket.bufferedAmount > 256000) throw new Error("音频上传积压，请检查网络后重新开始；未确认音频不会自动重传。");
    socket.send(buffer);
  }
  function flush() {
    if (accepting && socket.readyState === 1) socket.send(JSON.stringify({ type: "input.flush" }));
  }
  function end() {
    if (!accepting || socket.readyState !== 1) return;
    accepting = false;
    ending = true;
    socket.send(JSON.stringify({ type: "input.end" }));
  }
  function cancel() {
    accepting = false;
    clearTimeout(timeout);
    rejected(new Error("实时连接已取消"));
    socket.close();
  }
  return { ready, sendPcm, flush, end, cancel };
}
