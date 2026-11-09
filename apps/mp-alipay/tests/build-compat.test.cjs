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

test('packaged language gate renders the configured languages in a scrollable list', () => {
  const template = fs.readFileSync(path.resolve(__dirname, '../dist/pages/tour/index.axml'), 'utf8');
  assert.match(template, /<scroll-view\b[^>]*class="language-gate"[^>]*scroll-y="true"/);
  const languageButtons = [...template.matchAll(/<button\b[^>]*onTap="chooseLanguage"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(languageButtons.length, 1);
  assert.match(languageButtons[0][0], /a:for="\{\{locales\}\}"/);
  assert.match(languageButtons[0][0], /a:key="value"/);
  assert.match(languageButtons[0][0], /data-index="\{\{index\}\}"/);
  assert.match(languageButtons[0][1], /\{\{item.label\}\}/);
});

test('empty catalog exposes language recovery without mounting the native map or empty route scroller', () => {
  const template = fs.readFileSync(path.resolve(__dirname, '../dist/pages/tour/index.axml'), 'utf8');
  const visible = (tag, state) => {
    const expression = tag.match(/a:if="\{\{(.*?)\}\}"/);
    return !expression || !!vm.runInNewContext(expression[1], state);
  };
  const tagWithClass = name => template.match(new RegExp('<[\\w-]+\\b[^>]*class="' + name + '"[^>]*>'))[0];
  const map = template.match(/<map\b[^>]*>/)[0];
  const emptyState = { tourStage: 'overview', route: null, routes: [], stops: [], loading: false };
  assert.equal(visible(map, emptyState), false);
  assert.equal(visible(tagWithClass('route-deck'), emptyState), false);
  assert.equal(visible(tagWithClass('start-area'), emptyState), false);
  assert.equal(visible(tagWithClass('empty-routes'), emptyState), true);
  assert.match(tagWithClass('empty-language-button'), /onTap="showLanguage"/);
  assert.equal(visible(tagWithClass('language-gate'), emptyState), false);
  assert.equal(visible(tagWithClass('language-gate'), { ...emptyState, tourStage: 'language' }), true);
  const populated = { ...emptyState, route: {}, routes: [{}], stops: [{}] };
  assert.equal(visible(map, populated), true);
  assert.equal(visible(tagWithClass('route-deck'), populated), true);
  assert.equal(visible(tagWithClass('start-area'), populated), true);
  assert.equal(visible(tagWithClass('empty-routes'), populated), false);
});
