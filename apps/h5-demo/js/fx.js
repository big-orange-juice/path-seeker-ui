/**
 * 场景衔接：内容淡出淡入 + 星空加速（各星独立漂移）
 * 无中心光圈
 */
window.DemoFx = (() => {
  let busy = false;

  function reduce() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function wait(ms) {
    const t = reduce() ? Math.min(ms, 80) : ms;
    return new Promise((resolve) => setTimeout(resolve, t));
  }

  function viewEl() {
    return document.getElementById("view");
  }

  /**
   * @param {string} path
   * @param {{ effect?: string, label?: string, score?: string|number, duration?: number }} opts
   */
  async function go(path, opts = {}) {
    const { score = "", duration = 1050 } = opts;
    const next = path.startsWith("#")
      ? path
      : `#${path.startsWith("/") ? path : `/${path}`}`;

    if (reduce()) {
      if (location.hash === next) window.DemoRouter?.resolve?.();
      else location.hash = next;
      return;
    }

    if (busy) {
      location.hash = next;
      return;
    }

    busy = true;
    const view = viewEl();
    const total = Math.max(850, duration);
    document.body.classList.add("fx-swirl");

    view?.classList.add("fx-dim");
    // 切换时加速星空（各星本来就在动，这里只是提速）
    const starP = window.DemoStars?.swirlTransit?.(total, 3.1) || wait(total);

    await wait(total * 0.4);

    if (score !== "" && score != null) {
      showScoreFlash(score);
    }

    sessionStorage.setItem("ps-enter-fx", "swirl");
    if (location.hash === next) {
      window.DemoRouter?.resolve?.();
    } else {
      location.hash = next;
    }

    const v2 = viewEl();
    v2?.classList.add("fx-dim");
    await wait(30);
    v2?.classList.remove("fx-dim");
    v2?.classList.add("fx-rise");

    await wait(total * 0.35);
    await starP;

    v2?.classList.remove("fx-rise");
    document.body.classList.remove("fx-swirl");
    busy = false;
  }

  function showScoreFlash(score) {
    let el = document.getElementById("fx-score-flash");
    if (!el) {
      el = document.createElement("div");
      el.id = "fx-score-flash";
      el.className = "fx-score-flash";
      document.body.appendChild(el);
    }
    el.textContent = String(score).startsWith("+") ? String(score) : `+${score}`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 900);
  }

  async function pulse(_effect, _label, ms = 500) {
    if (reduce()) return;
    document.body.classList.add("fx-swirl");
    await (window.DemoStars?.swirlTransit?.(ms, 2.6) || wait(ms));
    document.body.classList.remove("fx-swirl");
  }

  function consumeEnterFx() {
    const fx = sessionStorage.getItem("ps-enter-fx");
    sessionStorage.removeItem("ps-enter-fx");
    return fx ? "swirl" : null;
  }

  return { go, wait, pulse, consumeEnterFx, reduce };
})();
