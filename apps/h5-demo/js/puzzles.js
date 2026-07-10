/**
 * 题型渲染：仅 choice（普通选择题）与 jigsaw（拼图）
 */
window.DemoPuzzles = (() => {
  const LETTERS = "ABCDEFGH";

  /** 生成可辨识的伪文物渐变图（data URL），避免外部图片依赖 */
  function buildPaletteDataUrl(palette, size = 360) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const schemes = {
      bronze: {
        base: ["#2a2118", "#5c4630", "#c9a55a", "#8b6914"],
        accent: "#e8d5a3",
      },
      silk: {
        base: ["#1a1530", "#4a3a78", "#c49ad4", "#6b8fd6"],
        accent: "#f0d4ff",
      },
      jade: {
        base: ["#0f1c18", "#1f4a3c", "#6fbf8a", "#2d6b55"],
        accent: "#c8f0d8",
      },
    };

    const s = schemes[palette] || schemes.bronze;
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, s.base[0]);
    g.addColorStop(0.35, s.base[1]);
    g.addColorStop(0.7, s.base[2]);
    g.addColorStop(1, s.base[3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // 纹样装饰
    ctx.strokeStyle = s.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const r = size * (0.12 + i * 0.08);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < size; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 20) {
        ctx.lineTo(x, y + Math.sin(x / 18 + y / 40) * 6);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = s.accent;
    ctx.font = `600 ${Math.floor(size * 0.08)}px "Noto Serif SC", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PATH", size / 2, size / 2 - size * 0.04);
    ctx.globalAlpha = 0.4;
    ctx.font = `500 ${Math.floor(size * 0.045)}px "Noto Sans SC", sans-serif`;
    ctx.fillText("SEEKER", size / 2, size / 2 + size * 0.06);

    return canvas.toDataURL("image/png");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    // 避免开局已完成
    if (a.every((v, i) => v === i) && a.length > 1) {
      [a[0], a[1]] = [a[1], a[0]];
    }
    return a;
  }

  function renderChoice(container, puzzle, { solved = false, selectedId = null, locked = false } = {}) {
    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "choice-list";

    let current = selectedId;

    puzzle.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-option";
      btn.dataset.id = opt.id;
      if (current === opt.id) btn.classList.add("selected");
      if (solved && opt.id === puzzle.answerId) btn.classList.add("correct");
      if (solved && current === opt.id && opt.id !== puzzle.answerId) btn.classList.add("wrong");

      btn.innerHTML = `
        <span class="choice-key">${opt.key || LETTERS[idx]}</span>
        <span class="choice-text">${escapeHtml(opt.text)}</span>
      `;

      if (!solved && !locked) {
        btn.addEventListener("click", () => {
          current = opt.id;
          list.querySelectorAll(".choice-option").forEach((el) => {
            el.classList.toggle("selected", el.dataset.id === current);
          });
          container.dispatchEvent(new CustomEvent("choice-change", { detail: { id: current }, bubbles: true }));
        });
      }

      list.appendChild(btn);
    });

    container.appendChild(list);

    return {
      getValue: () => current,
      isCorrect: () => current === puzzle.answerId,
    };
  }

  function renderJigsaw(container, puzzle, { solved = false } = {}) {
    container.innerHTML = "";
    const grid = Math.max(2, Math.min(4, Number(puzzle.grid) || 3));
    const total = grid * grid;
    const imageUrl = buildPaletteDataUrl(puzzle.palette || "bronze");

    const wrap = document.createElement("div");
    wrap.className = "jigsaw-wrap";

    const board = document.createElement("div");
    board.className = "jigsaw-board";
    board.style.gridTemplateColumns = `repeat(${grid}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${grid}, 1fr)`;

    // order[i] = tileId at slot i；tileId 的正确位置是 tileId
    let order = solved
      ? Array.from({ length: total }, (_, i) => i)
      : shuffle(Array.from({ length: total }, (_, i) => i));

    let dragFrom = null;

    function isComplete() {
      return order.every((v, i) => v === i);
    }

    function paint() {
      board.innerHTML = "";
      order.forEach((tileId, slot) => {
        const tile = document.createElement("div");
        tile.className = "jigsaw-tile";
        tile.dataset.slot = String(slot);
        tile.dataset.tileId = String(tileId);
        tile.draggable = !solved;

        const face = document.createElement("div");
        face.className = "tile-face";
        const row = Math.floor(tileId / grid);
        const col = tileId % grid;
        face.style.setProperty("--cols", String(grid));
        face.style.setProperty("--rows", String(grid));
        face.style.setProperty("--col", String(col));
        face.style.setProperty("--row", String(row));
        face.style.backgroundImage = `url(${imageUrl})`;
        // 精确 background-position
        const x = grid === 1 ? 0 : (col / (grid - 1)) * 100;
        const y = grid === 1 ? 0 : (row / (grid - 1)) * 100;
        face.style.backgroundSize = `${grid * 100}% ${grid * 100}%`;
        face.style.backgroundPosition = `${x}% ${y}%`;

        tile.appendChild(face);

        if (!solved) {
          // Pointer-based swap for mobile
          tile.addEventListener("pointerdown", (e) => {
            if (solved) return;
            dragFrom = slot;
            tile.classList.add("dragging");
            tile.setPointerCapture(e.pointerId);
          });

          tile.addEventListener("pointerup", (e) => {
            tile.classList.remove("dragging");
            board.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const target = el?.closest?.(".jigsaw-tile");
            if (target && dragFrom !== null) {
              const to = Number(target.dataset.slot);
              if (!Number.isNaN(to) && to !== dragFrom) {
                const tmp = order[dragFrom];
                order[dragFrom] = order[to];
                order[to] = tmp;
                paint();
                emit();
              }
            }
            dragFrom = null;
          });

          tile.addEventListener("pointerenter", () => {
            if (dragFrom !== null && dragFrom !== slot) {
              tile.classList.add("drop-target");
            }
          });

          tile.addEventListener("pointerleave", () => {
            tile.classList.remove("drop-target");
          });
        }

        board.appendChild(tile);
      });
    }

    function emit() {
      container.dispatchEvent(
        new CustomEvent("jigsaw-change", {
          detail: { complete: isComplete(), order: order.slice() },
          bubbles: true,
        }),
      );
    }

    const hintBar = document.createElement("div");
    hintBar.className = "jigsaw-hint-bar";
    hintBar.innerHTML = `
      <span>拖动方块互换位置完成拼图</span>
      <div class="jigsaw-preview" style="background-image:url(${imageUrl})" title="参考图"></div>
    `;

    wrap.appendChild(board);
    wrap.appendChild(hintBar);
    container.appendChild(wrap);
    paint();

    return {
      getValue: () => order.slice(),
      isCorrect: () => isComplete(),
    };
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mount(container, puzzle, options = {}) {
    if (!container || !puzzle) return null;
    if (puzzle.type === "choice") return renderChoice(container, puzzle, options);
    if (puzzle.type === "jigsaw") return renderJigsaw(container, puzzle, options);
    container.innerHTML = `<p class="copy">暂不支持的题型：${escapeHtml(puzzle.type)}</p>`;
    return null;
  }

  return { mount, buildPaletteDataUrl };
})();
