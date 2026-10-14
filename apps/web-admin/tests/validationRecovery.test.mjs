import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(new URL('../package.json', import.meta.url))
const typescript = require('typescript')
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')

function evaluate(path, imports = {}, globals = {}, appended = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const script = source.includes('<script setup')
    ? source.split('<script setup lang="ts">')[1].split('</script>')[0] : source
  const compiled = typescript.transpileModule(script + appended, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const exports = {}
  new Function('require', 'exports', ...Object.keys(globals), compiled.outputText)(
    name => name === 'vue' ? { ...vue, useTemplateRef: () => vue.ref(null), onBeforeUnmount: () => {} } : imports[name] ?? {}, exports, ...Object.values(globals),
  )
  return exports
}

const { buildStageHints } = evaluate('../app/utils/stageHints.ts')
const importTypes = evaluate('../app/types/collection-import.ts')

test('hint saves preserve IDs and unlock metadata across repeated saves and reorder', () => {
  let nextId = 0
  const createId = () => 'new-' + (++nextId)
  const original = [
    { hint_id: 'first', content: '第一条', penalty_score: 3, unlock_mode: 3, media_url: 'image.png' },
    { hint_id: 'second', content: '第二条', penalty_score: 5 },
  ]
  const firstSave = buildStageHints('第二条\n第一条', original, createId)
  const secondSave = buildStageHints('第二条\n第一条', firstSave, createId)
  assert.deepEqual(secondSave, firstSave)
  assert.deepEqual(firstSave.map(hint => hint.hint_id), ['second', 'first'])
  assert.equal(firstSave[1].penalty_score, 3)
  assert.equal(firstSave[1].unlock_mode, 3)
  assert.equal(firstSave[1].media_url, 'image.png')
  assert.equal(nextId, 0)
})

test('editing one hint preserves its ID while newly appended hints get new IDs once', () => {
  let nextId = 0
  const createId = () => 'new-' + (++nextId)
  const saved = buildStageHints('修改后的提示\n新增提示', [{ hint_id: 'original', content: '原提示', penalty_score: 2 }], createId)
  assert.equal(saved[0].hint_id, 'original')
  assert.equal(saved[1].hint_id, 'new-1')
  assert.deepEqual(buildStageHints('修改后的提示\n新增提示', saved, createId), saved)
  assert.equal(nextId, 1)
})

test('deleting a hint preserves the remaining hint ID and metadata', () => {
  const saved = buildStageHints('第二条', [
    { hint_id: 'first', content: '第一条' }, { hint_id: 'second', content: '第二条', penalty_score: 4 },
  ], () => 'unexpected')
  assert.equal(saved[0].hint_id, 'second')
  assert.equal(saved[0].penalty_score, 4)
})

test('saving text hints does not erase existing media-only hints', () => {
  const saved = buildStageHints('文本', [
    { hint_id: 'image', media_url: 'image.png', type: 'image', penalty_score: 4 },
  ], () => 'text')
  assert.equal(saved[1].hint_id, 'image')
  assert.equal(saved[1].media_url, 'image.png')
  assert.equal(saved[1].penalty_score, 4)
  assert.notEqual(saved[0].hint_id, saved[1].hint_id)
})

test('partial jigsaw saves all grid positions and keeps hint IDs on repeated save', async () => {
  const source = readFileSync(new URL('../app/components/routes/StageEditDialog.vue', import.meta.url), 'utf8')
  const script = source.slice(source.indexOf('interface PuzzlePieceConfig'), source.indexOf('const loadGuides ='))
  const compiled = typescript.transpileModule(script + '\nexport { saveRegularStage }', {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  })
  const form = {
    prompt: '', title: '草稿', subtitle: '', imageUrl: '', hintsInput: '提示',
    puzzlePieces: Array.from({ length: 9 }, (_, index) => ({
      id: 'piece-' + index, label: '', hint: '', imageUrl: index === 4 ? 'piece.png' : '',
    })),
  }
  const baseConfig = vue.ref({})
  let generatedHints = 0
  const calls = []
  const dependencies = {
    form, baseConfig, buildStageHints, uuidv4: () => 'hint-' + (++generatedHints),
    puzzleGridRows: vue.ref(3), puzzleGridCols: vue.ref(3),
    isObserveChoice: vue.ref(false), isImagePuzzle: vue.ref(true), isFindScan: vue.ref(false),
    errorMessage: vue.ref(''), ensurePuzzleGridSize: () => {}, syncCorrectOrderFromPieces: () => {},
    stageId: vue.ref('2110099277199052800'), props: { routeId: '2110099277161304064', node: { interactionType: 6 } },
    request: async (path, options) => calls.push({ path, options }),
  }
  const exports = {}
  new Function('exports', ...Object.keys(dependencies), compiled.outputText)(exports, ...Object.values(dependencies))
  assert.equal(await exports.saveRegularStage(), true)
  assert.equal(await exports.saveRegularStage(), true)
  const saved = JSON.parse(calls[0].options.body.config)
  assert.equal(saved.pieces.length, 9)
  assert.equal(saved.pieces[4].correct_row, 1)
  assert.equal(saved.pieces[4].correct_col, 1)
  assert.equal(saved.pieces[4].image_url, 'piece.png')
  assert.equal(saved.pieces[0].image_url, null)
  assert.deepEqual(saved.answer_pieces, saved.pieces.map(piece => piece.key))
  assert.equal(calls[0].options.body.config, calls[1].options.body.config)
  assert.equal(generatedHints, 1)
})

test('failed import rows remain selectable and confirmation keeps large IDs as strings', async () => {
  const batchId = '2110099277161304064'
  const candidateId = '2110099277199052800'
  const calls = []
  const { useCollectionImport } = evaluate('../app/composables/useCollectionImport.ts', {
    '@/types/collection-import': importTypes,
  }, {
    useApiClient: () => ({ request: async (path, options) => {
      calls.push({ path, options })
      if (path.endsWith('/detail')) return { batch: { id: batchId, version: 2 }, sources: [], candidateSummary: {} }
      if (path.endsWith('/candidates')) return { list: [], totalPages: 1, total: 0 }
      return 1
    } }),
  })
  const importer = useCollectionImport()
  importer.batch.value = { id: batchId, version: 2 }
  importer.candidates.value = [{ id: candidateId, status: 4 }, { id: 'committed', status: 3 }]
  importer.toggleAllCandidates(true)
  assert.deepEqual(importer.selectedCandidateIds.value, [candidateId])
  assert.equal(await importer.confirmCandidates(), true)
  const confirmation = calls.find(call => call.path.endsWith('/confirm'))
  assert.equal(confirmation.options.body.batchId, batchId)
  assert.deepEqual(confirmation.options.body.candidateIds, [candidateId])
})

test('reparse mapping uses the newest source without converting large source IDs to numbers', async () => {
  const calls = []
  const { useCollectionImport } = evaluate('../app/composables/useCollectionImport.ts', {
    '@/types/collection-import': importTypes,
  }, {
    useApiClient: () => ({ request: async (path, options) => {
      calls.push({ path, options })
      if (path.endsWith('/detail')) return {
        batch: { id: 'batch', status: 5, version: 3, taskStatus: 5, createCount: 1 },
        sources: [
          { id: '2110099277199052800', attachmentId: 'old', header: {} },
          { id: '2110099277199052801', attachmentId: 'new', header: {} },
        ], candidateSummary: {},
      }
      if (path.endsWith('/candidates')) return { list: [], totalPages: 1, total: 0 }
      return {}
    } }),
  })
  const importer = useCollectionImport()
  importer.batch.value = { id: 'batch' }
  await importer.refreshBatch()
  assert.equal(await importer.reparseMapping(), true)
  assert.equal(calls.find(call => call.path.endsWith('/parse')).options.body.attachmentId, 'new')
})

function composerFixture(limit, references = []) {
  const props = vue.reactive({ disabled: false, sending: false, referencedAttachments: references })
  const maxAttachments = vue.ref(limit)
  const events = []
  const scope = vue.effectScope()
  const model = scope.run(() => evaluate('../app/components/chat/ChatComposer.vue', {
    '@/composables/useChatAttachmentLimits': { useChatAttachmentLimits: () => ({ maxAttachments }) },
  }, {
    defineProps: () => props,
    withDefaults: value => value,
    defineEmits: () => (...args) => events.push(args),
  }, '\nexport { addPastedImages, pendingImages, referenceAttachmentIds, canSubmit, attachmentError, submit, clearPendingImages }'))
  return { ...model, maxAttachments, events, stop: () => { model.clearPendingImages(); scope.stop() } }
}

test('chat accepts six images when backend allows six, instead of the old four-image cap', () => {
  const model = composerFixture(6)
  model.addPastedImages(Array.from({ length: 6 }, (_, index) => new File(['image'], index + '.png', { type: 'image/png' })))
  assert.equal(model.pendingImages.value.length, 6)
  assert.equal(model.canSubmit.value, true)
  model.submit()
  assert.equal(model.events[0][1].images.length, 6)
  model.stop()
})

test('chat preserves all referenced IDs and explains a lower configured limit', () => {
  const references = Array.from({ length: 6 }, (_, index) => ({ attachmentId: '211009927719905280' + index }))
  const model = composerFixture(6, references)
  assert.equal(model.referenceAttachmentIds.value.length, 6)
  assert.equal(model.canSubmit.value, true)
  model.maxAttachments.value = 3
  assert.equal(model.referenceAttachmentIds.value.length, 6)
  assert.equal(model.canSubmit.value, false)
  assert.match(model.attachmentError.value, /3/)
  model.stop()
})

test('unavailable chat limits do not disable an otherwise valid attachment message', () => {
  const model = composerFixture(null)
  model.addPastedImages([new File(['image'], 'image.png', { type: 'image/png' })])
  assert.equal(model.canSubmit.value, true)
  assert.equal(model.attachmentError.value, '')
  model.stop()
})
