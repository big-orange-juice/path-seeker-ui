/** 轻量 Toast 反馈体系 */
window.DemoToast = (() => {
  const root = () => document.getElementById("toast-root");
  const timers = new WeakMap();

  function show(type, title, message, duration = 2800) {
    const el = document.createElement("div");
    el.className = `toast ${type || "info"}`;
    el.innerHTML = `
      <div class="toast-dot"></div>
      <div>
        <p class="toast-title">${escapeHtml(title)}</p>
        ${message ? `<p class="toast-msg">${escapeHtml(message)}</p>` : ""}
      </div>
    `;
    root().appendChild(el);

    const timer = setTimeout(() => dismiss(el), duration);
    timers.set(el, timer);
    el.addEventListener("click", () => dismiss(el));
    return el;
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    const t = timers.get(el);
    if (t) clearTimeout(t);
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 240);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    info: (title, msg) => show("info", title, msg),
    success: (title, msg) => show("success", title, msg),
    warning: (title, msg) => show("warning", title, msg),
    error: (title, msg) => show("error", title, msg),
  };
})();
