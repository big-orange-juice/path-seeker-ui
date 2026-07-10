/**
 * 星空：默认各自缓慢漂移（类 Grok）
 * 场景切换 / 播片时整体加速
 */
window.DemoStars = (() => {
  let canvas;
  let ctx;
  let stars = [];
  let raf = 0;
  let w = 0;
  let h = 0;
  let lastT = 0;
  let reduced = false;

  /** 1 = 常态，更高 = 加速（过渡 / 播片） */
  let speedMul = 1;
  let targetMul = 1;

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor((w * h) / 6800);
    stars = Array.from({ length: Math.max(60, Math.min(170, count)) }, () => {
      // 每颗星方向、速度各不相同
      const ang = Math.random() * Math.PI * 2;
      const baseSpeed = 2.5 + Math.random() * 8; // px/s 常态很慢
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.45 + 0.2,
        base: Math.random() * 0.4 + 0.2,
        phase: Math.random() * Math.PI * 2,
        twSpeed: 0.4 + Math.random() * 1.4,
        vx: Math.cos(ang) * baseSpeed,
        vy: Math.sin(ang) * baseSpeed,
        // 轻微扰动，轨迹更自然
        wobble: Math.random() * 0.8 + 0.2,
        wobblePhase: Math.random() * Math.PI * 2,
        gold: Math.random() > 0.82,
      };
    });
  }

  function wrap(v, max) {
    if (v < -4) return max + 4;
    if (v > max + 4) return -4;
    return v;
  }

  function tick(t) {
    if (!ctx) return;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;

    // 平滑靠近目标倍速，避免突兀
    speedMul += (targetMul - speedMul) * Math.min(1, dt * 2.2);

    const time = t * 0.001;
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      const wob = Math.sin(time * s.wobble + s.wobblePhase) * 0.35;
      s.x += (s.vx + wob) * speedMul * dt;
      s.y += (s.vy - wob * 0.6) * speedMul * dt;
      s.x = wrap(s.x, w);
      s.y = wrap(s.y, h);

      const tw = s.base + Math.sin(time * s.twSpeed + s.phase) * 0.28;
      // 加速时略更亮一点
      const a = Math.max(0.07, Math.min(0.95, tw + (speedMul - 1) * 0.04));

      ctx.beginPath();
      ctx.fillStyle = s.gold ? `rgba(232, 201, 138, ${a})` : `rgba(255, 248, 232, ${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      if (s.r > 1.15 && a > 0.55) {
        ctx.beginPath();
        ctx.strokeStyle = s.gold ? `rgba(232, 201, 138, ${a * 0.28})` : `rgba(255,255,255,${a * 0.2})`;
        ctx.lineWidth = 0.55;
        const arm = s.r * 2;
        ctx.moveTo(s.x - arm, s.y);
        ctx.lineTo(s.x + arm, s.y);
        ctx.moveTo(s.x, s.y - arm);
        ctx.lineTo(s.x, s.y + arm);
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(tick);
  }

  /**
   * 设置目标速度倍数（平滑过渡）
   * 1 常态 · 2.2 播片 · 3.2 场景切换
   */
  function setBoost(mul) {
    targetMul = Math.max(1, Math.min(5, mul || 1));
  }

  /**
   * 场景切换：加速一段时间后回到常态
   * @param {number} ms
   * @param {number} peak 峰值倍数，默认 3
   */
  function swirlTransit(ms = 1100, peak = 3) {
    if (reduced) return Promise.resolve();
    const duration = Math.max(700, ms);
    const prev = targetMul;
    setBoost(peak);
    return new Promise((resolve) => {
      setTimeout(() => {
        // 若期间被播片占用，不硬降到 1
        if (targetMul === peak) setBoost(prev > 1 && prev !== peak ? prev : 1);
        resolve();
      }, duration);
    });
  }

  /** 播片加速 */
  function setPlaying(on) {
    if (on) setBoost(2.35);
    else if (targetMul <= 2.5) setBoost(1);
  }

  function mount() {
    canvas = document.getElementById("starfield");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", () => {
      // 离开播片页时恢复常态（切换动画自己会再加速）
      if (!/#\/missions\/[^/]+\/chapters\/[^/]+\/video/.test(location.hash || "")) {
        if (targetMul <= 2.6) setBoost(1);
      }
    });
    if (reduced) {
      lastT = 0;
      tick(0);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  return { mount, setBoost, swirlTransit, setPlaying };
})();
