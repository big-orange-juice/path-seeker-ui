const config = require("../../config")

/**
 * 将启动参数拼到 H5 URL 上，便于深链：
 * - path: H5 路由路径，如 /auth 或 auth
 * - 其余 query 原样透传
 */
function buildH5Url(query = {}) {
  const base = String(config.h5BaseUrl || "").replace(/\/?$/, "/")
  let path = ""
  const pairs = []

  Object.keys(query).forEach((key) => {
    const value = query[key]
    if (value == null || value === "") return
    if (key === "path") {
      path = decodeURIComponent(String(value))
      return
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })

  const qs = pairs.join("&")

  if (path) {
    if (/^https?:\/\//i.test(path)) {
      return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path
    }
    const normalized = path.replace(/^\//, "")
    return qs ? `${base}${normalized}?${qs}` : `${base}${normalized}`
  }

  return qs ? `${base}?${qs}` : base
}

Page({
  data: {
    // 先给默认地址，避免 onLoad 前 web-view 空白、露出 page 底色
    h5Url: buildH5Url(),
  },

  onLoad(query) {
    const h5Url = buildH5Url(query || {})
    // 开发期在控制台确认实际加载地址
    console.log("[mp-shell] load h5:", h5Url, "env:", config.env)
    if (h5Url !== this.data.h5Url) {
      this.setData({ h5Url })
    }
  },

  onWebViewLoad(e) {
    console.log("[mp-shell] web-view load", e && e.detail)
  },

  onWebViewError(e) {
    console.error("[mp-shell] web-view error", e && e.detail)
    wx.showToast({
      title: "页面加载失败",
      icon: "none",
    })
  },

  /** H5 通过 wx.miniProgram.postMessage 回传的数据（仅在特定时机触发） */
  onMessage(e) {
    console.log("[mp-shell] message from h5", e && e.detail && e.detail.data)
  },
})
