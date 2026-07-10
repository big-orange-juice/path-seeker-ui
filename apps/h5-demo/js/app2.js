/**
 * App 入口：鉴权守卫 + 路由分发 + 全局 FAB/问
 */
(function bootstrap() {
  const Router = window.DemoRouter;
  const Store = window.DemoStore;
  const Pages = window.DemoPages;
  const view = () => document.getElementById("view");

  function requireAuth() {
    if (!Store.get().auth.loggedIn) {
      Router.replace("/auth");
      return false;
    }
    return true;
  }

  Router.add("/auth", "auth", () => {
    Pages.renderAuth(view());
  }, { public: true, title: "开始" });

  Router.add("/shell/hall", "hall", () => {
    if (!requireAuth()) return;
    Pages.renderHall(view());
  }, { title: "展厅" });

  Router.add("/shell/playing", "playing", () => {
    if (!requireAuth()) return;
    Pages.renderPlaying(view());
  }, { title: "探索" });

  Router.add("/shell/archive", "archive", () => {
    if (!requireAuth()) return;
    Pages.renderArchive(view());
  }, { title: "收藏" });

  Router.add("/shell/ask", "ask", () => {
    if (!requireAuth()) return;
    Pages.renderAsk(view());
  }, { title: "问一问" });

  Router.add("/tasks/:routeId", "task-detail", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderTaskDetail(view(), ctx.params.routeId);
  }, { title: "任务" });

  Router.add("/missions/:routeId/prologue", "prologue", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderPrologue(view(), ctx.params.routeId);
  }, { title: "介绍" });

  Router.add("/missions/:routeId/map", "map", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderChapterMap(view(), ctx.params.routeId);
  }, { title: "路线" });

  Router.add("/missions/:routeId/chapters/:chapterId/brief", "brief", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderBrief(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "线索" });

  Router.add("/missions/:routeId/chapters/:chapterId/clue", "clue", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderClue(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "找一找" });

  Router.add("/missions/:routeId/chapters/:chapterId/video", "video", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderVideo(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "短片" });

  Router.add("/missions/:routeId/chapters/:chapterId/puzzle", "puzzle", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderPuzzle(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "闯关" });

  Router.add("/missions/:routeId/chapters/:chapterId/result", "result", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderChapterResult(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "完成" });

  Router.add("/missions/:routeId/finale", "finale", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderFinale(view(), ctx.params.routeId);
  }, { title: "通关" });

  Router.add("/", "home", () => {
    Router.replace(Store.get().auth.loggedIn ? "/shell/hall" : "/auth");
  }, { public: true });

  Router.start((ctx, route) => {
    if (!route) {
      Router.replace(Store.get().auth.loggedIn ? "/shell/hall" : "/auth");
      return;
    }
    document.title = `${route.meta?.title || "Path Seeker"} · 馆内探索`;
    window.scrollTo(0, 0);
    route.handler(ctx);
    window.DemoChrome?.refresh?.();
  });

  window.DemoChrome?.mount?.();
  window.DemoStars?.mount?.();
})();
