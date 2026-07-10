/**
 * Hash 路由：#/path
 */
window.DemoRouter = (() => {
  const routes = [];
  let current = { path: "/", params: {}, query: {} };
  let onChange = null;

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "") || "/";
    const [pathPart, queryPart = ""] = raw.split("?");
    const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
    const query = {};
    if (queryPart) {
      queryPart.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || "");
      });
    }
    return { path, query };
  }

  function match(path) {
    for (const route of routes) {
      const keys = [];
      const pattern = route.path
        .replace(/\//g, "\\/")
        .replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
          keys.push(key);
          return "([^/]+)";
        });
      const re = new RegExp(`^${pattern}$`);
      const m = path.match(re);
      if (m) {
        const params = {};
        keys.forEach((k, i) => {
          params[k] = decodeURIComponent(m[i + 1]);
        });
        return { route, params };
      }
    }
    return null;
  }

  function resolve() {
    const { path, query } = parseHash();
    const hit = match(path);
    if (!hit) {
      current = { path, params: {}, query, name: null };
      if (onChange) onChange(current, null);
      return;
    }
    current = {
      path,
      params: hit.params,
      query,
      name: hit.route.name,
      meta: hit.route.meta || {},
    };
    if (onChange) onChange(current, hit.route);
  }

  function add(path, name, handler, meta = {}) {
    routes.push({ path, name, handler, meta });
  }

  function start(handler) {
    onChange = handler;
    window.addEventListener("hashchange", resolve);
    if (!location.hash) {
      location.hash = "#/auth";
    } else {
      resolve();
    }
  }

  function go(path) {
    const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
    if (location.hash === next) {
      resolve();
    } else {
      location.hash = next;
    }
  }

  function replace(path) {
    const next = path.startsWith("#") ? path.slice(1) : path.startsWith("/") ? path : `/${path}`;
    const url = `${location.pathname}${location.search}#${next}`;
    history.replaceState(null, "", url);
    resolve();
  }

  function get() {
    return current;
  }

  return { add, start, go, replace, get, resolve };
})();
