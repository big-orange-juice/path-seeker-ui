const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { validateRegularExpressions, validateTemplateExpressions } = require('../scripts/compat.cjs');
const { harness, plain } = require('./harness.cjs');

test('build rejects regex syntax unavailable in SDK 2.x', () => {
  for (const expression of [String.raw`/(?<a>x)\k<a>/`, '/(?<=x)y/', '/(?<!x)y/', String.raw`/\p{L}/u`, '/x/s', '/x/d', '/[x]/v']) {
    assert.throws(() => validateRegularExpressions('const pattern = ' + expression + ';', 'fixture.js', ts), /SDK 2.x/);
  }
  assert.doesNotThrow(() => validateRegularExpressions(String.raw`const pattern = /(x)\1(?:y)(?!z)/gi;`, 'fixture.js', ts));
});

test('AXML checks reject escaped operators and broken expressions including interpolated classes', () => {
  for (const template of ['<view a:if="{{!messages.length &amp;&amp; !loading}}"/>', '<view class="card {{route &amp;&amp; route.id === item.id ? \'selected\' : \'\'}}"/>', '<view a:elif="{{!records.length && (!error}}"/>']) {
    assert.throws(() => validateTemplateExpressions(template, 'fixture.axml', ts), /AXML 表达式无效/);
  }
  assert.doesNotThrow(() => validateTemplateExpressions('<view a:if="{{!messages.length && !loading}}">{{(place && place.name) || \'景点\'}}</view>', 'fixture.axml', ts));
  assert.doesNotThrow(() => validateTemplateExpressions('<text>Tom &amp; Jerry</text>', 'fixture.axml', ts));
});

test('packaged Markdown lexer runs with ES2017 regex constructors and preserves formatted links', () => {
  const filename = path.resolve(__dirname, '../dist/shared/marked.js');
  const source = fs.readFileSync(filename, 'utf8');
  validateRegularExpressions(source, filename, ts);
  function CompatibleRegExp(pattern, flags) {
    const value = pattern instanceof RegExp ? pattern.source : String(pattern);
    assert.doesNotMatch(value, /\(\?<|\\k<|\\[pP]\{/);
    assert.doesNotMatch(flags || '', /[dsv]/);
    return new RegExp(pattern, flags);
  }
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, RegExp: CompatibleRegExp });
  const tokens = module.exports.lexer('[`景点`](https://example.com/a_(b)) 和 **故事**', { gfm: true, breaks: true });
  assert.equal(tokens[0].tokens[0].type, 'link');
  assert.equal(tokens[0].tokens[0].href, 'https://example.com/a_(b)');
  assert.equal(tokens[0].tokens[0].tokens[0].type, 'codespan');
  const nodes = plain(harness().load('core/markdown').markdownNodes('[`景点`](https://example.com/a_(b)) 和 **故事**'));
  assert.equal(nodes[0].children[0].attrs.href, 'https://example.com/a_(b)');
  assert.equal(nodes[0].children[0].children[0].name, 'code');
  assert.equal(nodes[0].children[2].name, 'strong');
});

test('packaged page templates inline local AXML and ACSS dependencies', () => {
  const tourAxml = fs.readFileSync(path.resolve(__dirname, '../dist/pages/tour/index.axml'), 'utf8');
  const tourAcss = fs.readFileSync(path.resolve(__dirname, '../dist/pages/tour/index.acss'), 'utf8');
  assert.match(tourAxml, /^<view class="tour-page stage-\{\{tourStage\}\}">/);
  assert.match(tourAxml, /class="language-gate"/);
  assert.match(tourAxml, /class="content-sidebar"/);
  assert.doesNotMatch(tourAxml, /<include\b/);
  assert.match(tourAcss, /^page \{ height: 100%; overflow: hidden; \}/);
  assert.match(tourAcss, /\.language-gate/);
  assert.doesNotMatch(tourAcss, /@import\s+["'][^"']+["']/);
});
