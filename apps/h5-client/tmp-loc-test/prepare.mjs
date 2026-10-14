import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 临时验证脚本（不属于仓库测试）：把 watchLocation.ts 与 tourProgression.ts 里的
 * 包名/路径别名改写成相对路径并补上扩展名，复制到临时目录交给 Node 直接运行，
 * 避免依赖 vite/esbuild（沙箱不允许其子进程）。验证后整目录删除。
 */

const project = resolve(import.meta.dirname, '..')
const target = import.meta.dirname

const watchLocation = readFileSync(resolve(project, 'src/composables/watchLocation.ts'), 'utf8')
  .replace("from '@/utils/tourProgression'", "from './tourProgression.ts'")
writeFileSync(resolve(target, 'watchLocation.rewritten.ts'), watchLocation)

const tourProgression = readFileSync(resolve(project, 'src/utils/tourProgression.ts'), 'utf8')
  .replace("from '@path-seeker/ts-shared'", "from '../../../packages/ts-shared/src/index.ts'")
  .replace("from '@/types/clientCatalog'", "from '../src/types/clientCatalog.ts'")
writeFileSync(resolve(target, 'tourProgression.ts'), tourProgression)

console.log('rewritten watchLocation.ts / tourProgression.ts for direct node run')
