const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { deflateSync } = require('node:zlib');
let ts;
try { ts = require('typescript'); } catch (_) { ts = createRequire(path.resolve(__dirname, '../../h5-client/package.json'))('typescript'); }
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '../..');
const src = path.join(root, 'src');
const out = path.join(root, 'dist');
const shared = ['geo', 'geo-range', 'map-coordinates'];
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function compile(source, name) {
  const result = ts.transpileModule(source, {
    fileName: name, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, isolatedModules: true }
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  return result.outputText;
}
function build() {
  fs.mkdirSync(out, { recursive: true });
  for (const file of files(src)) {
    const dest = path.join(out, path.relative(src, file));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!/\.(js|json|axml|acss)$/.test(file)) { fs.copyFileSync(file, dest); continue; }
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) JSON.parse(text);
    fs.writeFileSync(dest, file.endsWith('.js') ? compile(text, file) : text);
  }
  fs.mkdirSync(path.join(out, 'shared'), { recursive: true });
  for (const name of shared) {
    const file = path.join(repo, 'packages/ts-shared/src', name + '.ts');
    fs.writeFileSync(path.join(out, 'shared', name + '.js'), compile(fs.readFileSync(file, 'utf8'), file));
  }
  const messages = path.join(repo, 'apps/h5-client/src/utils/tourMessages.ts');
  fs.writeFileSync(path.join(out, 'shared/tourMessages.js'), compile(fs.readFileSync(messages, 'utf8'), messages));
  const app = JSON.parse(fs.readFileSync(path.join(out, 'app.json'), 'utf8'));
  for (const page of app.pages) for (const ext of ['js', 'json', 'axml', 'acss']) {
    if (!fs.existsSync(path.join(out, page + '.' + ext))) throw Error('缺少页面文件: ' + page + '.' + ext);
  }
  for (const file of files(out).filter(f => f.endsWith('.js'))) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(file), match[1] + '.js'))) throw Error('模块未打包: ' + match[1]);
    }
    if (/\b(window|document|localStorage|navigator)\./.test(content)) throw Error('出现浏览器 API: ' + file);
  }
  for (const page of app.pages) validateTemplate(page);
  const project = JSON.parse(fs.readFileSync(path.join(root, 'mini.project.json'), 'utf8'));
  fs.writeFileSync(path.join(out, 'mini.project.json'), JSON.stringify({ ...project, miniprogramRoot: '.' }, null, 2) + '\n');
  marker();
  console.log('支付宝原生工程构建完成：' + out);
}
function validateTemplate(page) {
  const template = fs.readFileSync(path.join(out, page + '.axml'), 'utf8');
  const js = fs.readFileSync(path.join(out, page + '.js'), 'utf8');
  for (const match of template.matchAll(/\b(?:on|catch)[A-Z]\w*="([\w]+)"/g)) {
    if (!new RegExp('\\b' + match[1] + '\\s*\\(').test(js)) throw Error('模板事件没有处理函数: ' + page + ':' + match[1]);
  }
  const tags = [];
  const nativeTags = new Set(['view', 'text', 'button', 'image', 'input', 'textarea', 'scroll-view', 'picker', 'switch', 'slider', 'checkbox-group', 'checkbox', 'label', 'map', 'video', 'block']);
  for (const match of template.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/g)) {
    if (!nativeTags.has(match[1])) throw Error('不支持的原生组件: ' + page + ':' + match[1]);
    if (match[0].startsWith('</')) { if (tags.pop() !== match[1]) throw Error('模板标签不匹配: ' + page); }
    else if (!match[0].endsWith('/>')) tags.push(match[1]);
  }
  if (tags.length) throw Error('模板标签未关闭: ' + page);
}
// 地图标记随构建生成，无外部图片依赖。
function marker() {
  const width = 26, height = 34, data = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inside = y < 24 ? (x - 12.5) ** 2 + (y - 12) ** 2 <= 144 : Math.abs(x - 12.5) <= (33 - y) * .55;
    const p = y * (width * 4 + 1) + 1 + x * 4;
    const white = (x - 12.5) ** 2 + (y - 12) ** 2 < 16;
    data[p] = white ? 255 : 24; data[p + 1] = white ? 255 : 62; data[p + 2] = white ? 255 : 67; data[p + 3] = inside ? 255 : 0;
  }
  function chunk(type, body) {
    const payload = Buffer.concat([Buffer.from(type), body]); let crc = 0xffffffff;
    for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(body.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, payload, tail]);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(out, 'assets/marker.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]));
}
build();
if (process.argv.includes('--watch')) {
  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e); } }, 120); };
  fs.watch(src, { recursive: true }, rebuild);
  fs.watch(path.join(repo, 'packages/ts-shared/src'), { recursive: true }, rebuild);
  fs.watch(path.join(repo, 'apps/h5-client/src/utils/tourMessages.ts'), rebuild);
}
