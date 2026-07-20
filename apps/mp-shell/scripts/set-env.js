/**
 * 将 env/<name>.js 复制为项目根目录的 config.js，供小程序运行时 require。
 * 用法: node scripts/set-env.js development|production
 */
const fs = require("node:fs")
const path = require("node:path")

const envName = process.argv[2] || "development"
const root = path.resolve(__dirname, "..")
const source = path.join(root, "env", `${envName}.js`)
const target = path.join(root, "config.js")

if (!fs.existsSync(source)) {
  console.error(`[mp-shell] unknown env: ${envName}`)
  console.error(`  expected file: env/${envName}.js`)
  process.exit(1)
}

const banner = `/**\n * 当前生效环境配置（由 scripts/set-env.js 生成，勿手改）。\n * 环境: ${envName}\n * 重新切换: pnpm env:dev | pnpm env:prod\n */\n`
const body = fs.readFileSync(source, "utf8")
fs.writeFileSync(target, banner + body, "utf8")

// 同步读出 URL，方便终端确认
// eslint-disable-next-line import/no-dynamic-require
const config = require(target)
console.log(`[mp-shell] env -> ${envName}`)
console.log(`[mp-shell] h5BaseUrl -> ${config.h5BaseUrl}`)
