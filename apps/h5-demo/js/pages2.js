/**
 * Path Seeker H5 Demo — 合并版页面
 * v1：完整主链路、博物馆语境、识别/播片/作答流程
 * v2：少文案、游戏感、路线节点图、扫描 HUD、进度环、大触控
 */
window.DemoPages = (() => {
  const S = () => window.DemoStore;
  const T = () => window.DemoToast;
  const R = () => window.DemoRouter;
  const D = () => window.DemoData;
  const Fx = () => window.DemoFx;

  /** 带动画的跳转；无 Fx 时退回普通路由 */
  function goFx(path, opts) {
    if (window.DemoFx) return window.DemoFx.go(path, opts);
    R().go(path);
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    const icons = {
      play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>`,
      back: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
      map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
      route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
      badge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>`,
      camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
      scan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
      check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
      filter: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
      spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/></svg>`,
      empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>`,
      fail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>`,
    };
    return icons[name] || icons.spark;
  }

  function shell({ title, kicker = "Path Seeker", showDock = false, activeTab = "hall", showBack = false, backTo = "#/shell/hall", userPill = true }, body) {
    const auth = S().get().auth;
    // showDock 保留参数兼容；导航已改为全局 FAB
    void showDock;
    void activeTab;

    const enterFx = Fx()?.consumeEnterFx?.();
    const enterClass = enterFx ? ` enter-${enterFx}` : "";

    return `
      <div class="shell${enterClass}">
        <div class="shell-frame has-fab">
          <header class="topbar">
            <div class="topbar-left">
              ${showBack ? `<a class="icon-btn" href="${esc(backTo)}" aria-label="返回">${icon("back")}</a>` : ""}
              <div class="top-meta">
                ${kicker ? `<p class="top-kicker">${esc(kicker)}</p>` : ""}
                <h1 class="top-title">${esc(title)}</h1>
              </div>
            </div>
            ${userPill ? `<a class="user-pill" href="#/auth">${esc(auth.displayName || "登录")}</a>` : ""}
          </header>
          ${body}
        </div>
      </div>
    `;
  }

  function bindResume(root) {
    root.querySelector('[data-action="resume-fab"]')?.addEventListener("click", () => {
      const path = S().resolveResumePath();
      if (path) goFx(path.replace(/^#/, ""), { effect: "fade", duration: 560 });
    });
  }

  function empty(title, actionHref, actionText) {
    return `
      <div class="panel">
        <div class="empty">
          <div class="empty-ico">${icon("empty")}</div>
          <h2 class="display" style="font-size:1.15rem">${esc(title)}</h2>
          ${actionHref ? `<a class="btn btn-gold mt-3" href="${esc(actionHref)}">${esc(actionText || "返回")}</a>` : ""}
        </div>
      </div>
    `;
  }

  /* ========== Ask full page ========== */
  function renderAsk(root) {
    const C = window.DemoChrome;
    if (!C) {
      root.innerHTML = shell({ title: "问一问", showBack: true }, empty("暂时不可用", "#/shell/hall"));
      return;
    }
    if (!C.attachment) {
      C.setAttachment(C.buildAttachment());
    }
    // 全页模式：关闭浮动层
    C.closeAsk?.();

    const state = C.getAskState();
    const att = state.attachment;
    const msgs = state.messages || [];
    const typing = state.typing;

    root.innerHTML = `
      <div class="shell ask-full-page">
        <div class="shell-frame has-fab ask-full-frame">
          <header class="ask-head ask-head-page">
            <div>
              <p class="ask-kicker">馆内小助手</p>
              <h1 class="ask-title">问一问</h1>
            </div>
            <div class="ask-head-actions">
              <button type="button" class="ask-icon-btn" data-ask-sheet title="浮层">收起</button>
              <a class="ask-icon-btn" href="#/shell/hall" title="关闭">关闭</a>
            </div>
          </header>

          ${
            att
              ? `
            <div class="ask-attach">
              <div class="ask-attach-body">
                <span class="ask-attach-tag">${att.kind === "artifact" ? "展品" : att.kind === "chapter" ? "这一站" : "任务"}</span>
                <strong>${esc(att.title)}</strong>
                <span class="ask-attach-sub">${esc(att.subtitle || "")}</span>
              </div>
              <button type="button" class="ask-attach-x" data-ask-detach aria-label="去掉">×</button>
            </div>
          `
              : `<div class="ask-attach ask-attach-empty"><span>没有附带内容，也可以随便问</span></div>`
          }

          <div class="ask-msgs" id="ask-msgs-page">
            ${
              msgs.length
                ? msgs.map((m) => `<div class="ask-bubble ${m.role === "user" ? "is-user" : "is-bot"}">${esc(m.text)}</div>`).join("")
                : `<div class="ask-bubble is-bot">你好。想找展品、听故事，或问这一站怎么走，都可以跟我说。</div>`
            }
            ${typing ? `<div class="ask-bubble is-bot is-typing">…</div>` : ""}
          </div>

          <form class="ask-composer" id="ask-form-page">
            <input class="ask-input" id="ask-input-page" placeholder="问问位置、故事或观察重点…" autocomplete="off" />
            <button type="submit" class="ask-send">发送</button>
          </form>
        </div>
      </div>
    `;

    root.querySelector("[data-ask-sheet]")?.addEventListener("click", () => {
      C.openAsk({ keepAttachment: true, autoAttach: false });
      R().go("/shell/hall");
    });
    root.querySelector("[data-ask-detach]")?.addEventListener("click", () => {
      C.clearAttachment();
      renderAsk(root);
    });
    root.querySelector("#ask-form-page")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = root.querySelector("#ask-input-page");
      const text = input?.value?.trim();
      if (!text) return;
      input.value = "";
      C.send(text);
    });
    const box = root.querySelector("#ask-msgs-page");
    if (box) box.scrollTop = box.scrollHeight;
    C.refresh?.();
  }

  /* ========== Auth ========== */
  function renderAuth(root) {
    const auth = S().get().auth;
    if (auth.loggedIn) {
      root.innerHTML = shell(
        { title: "我的", kicker: "账号", userPill: false },
        `
        <div class="panel">
          <div class="panel-body stack">
            <div class="center">
              <div class="score-burst" style="padding-top:0.4rem">
                <div class="medal">${icon("spark")}</div>
                <h2 class="display">${esc(auth.displayName)}</h2>
                <p class="sub mt-1">${auth.isGuest ? "游客模式" : "本机账号"}</p>
              </div>
            </div>
            <button type="button" class="btn btn-gold btn-block btn-lg" data-action="go-hall">进入展厅</button>
            <button type="button" class="btn btn-ghost btn-block" data-action="logout">退出</button>
          </div>
        </div>
        `,
      );
      root.querySelector('[data-action="go-hall"]').onclick = () => R().go("/shell/hall");
      root.querySelector('[data-action="logout"]').onclick = () => {
        S().logout();
        T().info("已退出");
        renderAuth(root);
      };
      return;
    }

    root.innerHTML = `
      <div class="shell">
        <div class="shell-frame">
          <header class="topbar">
            <div class="top-meta">
              <p class="top-kicker">Path Seeker</p>
              <h1 class="top-title">开始探索</h1>
            </div>
          </header>

          <div class="gate">
            <div class="seal-ring" aria-hidden="true"></div>
            <div class="seal">${icon("spark")}</div>
            <div style="position:relative;z-index:1">
              <p class="tag gold">馆内解谜</p>
              <h2 class="display mt-2" style="font-size:1.7rem">找到展品<br/>解开谜题</h2>
              <p class="sub mt-1">扫一扫 · 看短片 · 闯关</p>
            </div>
          </div>

          <div class="panel">
            <div class="panel-body stack">
              <div class="chip-row">
                <button type="button" class="chip active" data-mode="guest">游客</button>
                <button type="button" class="chip" data-mode="login">账号</button>
              </div>
              <div id="auth-panel"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const panel = root.querySelector("#auth-panel");
    const chips = root.querySelectorAll("[data-mode]");

    function showMode(mode) {
      chips.forEach((c) => c.classList.toggle("active", c.dataset.mode === mode));
      if (mode === "guest") {
        panel.innerHTML = `<button type="button" class="btn btn-gold btn-block btn-lg" id="btn-guest">开始探索</button>`;
        panel.querySelector("#btn-guest").onclick = () => {
          S().login({ displayName: "小探索者", isGuest: true });
          T().success("出发！");
          R().go("/shell/hall");
        };
      } else {
        panel.innerHTML = `
          <div class="stack-sm">
            <div class="field">
              <label>昵称</label>
              <input class="input" id="login-account" placeholder="你的名字" autocomplete="username" />
            </div>
            <div class="field">
              <label>密码</label>
              <input class="input" id="login-password" type="password" placeholder="随便填" autocomplete="current-password" />
            </div>
            <button type="button" class="btn btn-gold btn-block btn-lg" id="btn-login">进入</button>
          </div>
        `;
        panel.querySelector("#btn-login").onclick = () => {
          const name = panel.querySelector("#login-account").value.trim() || "探索者";
          const pwd = panel.querySelector("#login-password").value;
          if (pwd.length > 0 && pwd.length < 4) {
            T().warning("密码太短");
            return;
          }
          S().login({ displayName: name, isGuest: false });
          T().success(`欢迎，${name}`);
          R().go("/shell/hall");
        };
      }
    }

    chips.forEach((c) => c.addEventListener("click", () => showMode(c.dataset.mode)));
    showMode("guest");
  }

  /* ========== Hall ========== */
  function renderHall(root) {
    const summary = S().coverageSummary();
    const filters = S().get().filters;
    const routes = S().filteredRoutes();
    const filterOn = filters.ageBand !== "all" || filters.difficulty !== "all";

    const cards = routes
      .map(
        (m) => `
      <a class="mission-card theme-${esc(m.coverTheme || "bronze")}" href="#/tasks/${esc(m.id)}">
        <div class="mc-bg"><div class="mc-noise"></div></div>
        <div class="mc-body">
          <div class="mc-top">
            <div>
              <div class="mc-stats">
                <span class="tag gold">${esc(m.theme || m.difficultyLabel)}</span>
                <span class="tag">${esc(m.difficultyLabel)}</span>
                <span class="tag">${m.chapterCount} 站</span>
                <span class="tag">${m.estimatedMinutes} 分</span>
              </div>
              <h3 class="mc-title mt-1">${esc(m.title)}</h3>
            </div>
            <span class="go-btn" aria-hidden="true">${icon("play")}</span>
          </div>
          <p class="tiny">${esc(m.rewardTitle)}</p>
        </div>
      </a>
    `,
      )
      .join("");

    root.innerHTML = shell(
      { title: "展厅", showDock: true, activeTab: "hall" },
      `
      <div class="hud-row">
        <div class="stack gap-tight">
          <span class="tag gold">今日路线</span>
          <p class="tiny">${summary.missionCount} 条 · 收藏 ${summary.archiveCount}</p>
        </div>
        <button type="button" class="icon-btn" data-action="open-filter" aria-label="筛选" style="${filterOn ? "border-color:var(--line-strong);color:var(--gold)" : ""}">${icon("filter")}</button>
      </div>

      <div class="mission-rail">
        ${cards || empty("没有匹配路线")}
      </div>
      `,
    );

    bindResume(root);
    root.querySelector('[data-action="open-filter"]')?.addEventListener("click", () => openFilter(root, () => renderHall(root)));
  }

  function openFilter(root, onApply) {
    const overlay = document.getElementById("overlay-root");
    const filters = S().get().filters;
    overlay.className = "overlay-root open";
    overlay.innerHTML = `
      <div class="overlay-mask" data-close></div>
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h3 class="display" style="font-size:1.15rem">筛选</h3>
        <div class="stack mt-2">
          <div class="field">
            <label>年龄</label>
            <select class="input" id="f-age">
              ${D().AGE_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === filters.ageBand ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>难度</label>
            <select class="input" id="f-diff">
              ${D().DIFFICULTY_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === filters.difficulty ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="f-reset">重置</button>
            <button type="button" class="btn btn-gold" id="f-apply">确定</button>
          </div>
        </div>
      </div>
    `;
    const close = () => {
      overlay.className = "overlay-root";
      overlay.innerHTML = "";
    };
    overlay.querySelector("[data-close]").onclick = close;
    overlay.querySelector("#f-reset").onclick = () => {
      S().resetFilters();
      close();
      onApply();
    };
    overlay.querySelector("#f-apply").onclick = () => {
      S().setFilters({
        ageBand: overlay.querySelector("#f-age").value,
        difficulty: overlay.querySelector("#f-diff").value,
      });
      close();
      onApply();
    };
  }

  /* ========== Playing ========== */
  function renderPlaying(root) {
    const session = S().get().activeSession;
    const mission = S().getActiveMission();

    let body;
    if (!session || !mission) {
      body = empty("还没有任务", "#/shell/hall", "去展厅");
    } else {
      const progress = Math.round((session.solvedChapterIds.length / mission.chapterCount) * 100);
      const steps = mission.chapters
        .map((ch, index) => {
          const solved = session.solvedChapterIds.includes(ch.id);
          const active = session.currentChapterIndex === index;
          return `
            <button type="button" class="step ${active ? "active" : ""} ${solved ? "solved" : ""}" data-chapter-index="${index}">
              <div class="n">${solved ? "✓" : ch.stageNo}</div>
              <div style="min-width:0;flex:1">
                <div class="t">${esc(ch.title)}</div>
                <div class="s">${solved ? "完成" : active ? "当前" : "待探索"}</div>
              </div>
            </button>
          `;
        })
        .join("");

      body = `
        <div class="panel">
          <div class="panel-body stack">
            <div class="hud-row">
              <div>
                <span class="tag ok">探索中</span>
                <h2 class="display mt-1" style="font-size:1.35rem">${esc(mission.title)}</h2>
                <p class="tiny mt-1">${session.solvedChapterIds.length}/${mission.chapterCount} · ${session.totalScore} 分</p>
              </div>
              <div class="ring" style="--p:${progress}"><span>${progress}%</span></div>
            </div>
            <div class="step-list">${steps}</div>
            <button type="button" class="btn btn-gold btn-block btn-lg" data-action="continue">继续探索</button>
            <div class="btn-row">
              <button type="button" class="btn btn-ghost" data-action="to-map">路线图</button>
              <button type="button" class="btn btn-ghost" data-action="clear">清空</button>
            </div>
          </div>
        </div>
      `;
    }

    root.innerHTML = shell({ title: "探索", showDock: true, activeTab: "playing" }, body);
    bindResume(root);

    if (session && mission) {
      root.querySelectorAll("[data-chapter-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.chapterIndex);
          S().selectChapter(idx);
          const ch = mission.chapters[idx];
          const prog = session.chapterProgress[ch.id];
          if (prog?.videoWatched && !prog?.solved) {
            goFx(`/missions/${mission.id}/chapters/${ch.id}/puzzle`, { effect: "fade", duration: 700 });
          } else if (prog?.recognized && !prog?.videoWatched) {
            goFx(`/missions/${mission.id}/chapters/${ch.id}/video`, { effect: "cinema", duration: 860 });
          } else {
            goFx(`/missions/${mission.id}/chapters/${ch.id}/brief`, { effect: "fade", duration: 700 });
          }
        });
      });
      root.querySelector('[data-action="continue"]').onclick = () => {
        const path = S().resolveResumePath();
        goFx(path.replace(/^#/, ""), { effect: "fade", duration: 640 });
      };
      root.querySelector('[data-action="to-map"]').onclick = () =>
        goFx(`/missions/${mission.id}/map`, { effect: "fade", duration: 600 });
      root.querySelector('[data-action="clear"]').onclick = () => {
        S().clearActiveSession();
        T().info("已清空");
        renderPlaying(root);
      };
    }
  }

  /* ========== Archive ========== */
  function renderArchive(root) {
    const archives = S().get().archives;
    const body = archives.length
      ? archives
          .map(
            (e) => `
        <div class="panel">
          <div class="panel-body">
            <div class="hud-row">
              <div>
                <span class="tag gold">徽章</span>
                <h2 class="display mt-1" style="font-size:1.25rem">${esc(e.routeTitle)}</h2>
                <p class="tiny mt-1">${esc(e.rewardTitle)}</p>
              </div>
              <div class="score">${e.totalScore}</div>
            </div>
            <div class="stat-grid mt-2">
              <div class="stat"><b>${e.solvedCount}/${e.puzzleCount}</b><span>站</span></div>
              <div class="stat"><b>${e.usedHintCount}</b><span>提示</span></div>
              <div class="stat"><b>✓</b><span>完成</span></div>
            </div>
          </div>
        </div>
      `,
          )
          .join("")
      : empty("还没有收藏", "#/shell/hall", "去闯关");

    root.innerHTML = shell({ title: "收藏", showDock: true, activeTab: "archive" }, body);
    bindResume(root);
  }

  /* ========== Task Detail ========== */
  function renderTaskDetail(root, routeId) {
    const mission = D().getMission(routeId);
    if (!mission) {
      root.innerHTML = shell({ title: "任务", showBack: true }, empty("任务不存在", "#/shell/hall", "返回"));
      return;
    }

    const session = S().get().activeSession;
    const canResume = session && session.routeId === mission.id && session.status === "in_progress";

    root.innerHTML = shell(
      { title: "任务", showBack: true, backTo: "#/shell/hall", kicker: mission.theme || "" },
      `
      <section class="art-hero theme-${esc(mission.coverTheme || "bronze")}">
        <div class="art-hero-glow"></div>
        <div class="art-hero-meta">
          <span class="tag gold">${esc(mission.difficultyLabel)}</span>
          <span class="tag">${mission.chapterCount} 站</span>
          <span class="tag">${mission.estimatedMinutes} 分</span>
        </div>
        <h2 class="art-hero-title">${esc(mission.title)}</h2>
        <p class="art-hero-lead">${esc(mission.summary || "")}</p>
        <p class="art-hero-reward">完成可得 · ${esc(mission.rewardTitle || "纪念徽章")}</p>
      </section>

      <section class="art-section">
        <p class="art-section-label">这一路会经过</p>
        <div class="art-chapter-rail">
          ${mission.chapters
            .map(
              (ch) => `
            <div class="art-chapter-pill">
              <span class="art-chapter-n">${ch.stageNo}</span>
              <span class="art-chapter-t">${esc(ch.title)}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>

      <div class="art-actions">
        ${canResume ? `<button type="button" class="btn btn-gold btn-block btn-lg" data-action="resume">接着玩</button>` : ""}
        <button type="button" class="btn ${canResume ? "btn-ghost" : "btn-gold"} btn-block btn-lg" data-action="start">
          ${canResume ? "从头开始" : "开始探索"}
        </button>
      </div>
      `,
    );

    root.querySelector('[data-action="start"]').onclick = () => {
      S().startMission(mission.id);
      goFx(`/missions/${mission.id}/prologue`, { effect: "fade", duration: 720 });
    };

    root.querySelector('[data-action="resume"]')?.addEventListener("click", () => {
      const path = S().resolveResumePath();
      goFx(path.replace(/^#/, ""), { effect: "fade", duration: 640 });
    });
  }

  /* ========== Prologue / 任务介绍（纵向） ========== */
  function renderPrologue(root, routeId) {
    ensureSession(routeId);
    const mission = D().getMission(routeId);
    if (!mission) {
      root.innerHTML = shell({ title: "介绍", showBack: true }, empty("暂时打不开", `#/tasks/${routeId}`));
      return;
    }

    const beats =
      mission.prologue?.length > 0
        ? mission.prologue
        : [
            {
              eyebrow: "简介",
              title: mission.title,
              content: mission.summary || "跟着路线，找到展品，解开谜题。",
            },
          ];

    const beatHtml = beats
      .map(
        (b, i) => `
      <article class="story-beat">
        <div class="story-beat-index">${String(i + 1).padStart(2, "0")}</div>
        <div class="story-beat-body">
          ${b.eyebrow ? `<p class="story-beat-eye">${esc(b.eyebrow)}</p>` : ""}
          ${b.title ? `<h3 class="story-beat-title">${esc(b.title)}</h3>` : ""}
          ${b.content ? `<p class="story-beat-copy">${esc(b.content)}</p>` : ""}
        </div>
      </article>
    `,
      )
      .join("");

    root.innerHTML = shell(
      { title: "介绍", showBack: true, backTo: `#/tasks/${routeId}`, kicker: mission.theme || "" },
      `
      <div class="story-head">
        <h2 class="story-head-title">${esc(mission.title)}</h2>
        ${mission.summary ? `<p class="story-head-lead">${esc(mission.summary)}</p>` : ""}
      </div>
      <div class="story-stack">${beatHtml}</div>
      <div class="art-actions">
        <button type="button" class="btn btn-gold btn-block btn-lg" data-action="enter-map">去选站</button>
      </div>
      `,
    );

    root.querySelector('[data-action="enter-map"]').onclick = () => {
      goFx(`/missions/${routeId}/map`, { effect: "fade", duration: 700 });
    };
  }

  /* ========== Chapter Map ========== */
  function renderChapterMap(root, routeId) {
    ensureSession(routeId);
    const mission = S().getActiveMission() || D().getMission(routeId);
    const session = S().get().activeSession;

    if (!mission || !session || session.routeId !== routeId) {
      root.innerHTML = shell(
        { title: "路线", showBack: true, backTo: `#/tasks/${routeId}` },
        empty("请先开始任务", `#/tasks/${routeId}`, "返回"),
      );
      return;
    }

    const current = mission.chapters[session.currentChapterIndex];
    const progress = Math.round((session.solvedChapterIds.length / mission.chapterCount) * 100);

    const list = mission.chapters
      .map((ch, index) => {
        const solved = session.solvedChapterIds.includes(ch.id);
        const active = session.currentChapterIndex === index;
        const prog = session.chapterProgress[ch.id] || {};
        let state = "待探索";
        if (solved) state = "完成";
        else if (active) state = "当前";
        else if (prog.recognized) state = "已识别";
        return `
          <button type="button" class="step ${active ? "active" : ""} ${solved ? "solved" : ""}" data-idx="${index}">
            <div class="n">${solved ? "✓" : ch.stageNo}</div>
            <div style="min-width:0;flex:1;text-align:left">
              <div class="t">${esc(ch.title)}</div>
              <div class="s">${esc(ch.targetLocation || "")}</div>
            </div>
            <div class="tiny" style="flex-shrink:0">${state}</div>
          </button>
        `;
      })
      .join("");

    root.innerHTML = shell(
      { title: "路线", showBack: true, backTo: `#/tasks/${routeId}`, kicker: mission.title },
      `
      <div class="hud-row">
        <div>
          <span class="tag gold">${session.solvedChapterIds.length}/${mission.chapterCount}</span>
          <p class="tiny mt-1">${session.totalScore} 分</p>
        </div>
        <div class="ring" style="--p:${progress}"><span>${progress}%</span></div>
      </div>

      <div class="step-list art-step-list">${list}</div>

      ${
        current
          ? `
        <div class="chapter-intro" data-stage-card>
          <p class="chapter-intro-label">本章简介</p>
          <h3 class="chapter-intro-title">${esc(current.title)}</h3>
          <p class="chapter-intro-copy">${esc(current.objective || current.artifact?.detailCallout || "到站后细细观察。")}</p>
          <p class="chapter-intro-place">${esc(current.targetLocation || "")}</p>
        </div>
      `
          : ""
      }

      <div class="art-actions">
        <button type="button" class="btn btn-gold btn-block btn-lg" data-action="enter">进入这一站</button>
      </div>
      `,
    );

    root.querySelectorAll("[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const already = S().get().activeSession?.currentChapterIndex === idx;
        S().selectChapter(idx);
        if (already) {
          enterChapter(mission.chapters[idx]);
          return;
        }
        paintSelection(idx);
      });
    });

    function paintSelection(idx) {
      const ch = mission.chapters[idx];
      if (!ch) return;
      root.querySelectorAll("[data-idx]").forEach((el) => {
        const i = Number(el.dataset.idx);
        const solved = session.solvedChapterIds.includes(mission.chapters[i].id);
        el.classList.toggle("active", i === idx);
        el.classList.toggle("solved", solved);
        const stateEl = el.querySelector(".tiny");
        if (stateEl) {
          const prog = session.chapterProgress[mission.chapters[i].id] || {};
          let state = "待探索";
          if (solved) state = "完成";
          else if (i === idx) state = "当前";
          else if (prog.recognized) state = "已识别";
          stateEl.textContent = state;
        }
      });
      const stage = root.querySelector("[data-stage-card]");
      if (stage) {
        stage.innerHTML = `
          <p class="chapter-intro-label">本章简介</p>
          <h3 class="chapter-intro-title">${esc(ch.title)}</h3>
          <p class="chapter-intro-copy">${esc(ch.objective || ch.artifact?.detailCallout || "到站后细细观察。")}</p>
          <p class="chapter-intro-place">${esc(ch.targetLocation || "")}</p>
        `;
      }
    }

    function enterChapter(ch) {
      if (!ch) return;
      const prog = S().get().activeSession?.chapterProgress?.[ch.id];
      if (prog?.solved) {
        T().info("这一站已完成");
        return;
      }
      if (prog?.videoWatched) {
        goFx(`/missions/${routeId}/chapters/${ch.id}/puzzle`, { effect: "fade", duration: 700 });
        return;
      }
      if (prog?.recognized) {
        goFx(`/missions/${routeId}/chapters/${ch.id}/video`, { effect: "cinema", duration: 860 });
        return;
      }
      goFx(`/missions/${routeId}/chapters/${ch.id}/brief`, { effect: "fade", duration: 700 });
    }

    root.querySelector('[data-action="enter"]').onclick = () => enterChapter(S().currentChapter());
  }

  /* ========== Brief：线索（简化头） ========== */
  function renderBrief(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const mission = S().getActiveMission() || D().getMission(routeId);
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;

    if (!mission || !chapter || !session) {
      root.innerHTML = shell(
        { title: "线索", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("这一站暂时打不开", `#/missions/${routeId}/map`),
      );
      return;
    }

    const art = chapter.artifact || {};
    const prog = session.chapterProgress[chapterId] || {};

    if (prog.recognized && !prog.videoWatched) {
      goFx(`/missions/${routeId}/chapters/${chapterId}/video`, { effect: "cinema", duration: 800 });
      return;
    }
    if (prog.videoWatched && !prog.solved) {
      goFx(`/missions/${routeId}/chapters/${chapterId}/puzzle`, { effect: "fade", duration: 700 });
      return;
    }
    if (prog.solved) {
      goFx(`/missions/${routeId}/map`, { effect: "fade", duration: 560 });
      return;
    }

    const riddle = chapter.objective || art.detailCallout || "到展柜前仔细观察。";
    const place = chapter.targetLocation || art.location || "展厅";
    const tips = (art.checklist && art.checklist.length
      ? art.checklist.slice(0, 3)
      : [art.observationPoint, art.detailCallout].filter(Boolean)
    ).slice(0, 3);

    root.innerHTML = shell(
      { title: "线索", showBack: true, backTo: `#/missions/${routeId}/map`, kicker: `第 ${chapter.stageNo} 站` },
      `
      <div class="brief-simple">
        <h2 class="brief-simple-title">${esc(chapter.title)}</h2>
        <p class="brief-simple-riddle">${esc(riddle)}</p>
      </div>

      <div class="brief-place bare">
        <span class="brief-place-dot"></span>
        <div>
          <p class="tiny" style="margin:0">位置</p>
          <p class="brief-place-name">${esc(place)}</p>
        </div>
      </div>

      ${
        tips.length
          ? `<div class="brief-tips bare">${tips.map((t, i) => `<div class="brief-tip"><span>${i + 1}</span><p>${esc(t)}</p></div>`).join("")}</div>`
          : ""
      }

      <div class="art-actions">
        <button type="button" class="btn btn-gold btn-block btn-lg" data-action="go-scan">去找找</button>
      </div>
      `,
    );

    root.querySelector('[data-action="go-scan"]').onclick = () => {
      goFx(`/missions/${routeId}/chapters/${chapterId}/clue`, { effect: "fade", duration: 680 });
    };
  }

  /* ========== Clue + Scan ========== */
  function renderClue(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const mission = S().getActiveMission();
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;

    if (!mission || !chapter || !session) {
      root.innerHTML = shell(
        { title: "找一找", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("站点不可用", `#/missions/${routeId}/map`),
      );
      return;
    }

    const art = chapter.artifact;
    const prog = session.chapterProgress[chapterId] || {};

    if (prog.recognized && !prog.videoWatched) {
      root.innerHTML = shell(
        { title: "找一找", showBack: true, backTo: `#/missions/${routeId}/chapters/${chapterId}/brief`, kicker: "" },
        `
        <div class="scan-hud success lock-burst" id="scan-stage">
          <div class="viewport"><div class="placeholder" style="color:var(--ok)">${icon("check")}<span class="tiny">已锁定</span></div></div>
          <div class="scan-foot">马上看短片…</div>
        </div>
        `,
      );
      goFx(`/missions/${routeId}/chapters/${chapterId}/video`, { effect: "cinema", duration: 900 });
      return;
    }

    root.innerHTML = shell(
      { title: "找一找", showBack: true, backTo: `#/missions/${routeId}/chapters/${chapterId}/brief`, kicker: "" },
      `
      <p class="scan-caption">
        <strong>${esc(art.title)}</strong>
        <span>${esc(art.location || chapter.targetLocation || "")}</span>
      </p>

      <div class="scan-hud" id="scan-stage">
        <div class="viewport" id="scan-viewport">
          <div class="placeholder">
            ${icon("camera")}
            <span class="tiny">把展品放进框里</span>
          </div>
        </div>
        <div class="scan-reticle" aria-hidden="true">
          <span class="c tl"></span><span class="c tr"></span>
          <span class="c bl"></span><span class="c br"></span>
        </div>
        <div class="scan-beam"></div>
        <div class="scan-lock" aria-hidden="true"></div>
        <div class="scan-foot" id="scan-status">轻轻对准</div>
      </div>

      <input type="file" accept="image/*" capture="environment" class="hidden-file" id="scan-file" />

      <div class="scan-tools" id="scan-tools">
        <button type="button" class="tool" data-action="upload">${icon("camera")}<span>拍照</span></button>
        <button type="button" class="tool" data-action="simulate-scan">${icon("scan")}<span>扫码</span></button>
        <button type="button" class="tool" data-action="simulate-fail">${icon("fail")}<span>失败</span></button>
      </div>
      `,
    );

    const stage = root.querySelector("#scan-stage");
    const viewport = root.querySelector("#scan-viewport");
    const statusText = root.querySelector("#scan-status");
    const tools = root.querySelector("#scan-tools");
    const fileInput = root.querySelector("#scan-file");
    let busy = false;
    let advancing = false;

    async function advanceToVideo() {
      if (advancing) return;
      advancing = true;
      tools?.classList.add("is-away");
      stage.classList.add("lock-burst", "success");
      statusText.textContent = "找到了";
      await Fx()?.wait?.(560);
      await goFx(`/missions/${routeId}/chapters/${chapterId}/video`, { effect: "cinema", duration: 820 });
    }

    function setOk(previewUrl) {
      stage.classList.remove("scanning", "failed");
      stage.classList.add("success");
      if (previewUrl) {
        viewport.innerHTML = `<img class="preview" src="${previewUrl}" alt="" />`;
      } else {
        viewport.innerHTML = `<div class="placeholder" style="color:var(--ok)">${icon("check")}<span class="tiny">已锁定</span></div>`;
      }
      statusText.textContent = "找到了";
      root.querySelectorAll(".tool").forEach((el) => {
        el.disabled = true;
      });
    }

    function runScan({ success, previewUrl, delay = 1400 }) {
      if (busy || prog.recognized || advancing) return;
      busy = true;
      stage.classList.remove("failed", "success", "lock-burst");
      stage.classList.add("scanning");
      statusText.textContent = "看一看…";

      setTimeout(async () => {
        stage.classList.remove("scanning");
        busy = false;
        if (success) {
          S().markRecognized(chapterId);
          prog.recognized = true;
          setOk(previewUrl);
          advanceToVideo();
        } else {
          stage.classList.add("failed");
          statusText.textContent = "再靠近一点试试";
          T().warning("没对上，再试一次");
          setTimeout(() => stage.classList.remove("failed"), 450);
        }
      }, delay);
    }

    root.querySelector('[data-action="upload"]').onclick = () => fileInput.click();
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      viewport.innerHTML = `<img class="preview" src="${url}" alt="" />`;
      runScan({ success: true, previewUrl: url, delay: 1100 });
    });

    root.querySelector('[data-action="simulate-scan"]').onclick = () => {
      viewport.innerHTML = `<div class="placeholder">${icon("scan")}<span class="tiny">扫码中</span></div>`;
      runScan({ success: true, delay: 1200 });
    };

    root.querySelector('[data-action="simulate-fail"]').onclick = () => runScan({ success: false, delay: 900 });
  }

  /* ========== Video — 融入展厅背景的软影院 ========== */
  function renderVideo(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;
    const prog = session?.chapterProgress?.[chapterId];

    if (!chapter || !session) {
      root.innerHTML = shell(
        { title: "短片", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("短片不可用", `#/missions/${routeId}/map`),
      );
      return;
    }

    if (!prog?.recognized) {
      R().replace(`/missions/${routeId}/chapters/${chapterId}/brief`);
      return;
    }

    if (prog.videoWatched && !prog.solved) {
      goFx(`/missions/${routeId}/chapters/${chapterId}/puzzle`, {
        effect: "fade",
        duration: 700,
      });
      return;
    }

    const enter = Fx()?.consumeEnterFx?.();
    root.innerHTML = `
      <div class="shell film-page${enter ? ` enter-${enter}` : ""}">
        <header class="film-top">
          <button type="button" class="film-icon" data-action="back" aria-label="返回">${icon("back")}</button>
          <div class="film-top-meta">
            <p class="top-kicker">观展短片</p>
            <h1 class="film-heading">${esc(chapter.title)}</h1>
          </div>
          <button type="button" class="film-skip" data-action="skip">跳过</button>
        </header>

        <div class="film-ambient" id="video-stage">
          <div class="film-bloom" aria-hidden="true"></div>
          <div class="film-bloom film-bloom-b" aria-hidden="true"></div>
          <div class="film-stage">
            <div class="film-soft-edge">
              <video id="chapter-video" playsinline webkit-playsinline preload="auto" src="${esc(chapter.video?.src || "./assets/movie.mp4")}"></video>
            </div>
            <div class="film-veil" id="video-overlay">
              <button type="button" class="play-orb" data-action="play" aria-label="播放">${icon("play")}</button>
            </div>
            <div class="film-sweep" aria-hidden="true"></div>
            <div class="film-progress"><span id="video-progress"></span></div>
          </div>
          <p class="film-status" id="cinema-status">即将播放</p>
        </div>
      </div>
    `;

    const video = root.querySelector("#chapter-video");
    const overlay = root.querySelector("#video-overlay");
    const progressBar = root.querySelector("#video-progress");
    const status = root.querySelector("#cinema-status");
    const stage = root.querySelector("#video-stage");
    let unlocked = Boolean(prog.videoWatched);
    let finishing = false;

    function unlock() {
      if (unlocked) return;
      unlocked = true;
      S().markVideoWatched(chapterId);
      status.textContent = "可以闯关了";
    }

    async function toPuzzle() {
      if (finishing) return;
      finishing = true;
      unlock();
      window.DemoStars?.setPlaying?.(false);
      stage?.classList.add("film-out");
      await Fx()?.wait?.(420);
      await goFx(`/missions/${routeId}/chapters/${chapterId}/puzzle`, {
        effect: "fade",
        duration: 780,
      });
    }

    function markPlaying(on) {
      window.DemoStars?.setPlaying?.(on);
    }

    async function tryAutoplay() {
      stage?.classList.add("film-in");
      try {
        video.muted = false;
        await video.play();
        overlay.classList.add("playing");
        status.textContent = "播放中";
        markPlaying(true);
        return;
      } catch {
        /* fallthrough */
      }
      try {
        video.muted = true;
        await video.play();
        overlay.classList.add("playing");
        status.textContent = "播放中 · 轻触开声";
        markPlaying(true);
        const unmute = () => {
          video.muted = false;
          status.textContent = "播放中";
          stage.removeEventListener("pointerdown", unmute);
        };
        stage.addEventListener("pointerdown", unmute, { once: true });
      } catch {
        status.textContent = "轻触播放";
        markPlaying(false);
      }
    }

    root.querySelector('[data-action="play"]').onclick = async () => {
      try {
        video.muted = false;
        await video.play();
        overlay.classList.add("playing");
        status.textContent = "播放中";
        markPlaying(true);
      } catch {
        T().warning("点一下画面播放");
      }
    };

    overlay.addEventListener("click", async (e) => {
      if (e.target.closest("[data-action]")) return;
      if (video.paused) {
        video.muted = false;
        await video.play().catch(() => {});
        overlay.classList.add("playing");
        status.textContent = "播放中";
        markPlaying(true);
      } else {
        video.pause();
        overlay.classList.remove("playing");
        status.textContent = "已暂停";
        markPlaying(false);
      }
    });

    video.addEventListener("timeupdate", () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      progressBar.style.width = `${pct}%`;
      if (pct >= 55) unlock();
    });

    video.addEventListener("ended", async () => {
      overlay.classList.remove("playing");
      markPlaying(false);
      unlock();
      status.textContent = "看完了";
      await Fx()?.wait?.(500);
      toPuzzle();
    });

    video.addEventListener("pause", () => {
      if (!video.ended) markPlaying(false);
    });
    video.addEventListener("play", () => markPlaying(true));

    root.querySelector('[data-action="skip"]').onclick = () => {
      markPlaying(false);
      toPuzzle();
    };
    root.querySelector('[data-action="back"]').onclick = () => {
      markPlaying(false);
      goFx(`/missions/${routeId}/map`, { effect: "fade", duration: 560 });
    };

    requestAnimationFrame(() => tryAutoplay());
  }

  /* ========== Puzzle ========== */
  function renderPuzzle(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;
    const prog = session?.chapterProgress?.[chapterId];

    if (!chapter || !session) {
      root.innerHTML = shell(
        { title: "挑战", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("题目不可用", `#/missions/${routeId}/map`),
      );
      return;
    }

    if (!prog?.recognized) {
      R().replace(`/missions/${routeId}/chapters/${chapterId}/brief`);
      return;
    }
    if (!prog?.videoWatched) {
      R().replace(`/missions/${routeId}/chapters/${chapterId}/video`);
      return;
    }

    const typeLabel = chapter.puzzle.type === "jigsaw" ? "拼图" : "选择";
    const solved = Boolean(prog.solved);

    root.innerHTML = shell(
      { title: "闯关", showBack: true, backTo: `#/missions/${routeId}/map`, kicker: "" },
      `
      <div class="hud-row">
        <span class="tag gold">${typeLabel}</span>
        <span class="score">+${chapter.puzzle.score || 0}</span>
      </div>
      <h2 class="display" style="font-size:1.2rem;line-height:1.35">${esc(chapter.puzzle.prompt)}</h2>

      <div class="panel puzzle-panel">
        <div class="panel-body" id="puzzle-host" style="padding:0.75rem"></div>
      </div>

      <div id="hint-box" class="hint-pill"></div>

      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-action="hint" ${solved || prog.usedHint ? "disabled" : ""}>
          ${prog.usedHint ? "已用提示" : "提示"}
        </button>
        <button type="button" class="btn btn-gold" data-action="submit" ${solved ? "disabled" : ""}>
          ${solved ? "已通过" : "提交"}
        </button>
      </div>
      `,
    );

    const host = root.querySelector("#puzzle-host");
    const api = window.DemoPuzzles.mount(host, chapter.puzzle, { solved });

    if (prog.usedHint && chapter.puzzle.hint) {
      const box = root.querySelector("#hint-box");
      box.classList.add("show");
      box.textContent = chapter.puzzle.hint;
    }

    root.querySelector('[data-action="hint"]').onclick = () => {
      const text = S().useHint(chapterId);
      if (!text) {
        T().warning("没有提示了");
        return;
      }
      const box = root.querySelector("#hint-box");
      box.classList.add("show");
      box.textContent = text;
      root.querySelector('[data-action="hint"]').disabled = true;
      root.querySelector('[data-action="hint"]').textContent = "已用提示";
    };

    root.querySelector('[data-action="submit"]').onclick = async () => {
      if (solved) return;
      if (!api) {
        T().error("题目异常");
        return;
      }
      if (chapter.puzzle.type === "choice" && !api.getValue()) {
        T().warning("先选一个");
        return;
      }

      const correct = api.isCorrect();
      const result = S().submitAnswer(chapterId, correct);

      if (!result.isCorrect) {
        root.querySelector(".puzzle-panel")?.classList.add("shake-wrong");
        setTimeout(() => root.querySelector(".puzzle-panel")?.classList.remove("shake-wrong"), 420);
        T().warning("再想想");
        return;
      }

      // 过关：金闪 + 分数，直接进结果/终局，去掉二次确认弹窗
      const score = result.score || chapter.puzzle.score || 0;
      root.querySelector(".shell")?.classList.add("win-glow");
      await goFx(
        result.finalChapter
          ? `/missions/${routeId}/finale`
          : `/missions/${routeId}/chapters/${chapterId}/result`,
        {
          effect: "win",
          score,
          duration: 1000,
        },
      );
    };
  }

  function openDialog({ title, message, confirmText, onConfirm }) {
    // 保留兜底弹层；主流程已改为动画衔接
    const overlay = document.getElementById("overlay-root");
    overlay.className = "overlay-root open";
    overlay.innerHTML = `
      <div class="overlay-mask" data-close></div>
      <div class="dialog">
        <h3 class="display" style="font-size:1.35rem">${esc(title)}</h3>
        <p class="sub mt-1">${esc(message)}</p>
        <button type="button" class="btn btn-gold btn-block btn-lg mt-3" data-confirm>${esc(confirmText || "好")}</button>
      </div>
    `;
    const close = () => {
      overlay.className = "overlay-root";
      overlay.innerHTML = "";
    };
    overlay.querySelector("[data-close]").onclick = close;
    overlay.querySelector("[data-confirm]").onclick = () => {
      close();
      onConfirm?.();
    };
  }

  /* ========== Chapter Result ========== */
  function renderChapterResult(root, routeId, chapterId) {
    const session = S().get().activeSession;
    const result = session?.latestChapterResult;

    if (!session || session.routeId !== routeId || !result) {
      root.innerHTML = shell(
        { title: "结果", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("还没有结果", `#/missions/${routeId}/map`, "返回"),
      );
      return;
    }

    root.innerHTML = shell(
      { title: "结果", showBack: true, backTo: `#/missions/${routeId}/map`, kicker: "本站" },
      `
      <div class="panel result-hero">
        <div class="score-burst">
          <div class="medal">${icon("check")}</div>
          <div class="score-num">+${result.gainedScore}</div>
          <h2 class="display mt-2" style="font-size:1.25rem">${esc(result.chapterTitle)}</h2>
          <p class="tiny mt-1">总分 ${session.totalScore}</p>
          <p class="tiny mt-2" id="auto-next-hint">一会儿回路线…</p>
        </div>
        <div class="panel-body stack" style="padding-top:0">
          <button type="button" class="btn btn-gold btn-block btn-lg" data-action="map">回路线</button>
        </div>
      </div>
      `,
    );

    let cancelled = false;

    async function backToMap() {
      if (cancelled) return;
      cancelled = true;
      S().advanceFromResult();
      if (S().isAllSolved()) {
        await goFx(`/missions/${routeId}/finale`, { effect: "win", duration: 1000 });
        return;
      }
      // 完成一站后回到路线列表，不自动开下一站扫描
      await goFx(`/missions/${routeId}/map`, { effect: "fade", duration: 720 });
    }

    root.querySelector('[data-action="map"]').onclick = () => backToMap();

    setTimeout(() => {
      if (!cancelled) backToMap();
    }, Fx()?.reduce?.() ? 350 : 1800);
  }

  /* ========== Finale ========== */
  function renderFinale(root, routeId) {
    ensureSession(routeId);
    const mission = S().getActiveMission() || D().getMission(routeId);
    const session = S().get().activeSession;

    if (!mission || !session || session.routeId !== routeId) {
      root.innerHTML = shell(
        { title: "完成", showBack: true, backTo: `#/missions/${routeId}/map` },
        empty("数据不可用", `#/missions/${routeId}/map`),
      );
      return;
    }

    root.innerHTML = shell(
      { title: "完成", showBack: true, backTo: `#/missions/${routeId}/map`, kicker: "通关" },
      `
      <div class="panel">
        <div class="score-burst">
          <div class="medal">${icon("badge")}</div>
          <p class="tag gold">徽章</p>
          <h2 class="display mt-2" style="font-size:1.45rem">${esc(mission.rewardTitle || "探索完成")}</h2>
          <div class="score-num mt-2">${session.totalScore}</div>
          <p class="tiny mt-1">总分</p>
        </div>
        <div class="panel-body stack" style="padding-top:0">
          <div class="stat-grid">
            <div class="stat"><b>${session.solvedChapterIds.length}</b><span>完成</span></div>
            <div class="stat"><b>${mission.chapterCount}</b><span>总站</span></div>
            <div class="stat"><b>${esc(mission.difficultyLabel)}</b><span>难度</span></div>
          </div>
          <button type="button" class="btn btn-gold btn-block btn-lg" data-action="archive">查看收藏</button>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-action="replay">再玩</button>
            <a class="btn btn-ghost" href="#/shell/hall">展厅</a>
          </div>
        </div>
      </div>
      `,
    );

    root.querySelector('[data-action="archive"]').onclick = () =>
      goFx("/shell/archive", { effect: "fade", duration: 600 });
    root.querySelector('[data-action="replay"]').onclick = () => {
      S().startMission(mission.id);
      goFx(`/missions/${mission.id}/map`, { effect: "fade", duration: 700 });
    };
  }

  function ensureSession(routeId) {
    const session = S().get().activeSession;
    if (session?.routeId === routeId) return session;
    return S().startMission(routeId);
  }

  function selectChapterById(routeId, chapterId) {
    const mission = D().getMission(routeId);
    if (!mission) return;
    const idx = mission.chapters.findIndex((c) => c.id === chapterId);
    if (idx >= 0) S().selectChapter(idx);
  }

  return {
    renderAuth,
    renderHall,
    renderPlaying,
    renderArchive,
    renderTaskDetail,
    renderPrologue,
    renderChapterMap,
    renderBrief,
    renderClue,
    renderVideo,
    renderPuzzle,
    renderChapterResult,
    renderFinale,
    renderAsk,
  };
})();
