/**
 * 统一状态：auth / mission session / filters / archive
 * 全部落在 localStorage，纯 demo 无后端。
 */
window.DemoStore = (() => {
  const KEY = "path-seeker-h5-demo-v1";

  const defaultState = () => ({
    auth: {
      loggedIn: false,
      displayName: "",
      isGuest: false,
    },
    filters: {
      ageBand: "all",
      difficulty: "all",
    },
    activeSession: null,
    /**
     * activeSession shape:
     * {
     *   routeId, routeTitle, status: 'in_progress'|'completed',
     *   currentChapterIndex, solvedChapterIds: [],
     *   totalScore, usedHintCount,
     *   chapterProgress: { [chapterId]: { recognized, videoWatched, solved, score, narrative } },
     *   latestChapterResult: null | { chapterId, chapterTitle, gainedScore, narrative },
     *   startedAt, updatedAt
     * }
     */
    archives: [],
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, filters: { ...defaultState().filters, ...(parsed.filters || {}) } };
    } catch {
      return defaultState();
    }
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function get() {
    return state;
  }

  function login({ displayName, isGuest = false }) {
    state.auth = {
      loggedIn: true,
      displayName: displayName || (isGuest ? "游客探索者" : "探索者"),
      isGuest,
    };
    persist();
  }

  function logout() {
    state.auth = { loggedIn: false, displayName: "", isGuest: false };
    persist();
  }

  function setFilters(partial) {
    state.filters = { ...state.filters, ...partial };
    persist();
  }

  function resetFilters() {
    state.filters = { ageBand: "all", difficulty: "all" };
    persist();
  }

  function filteredRoutes() {
    const list = window.DemoData.listMissions();
    return list.filter((m) => {
      if (state.filters.ageBand !== "all" && m.recommendedAgeBand !== state.filters.ageBand) {
        // 宽松：只要推荐年龄匹配即可（详情里仍可选其他年龄档）
        const mission = window.DemoData.getMission(m.id);
        if (!mission.availableAgeBands.includes(state.filters.ageBand)) return false;
      }
      if (state.filters.difficulty !== "all" && m.difficultyLevel !== state.filters.difficulty) return false;
      return true;
    });
  }

  function startMission(routeId) {
    const mission = window.DemoData.getMission(routeId);
    if (!mission) return null;

    const chapterProgress = {};
    mission.chapters.forEach((ch) => {
      chapterProgress[ch.id] = {
        recognized: false,
        videoWatched: false,
        solved: false,
        score: 0,
        narrative: "",
        usedHint: false,
      };
    });

    state.activeSession = {
      routeId: mission.id,
      routeTitle: mission.title,
      status: "in_progress",
      currentChapterIndex: 0,
      solvedChapterIds: [],
      totalScore: 0,
      usedHintCount: 0,
      chapterProgress,
      latestChapterResult: null,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist();
    return state.activeSession;
  }

  function getActiveMission() {
    if (!state.activeSession) return null;
    return window.DemoData.getMission(state.activeSession.routeId);
  }

  function selectChapter(index) {
    if (!state.activeSession) return;
    const mission = getActiveMission();
    if (!mission || index < 0 || index >= mission.chapters.length) return;
    state.activeSession.currentChapterIndex = index;
    state.activeSession.updatedAt = Date.now();
    persist();
  }

  function currentChapter() {
    const mission = getActiveMission();
    if (!mission || !state.activeSession) return null;
    return mission.chapters[state.activeSession.currentChapterIndex] || null;
  }

  function markRecognized(chapterId) {
    if (!state.activeSession?.chapterProgress[chapterId]) return;
    state.activeSession.chapterProgress[chapterId].recognized = true;
    state.activeSession.updatedAt = Date.now();
    persist();
  }

  function markVideoWatched(chapterId) {
    if (!state.activeSession?.chapterProgress[chapterId]) return;
    state.activeSession.chapterProgress[chapterId].videoWatched = true;
    state.activeSession.updatedAt = Date.now();
    persist();
  }

  function useHint(chapterId) {
    if (!state.activeSession?.chapterProgress[chapterId]) return null;
    const prog = state.activeSession.chapterProgress[chapterId];
    if (prog.usedHint) return null;
    prog.usedHint = true;
    state.activeSession.usedHintCount += 1;
    state.activeSession.updatedAt = Date.now();
    persist();
    const chapter = window.DemoData.getChapter(state.activeSession.routeId, chapterId);
    return chapter?.puzzle?.hint || "再仔细观察一次展品细节。";
  }

  function submitAnswer(chapterId, isCorrect) {
    const mission = getActiveMission();
    const chapter = window.DemoData.getChapter(state.activeSession?.routeId, chapterId);
    if (!mission || !chapter || !state.activeSession) {
      return { ok: false, message: "会话无效" };
    }

    const prog = state.activeSession.chapterProgress[chapterId];
    if (prog.solved) {
      return { ok: true, already: true, isCorrect: true, message: "此章节已完成", finalChapter: isAllSolved() };
    }

    if (!isCorrect) {
      return { ok: true, isCorrect: false, message: "答案还差一点，再观察一轮后重试。", finalChapter: false };
    }

    const score = chapter.puzzle.score || 20;
    prog.solved = true;
    prog.score = score;
    prog.narrative = chapter.puzzle.narrative || "";
    if (!state.activeSession.solvedChapterIds.includes(chapterId)) {
      state.activeSession.solvedChapterIds.push(chapterId);
    }
    state.activeSession.totalScore += score;
    state.activeSession.latestChapterResult = {
      chapterId,
      chapterTitle: chapter.title,
      gainedScore: score,
      narrative: prog.narrative,
    };
    state.activeSession.updatedAt = Date.now();

    const finalChapter = isAllSolved();
    if (finalChapter) {
      state.activeSession.status = "completed";
      pushArchive();
    } else {
      // 默认推进到下一未完成章节
      const nextIdx = mission.chapters.findIndex(
        (ch) => !state.activeSession.solvedChapterIds.includes(ch.id),
      );
      if (nextIdx >= 0) {
        state.activeSession.currentChapterIndex = nextIdx;
      }
    }

    persist();
    return {
      ok: true,
      isCorrect: true,
      message: finalChapter ? "全部章节已完成，前往终局结算。" : "章节解锁成功，可继续下一站。",
      finalChapter,
      score,
      narrative: prog.narrative,
    };
  }

  function isAllSolved() {
    const mission = getActiveMission();
    if (!mission || !state.activeSession) return false;
    return mission.chapters.every((ch) => state.activeSession.solvedChapterIds.includes(ch.id));
  }

  function advanceFromResult() {
    if (!state.activeSession) return;
    state.activeSession.latestChapterResult = null;
    state.activeSession.updatedAt = Date.now();
    persist();
  }

  function pushArchive() {
    const mission = getActiveMission();
    if (!mission || !state.activeSession) return;

    const entry = {
      routeId: mission.id,
      routeTitle: mission.title,
      rewardTitle: mission.rewardTitle,
      difficultyLabel: mission.difficultyLabel,
      totalScore: state.activeSession.totalScore,
      solvedCount: state.activeSession.solvedChapterIds.length,
      puzzleCount: mission.chapterCount,
      usedHintCount: state.activeSession.usedHintCount,
      completedAt: Date.now(),
    };

    state.archives = [entry, ...state.archives.filter((a) => a.routeId !== mission.id)];
    persist();
  }

  function clearActiveSession() {
    state.activeSession = null;
    persist();
  }

  function coverageSummary() {
    return {
      missionCount: window.DemoData.listMissions().length,
      archiveCount: state.archives.length,
      hasActiveSession: Boolean(state.activeSession && state.activeSession.status === "in_progress"),
    };
  }

  function resolveResumePath() {
    const session = state.activeSession;
    if (!session) return null;
    if (session.status === "completed") {
      return `#/missions/${session.routeId}/finale`;
    }

    const mission = getActiveMission();
    if (!mission) return `#/tasks/${session.routeId}`;

    const chapter = mission.chapters[session.currentChapterIndex] || mission.chapters[0];
    if (!chapter) return `#/missions/${session.routeId}/map`;

    const prog = session.chapterProgress[chapter.id];
    if (!prog) return `#/missions/${session.routeId}/map`;
    if (!prog.recognized) {
      return `#/missions/${session.routeId}/chapters/${chapter.id}/clue`;
    }
    if (!prog.videoWatched) {
      return `#/missions/${session.routeId}/chapters/${chapter.id}/video`;
    }
    if (!prog.solved) {
      return `#/missions/${session.routeId}/chapters/${chapter.id}/puzzle`;
    }
    return `#/missions/${session.routeId}/map`;
  }

  return {
    get,
    login,
    logout,
    setFilters,
    resetFilters,
    filteredRoutes,
    startMission,
    getActiveMission,
    selectChapter,
    currentChapter,
    markRecognized,
    markVideoWatched,
    useHint,
    submitAnswer,
    isAllSolved,
    advanceFromResult,
    clearActiveSession,
    coverageSummary,
    resolveResumePath,
  };
})();
