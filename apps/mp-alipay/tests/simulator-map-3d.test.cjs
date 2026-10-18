const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { patchRuntime, patchArchive, readArchive } = require('../scripts/simulator-map-3d.cjs');

const source = `class MapRuntime {
    drawMap({ data }) {
        const tileOverlay = data.tileOverlay;
        if (data.optimize) {
            this.drawTileOverlay(tileOverlay);
        }
    }
    async invokeAfterMapDraw() {}
}
globalThis.MapRuntime = MapRuntime;`;

test('simulator applies pitch, rotation and buildings, including return to overhead view', () => {
  const context = vm.createContext({});
  vm.runInContext(patchRuntime(source), context);
  const runtime = new context.MapRuntime(), camera = {};
  runtime.drawTileOverlay = () => {};
  runtime.map = { setPitch: value => { camera.pitch = value; }, setRotation: value => { camera.rotation = value; }, setFeatures: value => { camera.features = Array.from(value); } };
  runtime.drawMap({ data: { skew: 50, rotate: 15, 'enable-building': true, optimize: true } });
  assert.deepEqual(camera, { pitch: 50, rotation: 15, features: ['bg', 'road', 'point', 'building'] });
  runtime.drawMap({ data: { skew: 0, rotate: 0, 'enable-building': false } });
  assert.equal(camera.pitch, 0); assert.equal(camera.rotation, 0); assert.equal(camera.features.includes('building'), false);
  runtime.drawMap({ data: { skew: 'invalid' } }); assert.equal(camera.pitch, 0);
  assert.equal(patchRuntime(patchRuntime(source)), patchRuntime(source));
  assert.throws(() => patchRuntime('unsupported runtime'));
});

test('archive patch preserves adjacent files and is idempotent', () => {
  const runtime = Buffer.from(source), before = Buffer.from('before'), after = Buffer.from('after');
  const header = { files: { before: { size: before.length, offset: '0' }, '@ali': { files: { 'lyra-integration-ide': { files: { dist: { files: { ide: { files: { 'runtime.bundle.js': { size: runtime.length, offset: String(before.length) } } } } } } } } }, after: { size: after.length, offset: String(before.length + runtime.length) } } };
  const json = Buffer.from(JSON.stringify(header)), prefix = Buffer.alloc(16 + Math.ceil(json.length / 4) * 4);
  prefix.writeUInt32LE(4, 0); prefix.writeUInt32LE(prefix.length - 8, 4); prefix.writeUInt32LE(prefix.length - 12, 8); prefix.writeUInt32LE(json.length, 12); json.copy(prefix, 16);
  const patched = patchArchive(Buffer.concat([prefix, before, runtime, after]));
  const parsed = readArchive(patched);
  assert.match(parsed.source.toString(), /setPitch/);
  for (const name of ['before', 'after']) {
    const file = parsed.header.files[name], start = parsed.dataOffset + Number(file.offset);
    assert.equal(patched.subarray(start, start + file.size).toString(), name);
  }
  assert.deepEqual(patchArchive(patched), patched);
});
