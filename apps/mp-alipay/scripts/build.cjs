const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { deflateSync } = require('node:zlib');
const { validateRegularExpressions, validateTemplateExpressions } = require('./compat.cjs');
let ts;
try { ts = require('typescript'); } catch (_) { ts = createRequire(path.resolve(__dirname, '../../h5-client/package.json'))('typescript'); }
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '../..');
const src = path.join(root, 'src');
const out = path.join(root, 'dist');
const shared = ['geo', 'geo-range', 'map-coordinates', 'translation-room'];
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
function expandAxml(file, parents = new Set()) {
  if (parents.has(file)) throw Error('模板循环引用: ' + file);
  if (!fs.existsSync(file)) throw Error('缺少模板文件: ' + file);
  const nextParents = new Set(parents); nextParents.add(file);
  return fs.readFileSync(file, 'utf8').replace(/<include\s+src="([^"]+)"\s*\/?\s*>/g, (_, relative) => {
    return expandAxml(path.resolve(path.dirname(file), relative), nextParents);
  });
}
function expandAcss(file, parents = new Set()) {
  if (parents.has(file)) throw Error('样式循环引用: ' + file);
  if (!fs.existsSync(file)) throw Error('缺少样式文件: ' + file);
  const nextParents = new Set(parents); nextParents.add(file);
  return fs.readFileSync(file, 'utf8').replace(/@import\s+["']([^"']+)["']\s*;?/g, (_, relative) => {
    return expandAcss(path.resolve(path.dirname(file), relative), nextParents);
  });
}
function build() {
  fs.mkdirSync(out, { recursive: true });
  for (const file of files(src)) {
    const dest = path.join(out, path.relative(src, file));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!/\.(js|json|axml|acss)$/.test(file)) { fs.copyFileSync(file, dest); continue; }
    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) JSON.parse(text);
    let output = text;
    if (file.endsWith('.js')) output = compile(text, file);
    else if (file.endsWith('.axml')) output = expandAxml(file);
    else if (file.endsWith('.acss')) output = expandAcss(file);
    fs.writeFileSync(dest, output);
  }
  fs.mkdirSync(path.join(out, 'shared'), { recursive: true });
  for (const name of shared) {
    const file = path.join(repo, 'packages/ts-shared/src', name + '.ts');
    fs.writeFileSync(path.join(out, 'shared', name + '.js'), compile(fs.readFileSync(file, 'utf8'), file));
  }
  const messages = path.join(repo, 'apps/h5-client/src/utils/tourMessages.ts');
  fs.writeFileSync(path.join(out, 'shared/tourMessages.js'), compile(fs.readFileSync(messages, 'utf8'), messages));
  const markedEntry = require.resolve('marked', { paths: [root] });
  fs.writeFileSync(path.join(out, 'shared/marked.js'), compile(fs.readFileSync(path.join(path.dirname(markedEntry), 'marked.umd.js'), 'utf8'), 'marked.js'));
  const app = JSON.parse(fs.readFileSync(path.join(out, 'app.json'), 'utf8'));
  for (const page of app.pages) for (const ext of ['js', 'json', 'axml', 'acss']) {
    if (!fs.existsSync(path.join(out, page + '.' + ext))) throw Error('缺少页面文件: ' + page + '.' + ext);
  }
  for (const file of files(out).filter(f => f.endsWith('.js'))) {
    const content = fs.readFileSync(file, 'utf8');
    validateRegularExpressions(content, file, ts);
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
function validateTemplate(page, checked = new Set()) {
  if (checked.has(page)) return;
  checked.add(page);
  for (const ext of ['js', 'json', 'axml', 'acss']) if (!fs.existsSync(path.join(out, page + '.' + ext))) throw Error('缺少组件文件: ' + page + '.' + ext);
  const templateFile = path.join(out, page + '.axml');
  const template = expandAxml(templateFile), visited = new Set();
  validateTemplateExpressions(template, templateFile, ts);
  function methods(file) {
    if (visited.has(file)) return '';
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    return source + [...source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)].map(match => methods(path.resolve(path.dirname(file), match[1] + '.js'))).join('\n');
  }
  const javascript = methods(path.join(out, page + '.js'));
  const config = JSON.parse(fs.readFileSync(path.join(out, page + '.json'), 'utf8'));
  const components = config.usingComponents || {};
  for (const match of template.matchAll(/\b(?:on|catch)[A-Z]\w*="([\w]+)"/g)) {
    if (!new RegExp('\\b' + match[1] + '\\s*\\(').test(javascript)) throw Error('模板事件没有处理函数: ' + page + ':' + match[1]);
  }
  const tags = [];
  const nativeTags = new Set(['view', 'text', 'rich-text', 'button', 'image', 'input', 'textarea', 'scroll-view', 'picker', 'switch', 'slider', 'checkbox-group', 'checkbox', 'label', 'map', 'video', 'block']);
  for (const match of template.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/g)) {
    if (!nativeTags.has(match[1]) && !components[match[1]]) throw Error('不支持的原生组件: ' + page + ':' + match[1]);
    if (match[0].startsWith('</')) { if (tags.pop() !== match[1]) throw Error('模板标签不匹配: ' + page); }
    else if (!match[0].endsWith('/>')) tags.push(match[1]);
  }
  if (tags.length) throw Error('模板标签未关闭: ' + page);
  for (const relative of Object.values(components)) validateTemplate(path.relative(out, path.resolve(path.dirname(templateFile), relative)).replaceAll(path.sep, '/'), checked);
}
// 地图标记随构建生成，无外部图片依赖。
function marker() {
  const scale = 3, width = 26 * scale, height = 34 * scale;
  const data = Buffer.alloc(height * (width * 4 + 1));
  const colors = { teal: [24, 62, 67, 218], ivory: [248, 238, 207, 236], gold: [214, 175, 91, 230] };
  const pixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * (width * 4 + 1) + 1 + x * 4;
    data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2]; data[p + 3] = color[3];
  };
  const polygon = (points, color) => {
    const minX = Math.max(0, Math.floor(Math.min(...points.map(point => point[0]))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map(point => point[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let hit = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
      }
      if (hit) pixel(x, y, color);
    }
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ux = x / scale, uy = y / scale;
    const inside = uy < 25
      ? (ux - 13) ** 2 + (uy - 12) ** 2 <= 144
      : Math.abs(ux - 13) <= (34 - uy) * .56;
    if (inside) pixel(x, y, colors.teal);
  }
  polygon([[7 * scale, 10 * scale], [13 * scale, 5 * scale], [19 * scale, 10 * scale]], colors.gold);
  polygon([[5.5 * scale, 10 * scale], [20.5 * scale, 10 * scale], [19 * scale, 12 * scale], [7 * scale, 12 * scale]], colors.ivory);
  polygon([[8 * scale, 13 * scale], [18 * scale, 13 * scale], [18 * scale, 15 * scale], [8 * scale, 15 * scale]], colors.gold);
  polygon([[9 * scale, 15 * scale], [11 * scale, 15 * scale], [11 * scale, 21 * scale], [9 * scale, 21 * scale]], colors.ivory);
  polygon([[15 * scale, 15 * scale], [17 * scale, 15 * scale], [17 * scale, 21 * scale], [15 * scale, 21 * scale]], colors.ivory);
  polygon([[7 * scale, 21 * scale], [19 * scale, 21 * scale], [20 * scale, 23 * scale], [6 * scale, 23 * scale]], colors.gold);
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
