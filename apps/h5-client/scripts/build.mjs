import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectory = resolve(projectRoot, 'node_modules/.cache/h5-build')

mkdirSync(temporaryDirectory, { recursive: true })

const environment = {
  ...process.env,
  TEMP: temporaryDirectory,
  TMP: temporaryDirectory,
  TMPDIR: temporaryDirectory,
}

const commands = [
  [require.resolve('vue-tsc/bin/vue-tsc.js'), '--noEmit'],
  [resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'build'],
]

for (const command of commands) {
  const result = spawnSync(process.execPath, command, {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
  })
  if (result.error) console.error(result.error)
  if (result.status !== 0) process.exit(result.status ?? 1)
}
