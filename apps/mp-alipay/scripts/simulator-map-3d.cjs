const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const runtimePath = '@ali/lyra-integration-ide/dist/ide/runtime.bundle.js';
const marker = 'path-seeker-map-camera-v1';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function patchRuntime(source) {
  if (source.includes(marker)) return source;
  const begin = source.indexOf('    drawMap({ data }) {');
  const end = source.indexOf('    async invokeAfterMapDraw(', begin);
  if (begin < 0 || end < 0) throw Error('Unsupported simulator runtime: drawMap boundary missing');
  const section = source.slice(begin, end);
  const anchor = '            this.drawTileOverlay(tileOverlay);\n        }\n    }';
  if (section.split(anchor).length !== 2) throw Error('Unsupported simulator runtime: map update anchor changed');
  const insertion = `            this.drawTileOverlay(tileOverlay);
        }
        // ${marker}
        if (data.skew !== undefined && Number.isFinite(Number(data.skew))) {
            this.map.setPitch(Math.max(0, Math.min(60, Number(data.skew))));
        }
        if (data.rotate !== undefined && Number.isFinite(Number(data.rotate))) {
            this.map.setRotation(Number(data.rotate));
        }
        const buildings = data['enable-building'];
        if (buildings !== undefined) {
            this.map.setFeatures(buildings ? ['bg', 'road', 'point', 'building'] : ['bg', 'road', 'point']);
        }
    }`;
  const patched = source.slice(0, begin) + section.replace(anchor, insertion) + source.slice(end);
  new vm.Script(patched);
  return patched;
}

function readArchive(buffer) {
  const header = JSON.parse(buffer.subarray(16, 16 + buffer.readUInt32LE(12)).toString());
  const dataOffset = 8 + buffer.readUInt32LE(4);
  let entry = header;
  for (const part of runtimePath.split('/')) entry = entry.files[part];
  const offset = dataOffset + Number(entry.offset);
  return { header, entry, dataOffset, source: buffer.subarray(offset, offset + entry.size) };
}

function patchArchive(buffer) {
  const { header, entry, dataOffset, source } = readArchive(buffer);
  const patched = Buffer.from(patchRuntime(source.toString()));
  if (source.equals(patched)) return buffer;
  if (entry.integrity && entry.integrity.hash !== digest(source)) throw Error('Original runtime integrity mismatch');
  const oldSize = entry.size, oldOffset = Number(entry.offset), delta = patched.length - oldSize;
  function shift(node) {
    if (node.files) Object.values(node.files).forEach(shift);
    else if (!node.unpacked && node.offset !== undefined && Number(node.offset) > oldOffset) node.offset = String(Number(node.offset) + delta);
  }
  shift(header);
  entry.size = patched.length;
  if (entry.integrity) {
    const blockSize = entry.integrity.blockSize;
    if (!(blockSize > 0)) throw Error('Unsupported integrity block size');
    entry.integrity.hash = digest(patched);
    entry.integrity.blocks = [];
    for (let i = 0; i < patched.length; i += blockSize) entry.integrity.blocks.push(digest(patched.subarray(i, i + blockSize)));
  }
  const json = Buffer.from(JSON.stringify(header));
  const headerSize = 8 + Math.ceil(json.length / 4) * 4;
  const prefix = Buffer.alloc(8 + headerSize);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerSize, 4);
  prefix.writeUInt32LE(headerSize - 4, 8);
  prefix.writeUInt32LE(json.length, 12);
  json.copy(prefix, 16);
  const offset = dataOffset + oldOffset;
  return Buffer.concat([prefix, buffer.subarray(dataOffset, offset), patched, buffer.subarray(offset + oldSize)]);
}

function main(args) {
  const [mode, input, output] = args;
  if (mode !== 'restore') throw Error('Simulator patch withdrawn after an interaction regression; only restore is allowed');
  if (!['prepare', 'install', 'restore'].includes(mode) || !input) throw Error('Usage: simulator-map-3d.cjs prepare <modules.asar> <output.asar> | install <modules.asar> <prepared.asar> | restore <modules.asar>');
  const backup = input + '.path-seeker-3d-backup';
  if (mode === 'prepare') {
    if (!output || path.resolve(input) === path.resolve(output)) throw Error('Preparation must use a separate output');
    const original = fs.readFileSync(input), patched = patchArchive(original);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, patched);
    fs.writeFileSync(output + '.json', JSON.stringify({ original: digest(original), patched: digest(patched) }, null, 2));
    console.log('Prepared simulator patch:', output);
  } else if (mode === 'install') {
    const original = fs.readFileSync(input), patched = fs.readFileSync(output);
    const hashes = JSON.parse(fs.readFileSync(output + '.json'));
    if (digest(original) === hashes.patched) return console.log('Simulator patch already installed');
    if (digest(original) !== hashes.original || digest(patched) !== hashes.patched) throw Error('Archive changed; prepare again before installing');
    if (fs.existsSync(backup) && digest(fs.readFileSync(backup)) !== hashes.original) throw Error('An unrelated backup exists; refusing to overwrite');
    if (!fs.existsSync(backup)) fs.copyFileSync(input, backup, fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(output, input);
    console.log('Installed; restart the developer tool. Backup:', backup);
  } else {
    const original = fs.readFileSync(backup), current = fs.readFileSync(input);
    if (digest(current) === digest(original)) return console.log('Simulator archive is already restored');
    if (digest(current) !== digest(patchArchive(original))) throw Error('Installed archive changed; refusing to overwrite');
    fs.copyFileSync(backup, input);
    console.log('Restored simulator archive; restart the developer tool');
  }
}

module.exports = { patchRuntime, patchArchive, readArchive };
if (require.main === module) main(process.argv.slice(2));
