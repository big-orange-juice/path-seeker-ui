export function createSessionBootstrap({ getToken, setToken, getSession, setSession, getMuseum, request, device }) {
  let pending = null;
  return function ensureSession() {
    if (pending) return pending;
    pending = (async () => {
      if (!getToken().trim()) {
        const result = await request("/api/AppUser/GuestLogin", {
          headers: {}, body: { platform: 5, device, langCode: "zh-CN" },
        });
        if (typeof result.accessToken !== "string" || !result.accessToken.trim()) throw new Error("游客登录未返回有效 Token，请重试。");
        setToken(result.accessToken);
        setSession("");
      }
      if (!getSession().trim()) {
        const result = await request("sessions", { body: { museumId: getMuseum(), title: "实时翻译 Demo" } });
        if (typeof result.id !== "string" || !result.id) throw new Error("会话接口未返回字符串 ID，请检查后端返回格式。");
        setSession(result.id);
      }
    })().finally(() => { pending = null; });
    return pending;
  };
}
