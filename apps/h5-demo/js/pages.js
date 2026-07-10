/**
 * 各页面渲染（纯 DOM）
 */
window.DemoPages = (() => {
  const S = () => window.DemoStore;
  const T = () => window.DemoToast;
  const R = () => window.DemoRouter;
  const D = () => window.DemoData;

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    const icons = {
      compass: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
      route: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
      archive: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>`,
      sparkles: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>`,
      camera: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
      scan: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
      play: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>`,
      back: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
      check: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
      medal: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>`,
      empty: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
      user: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    };
    return icons[name] || icons.sparkles;
  }

  function shell({ title, kicker = "Path Seeker Demo", showTabBar = false, activeTab = "hall", showBack = false, backTo = "#/shell/hall", userPill = true }, bodyHtml) {
    const auth = S().get().auth;
    const summary = S().coverageSummary();

    const tabbar = showTabBar
      ? `
      <nav class="tabbar">
        <div class="tabbar-inner">
          <a class="tab-item ${activeTab === "hall" ? "active" : ""}" href="#/shell/hall">${icon("compass")}<span>大厅</span></a>
          <a class="tab-item ${activeTab === "playing" ? "active" : ""}" href="#/shell/playing">${icon("route")}<span>游玩</span></a>
          <a class="tab-item ${activeTab === "archive" ? "active" : ""}" href="#/shell/archive">${icon("archive")}<span>归档</span></a>
        </div>
      </nav>`
      : "";

    const fab =
      showTabBar && summary.hasActiveSession && activeTab === "hall"
        ? `<button type="button" class="fab" data-action="resume-fab"><span class="fab-dot"></span>继续探索</button>`
        : "";

    return `
      <div class="shell page-enter">
        <div class="shell-frame ${showTabBar ? "has-tabbar" : ""}">
          <header class="shell-header">
            <div>
              ${showBack ? `<a class="back-link" href="${esc(backTo)}">${icon("back")} 返回</a>` : ""}
              <p class="shell-kicker">${esc(kicker)}</p>
              <h1 class="shell-title">${esc(title)}</h1>
            </div>
            ${
              userPill
                ? `<a class="user-pill" href="#/auth">${esc(auth.displayName || "登录")}</a>`
                : ""
            }
          </header>
          <main class="shell-main">${bodyHtml}</main>
        </div>
        ${tabbar}
        ${fab}
      </div>
    `;
  }

  function bindShellActions(root) {
    root.querySelector('[data-action="resume-fab"]')?.addEventListener("click", () => {
      const path = S().resolveResumePath();
      if (path) {
        T().info("继续任务", "正在带你回到上次停下来的位置。");
        R().go(path.replace(/^#/, ""));
      }
    });
  }

  /* ========== Auth ========== */
  function renderAuth(root) {
    const auth = S().get().auth;
    if (auth.loggedIn) {
      root.innerHTML = shell(
        { title: "账号", kicker: "Path Seeker Demo", showTabBar: false, userPill: false },
        `
        <div class="card">
          <div class="card-body stack">
            <div class="stack-xs">
              <p class="label-xs gold">当前账号</p>
              <h2 class="h1">${esc(auth.displayName)}</h2>
              <p class="copy">${auth.isGuest ? "游客模式进度仅保存在本机浏览器。" : "Demo 账号状态已保存在本机。"}</p>
            </div>
            <button type="button" class="btn btn-primary btn-block" data-action="go-hall">进入任务大厅</button>
            <button type="button" class="btn btn-outline btn-block" data-action="logout">退出登录</button>
          </div>
        </div>
        `,
      );
      root.querySelector('[data-action="go-hall"]').onclick = () => R().go("/shell/hall");
      root.querySelector('[data-action="logout"]').onclick = () => {
        S().logout();
        T().info("已退出", "登录状态已清空。");
        renderAuth(root);
      };
      return;
    }

    root.innerHTML = `
      <div class="shell page-enter">
        <div class="shell-frame">
          <header class="shell-header">
            <div>
              <p class="shell-kicker">Path Seeker Demo</p>
              <h1 class="shell-title">登录与注册</h1>
            </div>
            <span class="user-pill">Auth</span>
          </header>
          <main class="shell-main stack">
            <div class="auth-hero">
              <div class="auth-seal">${icon("sparkles")}</div>
              <h2 class="h1" style="position:relative;z-index:1">沉浸式馆内探索</h2>
              <p class="copy mt-2" style="position:relative;z-index:1;max-width:20rem">
                选任务、进章节、识别展品、观看播片、完成作答——完整主链路 Demo，无需真实后端。
              </p>
            </div>

            <div class="card">
              <div class="card-body stack">
                <div class="badge-row">
                  <button type="button" class="chip active" data-mode="guest">游客体验</button>
                  <button type="button" class="chip" data-mode="login">账号登录</button>
                </div>

                <div id="auth-panel"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    `;

    const panel = root.querySelector("#auth-panel");
    const chips = root.querySelectorAll("[data-mode]");

    function showMode(mode) {
      chips.forEach((c) => c.classList.toggle("active", c.dataset.mode === mode));
      if (mode === "guest") {
        panel.innerHTML = `
          <p class="copy">一键进入完整任务流。进度会写入本机 localStorage，刷新可恢复。</p>
          <button type="button" class="btn btn-primary btn-block mt-3" id="btn-guest">以游客身份进入</button>
        `;
        panel.querySelector("#btn-guest").onclick = () => {
          S().login({ displayName: "游客探索者", isGuest: true });
          T().success("已进入游客模式", "可以开始体验完整任务流。");
          R().go("/shell/hall");
        };
      } else {
        panel.innerHTML = `
          <div class="stack-sm">
            <div class="field">
              <label>账号</label>
              <input class="input" id="login-account" placeholder="任意昵称即可" autocomplete="username" />
            </div>
            <div class="field">
              <label>密码</label>
              <input class="input" id="login-password" type="password" placeholder="任意 4 位以上" autocomplete="current-password" />
            </div>
            <button type="button" class="btn btn-primary btn-block" id="btn-login">登录并进入</button>
            <p class="copy text-xs center">Demo 不校验真实账号，填写即可进入。</p>
          </div>
        `;
        panel.querySelector("#btn-login").onclick = () => {
          const name = panel.querySelector("#login-account").value.trim() || "探索者";
          const pwd = panel.querySelector("#login-password").value;
          if (pwd.length > 0 && pwd.length < 4) {
            T().warning("密码过短", "请输入至少 4 位，或留空直接进入。");
            return;
          }
          S().login({ displayName: name, isGuest: false });
          T().success("登录成功", `欢迎，${name}。`);
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
    const ageLabel = D().AGE_OPTIONS.find((o) => o.value === filters.ageBand)?.label || "全部年龄";
    const diffLabel = D().DIFFICULTY_OPTIONS.find((o) => o.value === filters.difficulty)?.label || "全部难度";
    const filterTags = [];
    if (filters.ageBand !== "all") filterTags.push(ageLabel);
    if (filters.difficulty !== "all") filterTags.push(diffLabel);

    const cards = routes
      .map(
        (m) => `
      <article class="card">
        <div class="cover-strip theme-${esc(m.coverTheme || "bronze")}">
          <div class="cover-pattern"></div>
        </div>
        <div class="card-body stack-sm">
          <div class="badge-row">
            <span class="badge">${esc(m.theme)}</span>
            <span class="badge muted">${esc(m.recommendedAgeBand)}</span>
            <span class="badge muted">${esc(m.difficultyLabel)}</span>
          </div>
          <h3 class="h1" style="font-size:1.45rem">${esc(m.title)}</h3>
          <p class="copy">${esc(m.summary)}</p>
          <div class="grid-2">
            <div class="metric">
              <div class="metric-label">路线信息</div>
              <div class="metric-value" style="font-size:0.95rem">${m.estimatedMinutes} 分钟 · ${m.chapterCount} 章</div>
            </div>
            <div class="metric">
              <div class="metric-label">奖励</div>
              <div class="metric-value" style="font-size:0.95rem">${esc(m.rewardTitle)}</div>
            </div>
          </div>
          <a class="btn btn-primary btn-block" href="#/tasks/${esc(m.id)}">查看任务详情</a>
        </div>
      </article>
    `,
      )
      .join("");

    root.innerHTML = shell(
      { title: "任务大厅", showTabBar: true, activeTab: "hall" },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="row-between">
            <div class="stack-xs">
              <span class="badge">H5 Demo</span>
              <h2 class="h1" style="font-size:1.4rem">完整主链路已就绪</h2>
              <p class="copy">列表 → 详情 → 章节 → 识别 → 播片 → 作答 → 下一章。沉浸式体验馆内探索节奏。</p>
            </div>
            <div class="shrink-0" style="color:var(--primary);padding:0.7rem;border-radius:999px;border:1px solid var(--primary-border);background:var(--primary-soft);display:flex;align-items:center;justify-content:center">
              ${icon("sparkles")}
            </div>
          </div>
          <div class="grid-3">
            <div class="metric"><div class="metric-label">路线</div><div class="metric-value">${summary.missionCount}</div></div>
            <div class="metric"><div class="metric-label">归档</div><div class="metric-value">${summary.archiveCount}</div></div>
            <div class="metric"><div class="metric-label">继续</div><div class="metric-value" style="font-size:1rem">${summary.hasActiveSession ? "可恢复" : "暂无"}</div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="row-between">
            <div class="stack-xs">
              <h2 class="h2">路线筛选</h2>
              <p class="copy">按年龄档与难度收窄列表，条件会保存在本机。</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" data-action="open-filter">筛选</button>
          </div>
          ${
            filterTags.length
              ? `<div class="badge-row mt-2">${filterTags.map((t) => `<span class="badge muted">${esc(t)}</span>`).join("")}</div>`
              : ""
          }
        </div>
      </div>

      ${cards || `<div class="card"><div class="empty"><div class="empty-icon">${icon("empty")}</div><h3 class="h2">没有匹配路线</h3><p class="copy mt-1">换个筛选条件再试试。</p></div></div>`}
      `,
    );

    bindShellActions(root);

    root.querySelector('[data-action="open-filter"]')?.addEventListener("click", () => {
      openFilterSheet(root, () => renderHall(root));
    });
  }

  function openFilterSheet(root, onApply) {
    const overlay = document.getElementById("overlay-root");
    const filters = S().get().filters;
    overlay.className = "overlay-root open";
    overlay.innerHTML = `
      <div class="overlay-mask" data-close></div>
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h3 class="h2">筛选路线</h3>
        <p class="copy mt-1">按年龄档与难度收窄列表。</p>
        <div class="stack mt-3">
          <div class="field">
            <label>年龄档</label>
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
          <button type="button" class="btn btn-outline btn-block" id="f-reset">重置筛选</button>
          <button type="button" class="btn btn-primary btn-block" id="f-apply">查看结果</button>
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
      body = `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">${icon("route")}</div>
            <h3 class="h2">暂无进行中的任务</h3>
            <p class="copy mt-1">从任务大厅选择一条路线开始探索。</p>
            <a class="btn btn-primary mt-3" href="#/shell/hall">去任务大厅</a>
          </div>
        </div>
      `;
    } else {
      const progress = Math.round((session.solvedChapterIds.length / mission.chapterCount) * 100);
      const timeline = mission.chapters
        .map((ch, index) => {
          const solved = session.solvedChapterIds.includes(ch.id);
          const active = session.currentChapterIndex === index;
          return `
            <button type="button" class="chapter-item ${active ? "active" : ""} ${solved ? "solved" : ""}" data-chapter-index="${index}">
              <div class="chapter-index">${solved ? "✓" : ch.stageNo}</div>
              <div class="flex-1">
                <div class="text-sm" style="font-weight:600">${esc(ch.title)}</div>
                <div class="text-xs muted">${esc(ch.targetLocation)}</div>
              </div>
              <div class="chapter-meta">${active ? "当前" : solved ? "完成" : "待探索"}</div>
            </button>
          `;
        })
        .join("");

      body = `
        <div class="card">
          <div class="card-body stack">
            <div class="row-between">
              <div class="stack-xs">
                <span class="badge">进行中</span>
                <h2 class="h1" style="font-size:1.5rem">${esc(mission.title)}</h2>
                <p class="copy">已完成 ${session.solvedChapterIds.length} / ${mission.chapterCount} · 总分 ${session.totalScore}</p>
              </div>
              <div class="progress-pill">${progress}%</div>
            </div>
            <div class="stack-sm">${timeline}</div>
            <button type="button" class="btn btn-primary btn-block" data-action="continue">继续当前节点</button>
            <button type="button" class="btn btn-outline btn-block" data-action="to-map">打开章节地图</button>
            <button type="button" class="btn btn-ghost btn-block" data-action="clear">清空本地会话</button>
          </div>
        </div>
      `;
    }

    root.innerHTML = shell({ title: "继续游玩", showTabBar: true, activeTab: "playing" }, body);
    bindShellActions(root);

    if (session && mission) {
      root.querySelectorAll("[data-chapter-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.chapterIndex);
          S().selectChapter(idx);
          const ch = mission.chapters[idx];
          T().info("已切换章节", `准备进入 ${ch.title}。`);
          R().go(`/missions/${mission.id}/chapters/${ch.id}/clue`);
        });
      });
      root.querySelector('[data-action="continue"]').onclick = () => {
        const path = S().resolveResumePath();
        T().info("继续任务", "定位到上次节点。");
        R().go(path.replace(/^#/, ""));
      };
      root.querySelector('[data-action="to-map"]').onclick = () => R().go(`/missions/${mission.id}/map`);
      root.querySelector('[data-action="clear"]').onclick = () => {
        S().clearActiveSession();
        T().info("已清空会话", "本地恢复记录已移除。");
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
        <div class="card">
          <div class="card-body stack-sm">
            <div class="row-between">
              <div class="stack-xs">
                <h2 class="h1" style="font-size:1.4rem">${esc(e.routeTitle)}</h2>
                <p class="copy">${esc(e.rewardTitle)} · ${esc(e.difficultyLabel)}</p>
              </div>
              <div class="progress-pill">${e.totalScore} 分</div>
            </div>
            <div class="grid-3">
              <div class="metric"><div class="metric-label">章节</div><div class="metric-value" style="font-size:1rem">${e.solvedCount}/${e.puzzleCount}</div></div>
              <div class="metric"><div class="metric-label">提示</div><div class="metric-value" style="font-size:1rem">${e.usedHintCount} 次</div></div>
              <div class="metric"><div class="metric-label">状态</div><div class="metric-value" style="font-size:1rem">已完成</div></div>
            </div>
          </div>
        </div>
      `,
          )
          .join("")
      : `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">${icon("archive")}</div>
            <h3 class="h2">还没有完成归档</h3>
            <p class="copy mt-1">完成一条任务路线后，记录会沉淀在这里。</p>
            <a class="btn btn-primary mt-3" href="#/shell/hall">去任务大厅</a>
          </div>
        </div>
      `;

    root.innerHTML = shell({ title: "完成归档", showTabBar: true, activeTab: "archive" }, body);
    bindShellActions(root);
  }

  /* ========== Task Detail ========== */
  function renderTaskDetail(root, routeId) {
    const mission = D().getMission(routeId);
    if (!mission) {
      root.innerHTML = shell(
        { title: "任务详情", showBack: true, backTo: "#/shell/hall" },
        emptyCard("任务不可用", "找不到该路线。", "#/shell/hall", "返回大厅"),
      );
      return;
    }

    const session = S().get().activeSession;
    const canResume = session && session.routeId === mission.id && session.status === "in_progress";

    const chapters = mission.chapters
      .map(
        (ch) => `
      <div class="chapter-item" style="cursor:default">
        <div class="chapter-index" style="background:var(--primary-soft);color:var(--primary)">${ch.stageNo}</div>
        <div class="flex-1">
          <div class="text-sm" style="font-weight:600">${esc(ch.title)}</div>
          <div class="text-xs muted">${esc(ch.targetLocation)}</div>
        </div>
        <div class="chapter-meta">${ch.puzzle.type === "jigsaw" ? "拼图" : "选择题"}</div>
      </div>
    `,
      )
      .join("");

    root.innerHTML = shell(
      { title: "任务详情", showBack: true, backTo: "#/shell/hall", kicker: "Path Seeker Demo" },
      `
      <div class="card">
        <div class="cover-strip theme-${esc(mission.coverTheme)}"><div class="cover-pattern"></div></div>
        <div class="card-body stack">
          <div class="badge-row">
            <span class="badge">${esc(mission.theme)}</span>
            <span class="badge muted">${esc(mission.recommendedAgeBand)}</span>
            <span class="badge muted">${esc(mission.difficultyLabel)}</span>
          </div>
          <div class="stack-xs">
            <h2 class="h1">${esc(mission.title)}</h2>
            <p class="copy">${esc(mission.summary)}</p>
          </div>
          <div class="badge-row">
            <span class="badge muted">${mission.estimatedMinutes} 分钟</span>
            <span class="badge muted">${mission.chapterCount} 章节</span>
            <span class="badge muted">${esc(mission.rewardTitle)}</span>
          </div>

          <div class="inset">
            <p class="label-xs">奖励</p>
            <p class="text-sm mt-1" style="color:var(--fg)">${esc(mission.rewardTitle)}</p>
          </div>

          <div class="stack-sm">
            <div class="row-between">
              <h3 class="h2">任务节点</h3>
              <span class="text-sm muted">${mission.chapters.length} 站</span>
            </div>
            ${chapters}
          </div>

          ${canResume ? `<button type="button" class="btn btn-primary btn-block" data-action="resume">继续当前任务</button>` : ""}
          <button type="button" class="btn ${canResume ? "btn-outline" : "btn-primary"} btn-block" data-action="start">
            ${canResume ? "重新开始本路线" : "开始任务"}
          </button>
        </div>
      </div>
      `,
    );

    root.querySelector('[data-action="start"]').onclick = () => {
      S().startMission(mission.id);
      T().success("任务已开始", `已进入《${mission.title}》。`);
      if (mission.prologue?.length) {
        R().go(`/missions/${mission.id}/prologue`);
      } else {
        R().go(`/missions/${mission.id}/map`);
      }
    };

    root.querySelector('[data-action="resume"]')?.addEventListener("click", () => {
      const path = S().resolveResumePath();
      T().info("正在恢复进度", "定位到上次节点。");
      R().go(path.replace(/^#/, ""));
    });
  }

  function emptyCard(title, desc, href, actionText) {
    return `
      <div class="card">
        <div class="empty">
          <div class="empty-icon">${icon("empty")}</div>
          <h3 class="h2">${esc(title)}</h3>
          <p class="copy mt-1">${esc(desc)}</p>
          ${href ? `<a class="btn btn-outline mt-3" href="${esc(href)}">${esc(actionText || "返回")}</a>` : ""}
        </div>
      </div>
    `;
  }

  /* ========== Prologue ========== */
  function renderPrologue(root, routeId) {
    ensureSession(routeId);
    const mission = D().getMission(routeId);
    if (!mission) {
      root.innerHTML = shell({ title: "开场剧情", showBack: true }, emptyCard("开场不可用", "请返回任务详情。", `#/tasks/${routeId}`));
      return;
    }

    const beats = (mission.prologue || [])
      .map(
        (b, i) => `
      <div class="beat">
        <span class="beat-index">0${i + 1}</span>
        ${b.eyebrow ? `<p class="label-xs gold">${esc(b.eyebrow)}</p>` : ""}
        ${b.title ? `<h3 class="h2 mt-1">${esc(b.title)}</h3>` : ""}
        ${b.content ? `<p class="copy mt-1">${esc(b.content)}</p>` : ""}
      </div>
    `,
      )
      .join("");

    root.innerHTML = shell(
      { title: "开场剧情", showBack: true, backTo: `#/tasks/${routeId}` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="badge-row">
            <span class="badge">${esc(mission.theme)}</span>
            <span class="badge muted">${esc(mission.recommendedAgeBand)}</span>
          </div>
          <div class="stack-xs">
            <h2 class="h1">${esc(mission.title)}</h2>
            <p class="copy">${esc(mission.summary)}</p>
          </div>
          <div class="stack-sm">${beats}</div>
          <button type="button" class="btn btn-primary btn-block" data-action="enter-map">进入章节地图</button>
        </div>
      </div>
      `,
    );

    root.querySelector('[data-action="enter-map"]').onclick = () => {
      T().info("开场结束", "开始正式探索。");
      R().go(`/missions/${routeId}/map`);
    };
  }

  /* ========== Chapter Map ========== */
  function renderChapterMap(root, routeId) {
    ensureSession(routeId);
    const mission = S().getActiveMission() || D().getMission(routeId);
    const session = S().get().activeSession;

    if (!mission || !session || session.routeId !== routeId) {
      root.innerHTML = shell(
        { title: "章节地图", showBack: true, backTo: `#/tasks/${routeId}` },
        emptyCard("还没有任务会话", "请先从任务详情开始路线。", `#/tasks/${routeId}`, "返回任务详情"),
      );
      return;
    }

    const current = mission.chapters[session.currentChapterIndex];
    const progress = Math.round((session.solvedChapterIds.length / mission.chapterCount) * 100);

    const list = mission.chapters
      .map((ch, index) => {
        const solved = session.solvedChapterIds.includes(ch.id);
        const active = session.currentChapterIndex === index;
        return `
          <button type="button" class="chapter-item ${active ? "active" : ""} ${solved ? "solved" : ""}" data-idx="${index}">
            <div class="chapter-index">${solved ? "✓" : ch.stageNo}</div>
            <div class="flex-1">
              <div class="text-sm" style="font-weight:600">${esc(ch.title)}</div>
              <div class="text-xs muted">${esc(ch.targetLocation)}</div>
            </div>
            <div class="chapter-meta">${active ? "已选" : solved ? "完成" : "待探索"}</div>
          </button>
        `;
      })
      .join("");

    root.innerHTML = shell(
      { title: "章节地图", showBack: true, backTo: `#/tasks/${routeId}` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="row-between">
            <div class="stack-xs">
              <span class="badge">已完成 ${session.solvedChapterIds.length} / ${mission.chapterCount}</span>
              <h2 class="h1">${esc(current?.title || mission.title)}</h2>
              <p class="copy">${esc(current?.targetLocation || "")}</p>
            </div>
            <div class="progress-pill">${progress}%</div>
          </div>

          ${
            current
              ? `<div class="inset">
                  ${current.objective ? `<div class="text-sm" style="font-weight:600;color:var(--fg)">${esc(current.objective)}</div>` : ""}
                  ${current.artifact?.subtitle ? `<div class="copy mt-1">${esc(current.artifact.subtitle)}</div>` : ""}
                  <div class="text-xs muted mt-2">${current.puzzle.type === "jigsaw" ? "拼图" : "普通选择题"}</div>
                </div>`
              : ""
          }

          <div class="stack-sm">
            <div class="row-between">
              <h3 class="h2">章节列表</h3>
              <span class="text-sm muted">${mission.chapterCount} 站 · 可自由选择</span>
            </div>
            ${list}
          </div>

          <button type="button" class="btn btn-primary btn-block" data-action="enter">进入当前章节</button>
          <a class="btn btn-outline btn-block" href="#/tasks/${esc(routeId)}">返回任务详情</a>
        </div>
      </div>
      `,
    );

    root.querySelectorAll("[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        S().selectChapter(Number(btn.dataset.idx));
        renderChapterMap(root, routeId);
      });
    });

    root.querySelector('[data-action="enter"]').onclick = () => {
      const ch = S().currentChapter();
      if (!ch) return;
      R().go(`/missions/${routeId}/chapters/${ch.id}/clue`);
    };
  }

  /* ========== Clue + Recognition ========== */
  function renderClue(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const mission = S().getActiveMission();
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;

    if (!mission || !chapter || !session) {
      root.innerHTML = shell(
        { title: "展品观察", showBack: true, backTo: `#/missions/${routeId}/map` },
        emptyCard("章节不可用", "请返回章节地图。", `#/missions/${routeId}/map`),
      );
      return;
    }

    const art = chapter.artifact;
    const tips = [art.detailCallout, art.observationPoint, art.suspiciousPoint, ...(art.checklist || [])].filter(Boolean);
    const prog = session.chapterProgress[chapterId] || {};

    root.innerHTML = shell(
      { title: "展品观察", showBack: true, backTo: `#/missions/${routeId}/map` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="badge-row">
            <span class="badge">${esc(art.location || chapter.targetLocation)}</span>
            <span class="badge muted">${chapter.puzzle.type === "jigsaw" ? "拼图" : "选择题"}</span>
          </div>
          <div class="stack-xs">
            <h2 class="h1">${esc(art.title)}</h2>
            <p class="copy">${esc(art.subtitle || "")}</p>
          </div>
          ${
            chapter.objective
              ? `<div class="inset"><p class="label-xs">章节目标</p><p class="text-sm mt-1" style="color:var(--fg)">${esc(chapter.objective)}</p></div>`
              : ""
          }
          <div class="stack-sm">
            <h3 class="h2">观察提示</h3>
            ${tips.map((t) => `<div class="inset text-sm muted">${esc(t)}</div>`).join("")}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body stack">
          <div class="stack-xs">
            <p class="label-xs gold">现场识别</p>
            <h3 class="h2">对准展品完成识别</h3>
            <p class="copy">上传现场照片或模拟扫码。Demo 会模拟成功 / 失败分支，失败可重试。</p>
          </div>

          <div class="scan-stage ${prog.recognized ? "success" : ""}" id="scan-stage">
            <div class="scan-viewport" id="scan-viewport">
              <div class="scan-placeholder" id="scan-placeholder">
                ${icon("camera")}
                <p class="text-sm">等待识别画面</p>
              </div>
            </div>
            <div class="scan-frame"></div>
            <div class="scan-line"></div>
            <div class="scan-status">
              <p class="text-sm" id="scan-status-text" style="margin:0;color:var(--fg-soft)">
                ${prog.recognized ? "识别成功 · 可进入播片" : "将展品置于取景框内"}
              </p>
            </div>
          </div>

          <input type="file" accept="image/*" capture="environment" class="hidden-file" id="scan-file" />

          <div class="scan-actions">
            <button type="button" class="btn btn-outline" data-action="upload" ${prog.recognized ? "disabled" : ""}>拍照 / 上传</button>
            <button type="button" class="btn btn-outline" data-action="simulate-scan" ${prog.recognized ? "disabled" : ""}>模拟扫码</button>
          </div>
          <button type="button" class="btn btn-ghost btn-block" data-action="simulate-fail" ${prog.recognized ? "disabled" : ""}>模拟识别失败</button>

          <button type="button" class="btn btn-primary btn-block" data-action="next" ${prog.recognized ? "" : "disabled"}>
            ${prog.recognized ? "进入播片" : "请先完成识别"}
          </button>
          <a class="btn btn-outline btn-block" href="#/missions/${esc(routeId)}/map">返回章节地图</a>
        </div>
      </div>
      `,
    );

    const stage = root.querySelector("#scan-stage");
    const viewport = root.querySelector("#scan-viewport");
    const statusText = root.querySelector("#scan-status-text");
    const fileInput = root.querySelector("#scan-file");
    let busy = false;

    function setRecognizedUI(previewUrl) {
      stage.classList.remove("scanning", "failed");
      stage.classList.add("success");
      if (previewUrl) {
        viewport.innerHTML = `<img class="scan-preview" src="${previewUrl}" alt="识别预览" />`;
      } else {
        viewport.innerHTML = `
          <div class="scan-placeholder" style="color:var(--success)">
            ${icon("check")}
            <p class="text-sm">展品特征已匹配</p>
          </div>
        `;
      }
      statusText.textContent = "识别成功 · 可进入播片";
      root.querySelector('[data-action="upload"]').disabled = true;
      root.querySelector('[data-action="simulate-scan"]').disabled = true;
      root.querySelector('[data-action="simulate-fail"]').disabled = true;
      root.querySelector('[data-action="next"]').disabled = false;
      root.querySelector('[data-action="next"]').textContent = "进入播片";
    }

    function runScan({ success, previewUrl, delay = 1600 }) {
      if (busy || prog.recognized) return;
      busy = true;
      stage.classList.remove("failed", "success");
      stage.classList.add("scanning");
      statusText.textContent = success ? "正在比对馆藏特征…" : "正在识别…";

      setTimeout(() => {
        stage.classList.remove("scanning");
        busy = false;
        if (success) {
          S().markRecognized(chapterId);
          prog.recognized = true;
          setRecognizedUI(previewUrl);
          T().success("识别成功", "展品已确认，可以观看章节短片。");
        } else {
          stage.classList.add("failed");
          statusText.textContent = "识别失败 · 请调整角度后重试";
          T().warning("识别失败", "未匹配到馆藏特征，可重试拍照或扫码。");
          setTimeout(() => stage.classList.remove("failed"), 500);
        }
      }, delay);
    }

    root.querySelector('[data-action="upload"]').onclick = () => fileInput.click();
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      viewport.innerHTML = `<img class="scan-preview" src="${url}" alt="上传预览" />`;
      runScan({ success: true, previewUrl: url, delay: 1400 });
    });

    root.querySelector('[data-action="simulate-scan"]').onclick = () => {
      viewport.innerHTML = `
        <div class="scan-placeholder">
          ${icon("scan")}
          <p class="text-sm">扫码取景中</p>
        </div>
      `;
      runScan({ success: true, delay: 1500 });
    };

    root.querySelector('[data-action="simulate-fail"]').onclick = () => {
      runScan({ success: false, delay: 1200 });
    };

    root.querySelector('[data-action="next"]').onclick = () => {
      if (!S().get().activeSession?.chapterProgress[chapterId]?.recognized) {
        T().warning("尚未识别", "请先完成展品识别。");
        return;
      }
      R().go(`/missions/${routeId}/chapters/${chapterId}/video`);
    };

    if (prog.recognized) {
      setRecognizedUI(null);
    }
  }

  /* ========== Video ========== */
  function renderVideo(root, routeId, chapterId) {
    ensureSession(routeId);
    selectChapterById(routeId, chapterId);
    const chapter = D().getChapter(routeId, chapterId);
    const session = S().get().activeSession;
    const prog = session?.chapterProgress?.[chapterId];

    if (!chapter || !session) {
      root.innerHTML = shell(
        { title: "章节播片", showBack: true, backTo: `#/missions/${routeId}/map` },
        emptyCard("播片不可用", "请返回章节地图。", `#/missions/${routeId}/map`),
      );
      return;
    }

    if (!prog?.recognized) {
      T().warning("请先识别", "需要完成展品识别后再观看播片。");
      R().replace(`/missions/${routeId}/chapters/${chapterId}/clue`);
      return;
    }

    root.innerHTML = shell(
      { title: "章节播片", showBack: true, backTo: `#/missions/${routeId}/chapters/${chapterId}/clue` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="stack-xs">
            <p class="label-xs gold">Cinema</p>
            <h2 class="h1" style="font-size:1.5rem">${esc(chapter.title)}</h2>
            <p class="copy">${esc(chapter.video?.caption || "观看短片，为作答收集关键信息。")}</p>
          </div>

          <div class="video-stage" id="video-stage">
            <video id="chapter-video" playsinline preload="metadata" src="${esc(chapter.video?.src || "./assets/movie.mp4")}"></video>
            <div class="video-overlay" id="video-overlay">
              <button type="button" class="play-btn" data-action="play" aria-label="播放">${icon("play")}</button>
              <p class="text-sm muted" style="margin:0">轻触播放 · 沉浸观看</p>
            </div>
            <div class="video-caption">${esc(chapter.artifact?.title || chapter.title)}</div>
          </div>

          <div class="cinema-bar">
            <div class="cinema-progress"><span id="video-progress"></span></div>
            <span class="text-xs muted" id="video-time">00:00</span>
          </div>

          <div class="inset">
            <p class="label-xs">观看提示</p>
            <p class="text-sm muted mt-1">短片结束后将自动解锁作答入口。也可在观看到一定进度后手动进入。</p>
          </div>

          <button type="button" class="btn btn-primary btn-block" data-action="to-puzzle" ${prog.videoWatched ? "" : "disabled"}>
            ${prog.videoWatched ? "开始作答" : "观看后解锁作答"}
          </button>
          <button type="button" class="btn btn-outline btn-block" data-action="skip">跳过播片（Demo）</button>
        </div>
      </div>
      `,
    );

    const video = root.querySelector("#chapter-video");
    const overlay = root.querySelector("#video-overlay");
    const progressBar = root.querySelector("#video-progress");
    const timeLabel = root.querySelector("#video-time");
    const toPuzzleBtn = root.querySelector('[data-action="to-puzzle"]');

    function unlock() {
      S().markVideoWatched(chapterId);
      toPuzzleBtn.disabled = false;
      toPuzzleBtn.textContent = "开始作答";
    }

    function fmt(t) {
      if (!Number.isFinite(t)) return "00:00";
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    root.querySelector('[data-action="play"]').onclick = async () => {
      try {
        await video.play();
        overlay.classList.add("playing");
      } catch {
        T().warning("无法自动播放", "请点击视频区域手动播放。");
      }
    };

    overlay.addEventListener("click", async (e) => {
      if (e.target.closest("[data-action]")) return;
      if (video.paused) {
        await video.play().catch(() => {});
        overlay.classList.add("playing");
      } else {
        video.pause();
        overlay.classList.remove("playing");
      }
    });

    video.addEventListener("timeupdate", () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      progressBar.style.width = `${pct}%`;
      timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
      if (pct >= 60 && !S().get().activeSession.chapterProgress[chapterId].videoWatched) {
        unlock();
      }
    });

    video.addEventListener("ended", () => {
      overlay.classList.remove("playing");
      unlock();
      T().success("播片结束", "关键信息已收录，可以开始作答。");
    });

    root.querySelector('[data-action="skip"]').onclick = () => {
      unlock();
      T().info("已跳过播片", "Demo 模式下直接进入作答。");
      R().go(`/missions/${routeId}/chapters/${chapterId}/puzzle`);
    };

    root.querySelector('[data-action="to-puzzle"]').onclick = () => {
      if (!S().get().activeSession.chapterProgress[chapterId].videoWatched) {
        T().warning("请先观看播片", "或使用跳过（Demo）。");
        return;
      }
      R().go(`/missions/${routeId}/chapters/${chapterId}/puzzle`);
    };

    if (prog.videoWatched) {
      toPuzzleBtn.disabled = false;
      toPuzzleBtn.textContent = "开始作答";
    }
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
        { title: "谜题挑战", showBack: true, backTo: `#/missions/${routeId}/map` },
        emptyCard("题目不可用", "请返回章节地图。", `#/missions/${routeId}/map`),
      );
      return;
    }

    if (!prog?.recognized) {
      R().replace(`/missions/${routeId}/chapters/${chapterId}/clue`);
      return;
    }
    if (!prog?.videoWatched) {
      R().replace(`/missions/${routeId}/chapters/${chapterId}/video`);
      return;
    }

    const typeLabel = chapter.puzzle.type === "jigsaw" ? "拼图" : "普通选择题";
    const solved = Boolean(prog.solved);

    root.innerHTML = shell(
      { title: "谜题挑战", showBack: true, backTo: `#/missions/${routeId}/chapters/${chapterId}/video` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="stack-xs">
            <p class="label-xs gold">${typeLabel}</p>
            <h2 class="h1" style="font-size:1.45rem">${esc(chapter.puzzle.prompt)}</h2>
          </div>

          <div class="inset" id="puzzle-host" style="padding:0.85rem"></div>

          <div id="hint-box" class="inset" style="display:none">
            <p class="text-sm" style="font-weight:600;margin:0">提示</p>
            <p class="copy mt-1" id="hint-text"></p>
          </div>

          ${
            solved
              ? `<div class="inset"><p class="text-sm" style="font-weight:600;margin:0">此章节已完成</p><p class="copy mt-1">可以查看结果或返回章节地图。</p></div>`
              : ""
          }

          <button type="button" class="btn btn-outline btn-block" data-action="hint" ${solved || prog.usedHint ? "disabled" : ""}>
            ${prog.usedHint ? "提示已使用" : "查看提示"}
          </button>
          <button type="button" class="btn btn-primary btn-block" data-action="submit" ${solved ? "disabled" : ""}>
            ${solved ? "已完成" : "提交答案"}
          </button>
          <a class="btn btn-outline btn-block" href="#/missions/${esc(routeId)}/map">返回章节地图</a>
        </div>
      </div>
      `,
    );

    const host = root.querySelector("#puzzle-host");
    const api = window.DemoPuzzles.mount(host, chapter.puzzle, { solved });

    if (prog.usedHint && chapter.puzzle.hint) {
      const box = root.querySelector("#hint-box");
      box.style.display = "block";
      root.querySelector("#hint-text").textContent = chapter.puzzle.hint;
    }

    root.querySelector('[data-action="hint"]').onclick = () => {
      const text = S().useHint(chapterId);
      if (!text) {
        T().warning("没有更多提示", "先自己再观察一轮。");
        return;
      }
      root.querySelector("#hint-box").style.display = "block";
      root.querySelector("#hint-text").textContent = text;
      root.querySelector('[data-action="hint"]').disabled = true;
      root.querySelector('[data-action="hint"]').textContent = "提示已使用";
      T().info("已解锁提示", text);
    };

    root.querySelector('[data-action="submit"]').onclick = () => {
      if (solved) return;
      if (!api) {
        T().error("题型异常", "无法读取作答状态。");
        return;
      }

      if (chapter.puzzle.type === "choice" && !api.getValue()) {
        T().warning("请选择答案", "先点选一个选项再提交。");
        return;
      }

      const correct = api.isCorrect();
      const result = S().submitAnswer(chapterId, correct);

      if (!result.isCorrect) {
        T().warning("答案未通过", result.message);
        openFeedbackDialog({
          title: "还差一点",
          message: result.message,
          confirmText: "返回修改",
          onConfirm: () => {},
        });
        return;
      }

      T().success(result.finalChapter ? "本路线已完成" : "章节解锁成功", result.message);
      openFeedbackDialog({
        title: "已通过",
        message: result.narrative || result.message,
        confirmText: result.finalChapter ? "查看完成结果" : "前往下一章节",
        onConfirm: () => {
          if (result.finalChapter) {
            R().go(`/missions/${routeId}/finale`);
            return;
          }
          R().go(`/missions/${routeId}/chapters/${chapterId}/result`);
        },
      });
    };
  }

  function openFeedbackDialog({ title, message, confirmText, onConfirm }) {
    const overlay = document.getElementById("overlay-root");
    overlay.className = "overlay-root open";
    overlay.innerHTML = `
      <div class="overlay-mask" data-close></div>
      <div class="dialog">
        <p class="label-xs gold">作答反馈</p>
        <h3 class="h1 mt-1" style="font-size:1.4rem">${esc(title)}</h3>
        <p class="copy mt-2">${esc(message)}</p>
        <button type="button" class="btn btn-primary btn-block mt-3" data-confirm>${esc(confirmText || "确定")}</button>
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
        { title: "章节结果", showBack: true, backTo: `#/missions/${routeId}/map` },
        emptyCard("还没有章节结果", "请先完成当前章节作答。", `#/missions/${routeId}/map`, "返回章节地图"),
      );
      return;
    }

    root.innerHTML = shell(
      { title: "章节结果", showBack: true, backTo: `#/missions/${routeId}/map` },
      `
      <div class="card">
        <div class="card-body stack">
          <div class="score-chip">+${result.gainedScore} 分</div>
          <div class="stack-xs">
            <h2 class="h1">${esc(result.chapterTitle)}</h2>
            <p class="copy">${esc(result.narrative || "本章节已收录。")}</p>
          </div>
          <div class="inset">
            <p class="label-xs">当前总分</p>
            <p class="h1 mt-1" style="font-size:1.6rem">${session.totalScore}</p>
          </div>
          <button type="button" class="btn btn-primary btn-block" data-action="continue">继续任务</button>
          <a class="btn btn-outline btn-block" href="#/missions/${esc(routeId)}/map">返回章节选择</a>
        </div>
      </div>
      `,
    );

    root.querySelector('[data-action="continue"]').onclick = () => {
      S().advanceFromResult();
      if (S().isAllSolved()) {
        R().go(`/missions/${routeId}/finale`);
        return;
      }
      const mission = S().getActiveMission();
      const next = mission?.chapters.find((ch) => !S().get().activeSession.solvedChapterIds.includes(ch.id));
      T().success("章节已收录", "继续前往下一站。");
      if (next) {
        R().go(`/missions/${routeId}/chapters/${next.id}/clue`);
      } else {
        R().go(`/missions/${routeId}/map`);
      }
    };
  }

  /* ========== Finale ========== */
  function renderFinale(root, routeId) {
    ensureSession(routeId);
    const mission = S().getActiveMission() || D().getMission(routeId);
    const session = S().get().activeSession;

    if (!mission || !session || session.routeId !== routeId) {
      root.innerHTML = shell(
        { title: "终局结算", showBack: true, backTo: `#/missions/${routeId}/map` },
        emptyCard("终局数据不可用", "请先完成当前路线。", `#/missions/${routeId}/map`),
      );
      return;
    }

    root.innerHTML = shell(
      { title: "终局结算", showBack: true, backTo: `#/missions/${routeId}/map`, userPill: true },
      `
      <div class="card">
        <div class="finale-glow">
          <div class="finale-medal">${icon("medal")}</div>
          <p class="label-xs gold">${esc(mission.rewardTitle || "探索完成")}</p>
          <h2 class="h1 mt-1">${esc(mission.title)}</h2>
          <p class="copy mt-2" style="max-width:20rem;margin-left:auto;margin-right:auto">${esc(mission.summary)}</p>
        </div>
        <div class="card-body stack" style="padding-top:0">
          <div class="grid-3">
            <div class="metric center"><div class="metric-label">总分</div><div class="metric-value">${session.totalScore}</div></div>
            <div class="metric center"><div class="metric-label">完成</div><div class="metric-value">${session.solvedChapterIds.length}/${mission.chapterCount}</div></div>
            <div class="metric center"><div class="metric-label">难度</div><div class="metric-value" style="font-size:1rem">${esc(mission.difficultyLabel)}</div></div>
          </div>
          <button type="button" class="btn btn-outline btn-block" data-action="archive">查看归档</button>
          <button type="button" class="btn btn-primary btn-block" data-action="replay">重新开始</button>
          <a class="btn btn-ghost btn-block" href="#/shell/hall">返回大厅</a>
        </div>
      </div>
      `,
    );

    root.querySelector('[data-action="archive"]').onclick = () => {
      T().info("已进入归档", "完成记录已沉淀。");
      R().go("/shell/archive");
    };

    root.querySelector('[data-action="replay"]').onclick = () => {
      S().startMission(mission.id);
      T().success("已重新开始", "新的任务会话已创建。");
      R().go(`/missions/${mission.id}/map`);
    };
  }

  /* helpers */
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
    renderClue,
    renderVideo,
    renderPuzzle,
    renderChapterResult,
    renderFinale,
  };
})();
