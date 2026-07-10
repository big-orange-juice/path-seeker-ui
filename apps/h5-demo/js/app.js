/**
 * App 入口：鉴权守卫 + 路由分发
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
  }, { public: true, title: "登录与注册" });

  Router.add("/shell/hall", "hall", () => {
    if (!requireAuth()) return;
    Pages.renderHall(view());
  }, { title: "任务大厅" });

  Router.add("/shell/playing", "playing", () => {
    if (!requireAuth()) return;
    Pages.renderPlaying(view());
  }, { title: "继续游玩" });

  Router.add("/shell/archive", "archive", () => {
    if (!requireAuth()) return;
    Pages.renderArchive(view());
  }, { title: "完成归档" });

  Router.add("/tasks/:routeId", "task-detail", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderTaskDetail(view(), ctx.params.routeId);
  }, { title: "任务详情" });

  Router.add("/missions/:routeId/prologue", "prologue", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderPrologue(view(), ctx.params.routeId);
  }, { title: "开场剧情" });

  Router.add("/missions/:routeId/map", "map", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderChapterMap(view(), ctx.params.routeId);
  }, { title: "章节地图" });

  Router.add("/missions/:routeId/chapters/:chapterId/clue", "clue", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderClue(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "展品观察" });

  Router.add("/missions/:routeId/chapters/:chapterId/video", "video", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderVideo(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "章节播片" });

  Router.add("/missions/:routeId/chapters/:chapterId/puzzle", "puzzle", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderPuzzle(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "谜题挑战" });

  Router.add("/missions/:routeId/chapters/:chapterId/result", "result", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderChapterResult(view(), ctx.params.routeId, ctx.params.chapterId);
  }, { title: "章节结果" });

  Router.add("/missions/:routeId/finale", "finale", (ctx) => {
    if (!requireAuth()) return;
    Pages.renderFinale(view(), ctx.params.routeId);
  }, { title: "终局结算" });

  Router.add("/", "home", () => {
    Router.replace(Store.get().auth.loggedIn ? "/shell/hall" : "/auth");
  }, { public: true });

  Router.start((ctx, route) => {
    if (!route) {
      Router.replace(Store.get().auth.loggedIn ? "/shell/hall" : "/auth");
      return;
    }
    document.title = `${route.meta?.title || "Path Seeker"} · H5 Demo`;
    window.scrollTo(0, 0);
    route.handler(ctx);
  });
})();
