/**
 * 全局导航 FAB（类 h5-client 岛型）+ 「问」对话层
 * 可在任意页面打开；任务中可附带当前任务/展品上下文
 */
window.DemoChrome = (() => {
  const R = () => window.DemoRouter;
  const S = () => window.DemoStore;
  const D = () => window.DemoData;

  let expanded = false;
  let askOpen = false;
  let askMaximized = false;
  /** @type {{ kind: string, title: string, subtitle: string, routeId?: string, chapterId?: string } | null} */
  let attachment = null;
  /** @type {{ role: 'user'|'bot', text: string }[]} */
  let messages = [];
  let typing = false;

  function path() {
    return (location.hash || "#/").replace(/^#/, "") || "/";
  }

  function onShell() {
    return path().startsWith("/shell/");
  }

  function onMission() {
    return path().startsWith("/missions/");
  }

  function onAuth() {
    return path().startsWith("/auth") || path() === "/";
  }

  function parseMissionCtx() {
    const p = path();
    const m = p.match(/^\/missions\/([^/]+)(?:\/chapters\/([^/]+))?/);
    if (!m) return null;
    return { routeId: decodeURIComponent(m[1]), chapterId: m[2] ? decodeURIComponent(m[2]) : null };
  }

  function buildAttachment() {
    const ctx = parseMissionCtx();
    if (!ctx) {
      const session = S().get().activeSession;
      if (session) {
        const mission = D().getMission(session.routeId);
        return {
          kind: "mission",
          title: session.routeTitle || mission?.title || "当前任务",
          subtitle: "进行中的探索",
          routeId: session.routeId,
        };
      }
      return null;
    }
    const mission = D().getMission(ctx.routeId);
    if (!mission) return null;
    if (ctx.chapterId) {
      const ch = D().getChapter(ctx.routeId, ctx.chapterId);
      const prog = S().get().activeSession?.chapterProgress?.[ctx.chapterId];
      if (ch && prog?.recognized && ch.artifact) {
        return {
          kind: "artifact",
          title: ch.artifact.title,
          subtitle: ch.artifact.location || ch.targetLocation || ch.title,
          routeId: ctx.routeId,
          chapterId: ctx.chapterId,
        };
      }
      if (ch) {
        return {
          kind: "chapter",
          title: ch.title,
          subtitle: ch.targetLocation || mission.title,
          routeId: ctx.routeId,
          chapterId: ctx.chapterId,
        };
      }
    }
    return {
      kind: "mission",
      title: mission.title,
      subtitle: mission.theme || "探索中",
      routeId: ctx.routeId,
    };
  }

  function actions() {
    const p = path();
    if (onAuth()) return [];

    if (onMission()) {
      const ctx = parseMissionCtx();
      const mapPath = ctx ? `#/missions/${ctx.routeId}/map` : "#/shell/playing";
      const resume = S().resolveResumePath() || mapPath;
      const onMap = /\/map$/.test(p);
      return [
        { key: "map", label: "路线", href: mapPath, active: onMap },
        { key: "now", label: "当前", href: resume.startsWith("#") ? resume : `#${resume}`, active: !onMap && p.includes("/chapters/") },
        { key: "hall", label: "展厅", href: "#/shell/hall", active: false },
        { key: "ask", label: "问", href: null, active: askOpen || p.startsWith("/shell/ask") },
      ];
    }

    return [
      { key: "hall", label: "展厅", href: "#/shell/hall", active: p.startsWith("/shell/hall") || p.startsWith("/tasks/") },
      { key: "playing", label: "探索", href: "#/shell/playing", active: p.startsWith("/shell/playing") },
      { key: "archive", label: "收藏", href: "#/shell/archive", active: p.startsWith("/shell/archive") },
      { key: "ask", label: "问", href: null, active: askOpen || p.startsWith("/shell/ask") },
    ];
  }

  function activeAction(list) {
    return list.find((a) => a.active) || list[0] || null;
  }

  function icon(name) {
    const map = {
      hall: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
      playing: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
      archive: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>`,
      ask: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
      map: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
      now: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>`,
      close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
      max: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
      min: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`,
      send: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
      x: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    };
    return map[name] || map.ask;
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function replyFor(userText) {
    const q = userText.trim();
    const att = attachment;
    if (!q) return "你想了解哪一件展品？";

    if (/在哪|位置|怎么走|去哪/.test(q)) {
      if (att?.subtitle) return `可以先去「${att.subtitle}」附近看看。慢慢找，不用着急。`;
      return "打开路线页，选一站，会告诉你大概在哪个展区。";
    }
    if (/是什么|讲讲|介绍|故事|为什么/.test(q)) {
      if (att?.kind === "artifact") {
        return `「${att.title}」值得靠近一点看细节。光线好的时候，纹样会更清楚。你也可以问我纹样、材质或年代。`;
      }
      if (att?.title) return `关于「${att.title}」，你更想听故事、找位置，还是解题小提示？`;
      return "你可以先选一条路线，或者告诉我展品的名字。";
    }
    if (/答案|怎么答|提示|不会|帮我/.test(q)) {
      return "我不直接说答案。你可以先观察形状、纹样和说明牌，卡住时再问我「看哪里」。";
    }
    if (/你好|嗨|hello/i.test(q)) {
      return "你好呀。想找展品、听故事，或问这一站该怎么走，都可以跟我说。";
    }
    if (att?.kind === "artifact") {
      return `我们正聊着「${att.title}」。你可以问它在哪、有什么特别之处，或这一站该注意什么。`;
    }
    if (att?.title) {
      return `当前是「${att.title}」。你想问位置、观察重点，还是展品背后的小故事？`;
    }
    return "可以说得具体一点，比如「青铜鼎在哪」或「联珠纹是什么」。";
  }

  function root() {
    return document.getElementById("chrome-root");
  }

  function render() {
    const el = root();
    if (!el) return;
    const list = actions();
    if (!list.length) {
      el.innerHTML = askOpen ? renderAskLayer(false) : "";
      bind(el);
      document.body.classList.toggle("has-chrome-fab", false);
      document.body.classList.toggle("ask-open", askOpen);
      return;
    }

    const active = activeAction(list);
    const n = list.length;
    document.body.classList.add("has-chrome-fab");
    document.body.classList.toggle("ask-open", askOpen);

    el.innerHTML = `
      <div class="chrome-fab ${expanded ? "is-expanded" : ""}" style="--fab-n:${n}">
        <div class="chrome-island" role="toolbar" aria-label="快捷导航">
          ${
            expanded
              ? `
            <div class="chrome-rail">
              <div class="chrome-indicator" style="--i:${Math.max(0, list.findIndex((a) => a.key === active?.key))}"></div>
              ${list
                .map(
                  (a) => `
                <button type="button" class="chrome-item ${a.key === active?.key ? "is-active" : ""}" data-fab-key="${a.key}" data-href="${esc(a.href || "")}">
                  <span class="chrome-ico">${icon(a.key === "ask" ? "ask" : a.key)}</span>
                  <span class="chrome-lab">${esc(a.label)}</span>
                </button>
              `,
                )
                .join("")}
            </div>
          `
              : `
            <button type="button" class="chrome-collapsed" data-fab-expand>
              <span class="chrome-ico chrome-ico-on">${icon(active?.key === "ask" ? "ask" : active?.key || "hall")}</span>
              <span class="chrome-lab">${esc(active?.label || "导航")}</span>
            </button>
          `
          }
        </div>
      </div>
      ${askOpen ? renderAskLayer(false) : ""}
    `;
    bind(el);
  }

  function renderAskLayer(fullPage) {
    const att = attachment;
    return `
      <div class="ask-layer ${fullPage ? "is-full" : "is-sheet"} ${askOpen || fullPage ? "is-open" : ""}" id="ask-layer">
        ${fullPage ? "" : `<div class="ask-mask" data-ask-close></div>`}
        <div class="ask-panel">
          <header class="ask-head">
            <div>
              <p class="ask-kicker">馆内小助手</p>
              <h2 class="ask-title">问一问</h2>
            </div>
            <div class="ask-head-actions">
              ${
                fullPage
                  ? `<button type="button" class="ask-icon-btn" data-ask-minify title="收起">${icon("min")}</button>`
                  : `<button type="button" class="ask-icon-btn" data-ask-max title="放大">${icon("max")}</button>`
              }
              <button type="button" class="ask-icon-btn" data-ask-close title="关闭">${icon("close")}</button>
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
              <button type="button" class="ask-attach-x" data-ask-detach aria-label="去掉">${icon("x")}</button>
            </div>
          `
              : `
            <div class="ask-attach ask-attach-empty">
              <span>没有附带内容，也可以随便问</span>
            </div>
          `
          }

          <div class="ask-msgs" id="ask-msgs">
            ${
              messages.length
                ? messages
                    .map(
                      (m) => `
              <div class="ask-bubble ${m.role === "user" ? "is-user" : "is-bot"}">${esc(m.text)}</div>
            `,
                    )
                    .join("")
                : `<div class="ask-bubble is-bot">你好。想找展品、听故事，或问这一站怎么走，都可以跟我说。</div>`
            }
            ${typing ? `<div class="ask-bubble is-bot is-typing">…</div>` : ""}
          </div>

          <form class="ask-composer" id="ask-form">
            <input class="ask-input" id="ask-input" placeholder="问问位置、故事或观察重点…" autocomplete="off" />
            <button type="submit" class="ask-send" aria-label="发送">${icon("send")}</button>
          </form>
        </div>
      </div>
    `;
  }

  function bind(el) {
    el.querySelector("[data-fab-expand]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      expanded = true;
      render();
    });

    el.querySelectorAll("[data-fab-key]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.getAttribute("data-fab-key");
        const href = btn.getAttribute("data-href");
        if (key === "ask") {
          openAsk();
          expanded = false;
          render();
          return;
        }
        expanded = false;
        if (href) {
          if (location.hash === href) {
            render();
          } else {
            location.hash = href;
          }
        } else {
          render();
        }
      });
    });

    el.querySelectorAll("[data-ask-close]").forEach((b) => {
      b.addEventListener("click", () => closeAsk());
    });
    el.querySelector("[data-ask-max]")?.addEventListener("click", () => {
      askOpen = false;
      askMaximized = true;
      location.hash = "#/shell/ask";
      render();
    });
    el.querySelector("[data-ask-minify]")?.addEventListener("click", () => {
      // used on full page via pages
    });
    el.querySelector("[data-ask-detach]")?.addEventListener("click", () => {
      attachment = null;
      render();
      if (location.hash === "#/shell/ask") {
        window.DemoPages?.renderAsk?.(document.getElementById("view"));
      }
    });

    const form = el.querySelector("#ask-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = el.querySelector("#ask-input");
      const text = input?.value?.trim();
      if (!text || typing) return;
      input.value = "";
      send(text);
    });

    // collapse fab when tapping outside
    if (expanded) {
      setTimeout(() => {
        const onDoc = (ev) => {
          if (!el.querySelector(".chrome-fab")?.contains(ev.target)) {
            expanded = false;
            document.removeEventListener("pointerdown", onDoc, true);
            render();
          }
        };
        document.addEventListener("pointerdown", onDoc, true);
      }, 0);
    }

    const msgs = el.querySelector("#ask-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function send(text) {
    messages.push({ role: "user", text });
    typing = true;
    render();
    if (location.hash === "#/shell/ask") {
      window.DemoPages?.renderAsk?.(document.getElementById("view"));
    }
    setTimeout(() => {
      messages.push({ role: "bot", text: replyFor(text) });
      typing = false;
      render();
      if (location.hash === "#/shell/ask") {
        window.DemoPages?.renderAsk?.(document.getElementById("view"));
      }
    }, 520 + Math.random() * 480);
  }

  function openAsk(opts = {}) {
    const auto = opts.autoAttach !== false;
    if (auto && !opts.keepAttachment) {
      attachment = buildAttachment();
    }
    if (opts.attachment !== undefined) attachment = opts.attachment;
    askOpen = true;
    expanded = false;
    render();
  }

  function closeAsk() {
    askOpen = false;
    render();
  }

  function openAskFull() {
    attachment = attachment || buildAttachment();
    askOpen = false;
    askMaximized = true;
    location.hash = "#/shell/ask";
  }

  function refresh() {
    if (!askOpen) expanded = false;
    render();
  }

  function getAskState() {
    return { messages, attachment, typing, askOpen };
  }

  function setAttachment(next) {
    attachment = next;
  }

  function clearAttachment() {
    attachment = null;
  }

  function mount() {
    if (!document.getElementById("chrome-root")) {
      const div = document.createElement("div");
      div.id = "chrome-root";
      document.body.appendChild(div);
    }
    window.addEventListener("hashchange", refresh);
    render();
  }

  return {
    mount,
    refresh,
    openAsk,
    closeAsk,
    openAskFull,
    getAskState,
    setAttachment,
    clearAttachment,
    buildAttachment,
    renderAskLayer,
    send,
    get messages() {
      return messages;
    },
    get attachment() {
      return attachment;
    },
    get typing() {
      return typing;
    },
  };
})();
