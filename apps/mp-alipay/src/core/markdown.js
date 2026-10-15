const { lexer } = require('../shared/marked');
function text(value) { return { type: 'text', text: String(value || '') }; }
function element(name, children, attrs) { return { name, ...(attrs ? { attrs } : {}), children }; }
function safeUrl(url) { return /^https?:\/\/[^\s<>]+$/i.test(String(url || '')); }
function convert(tokens, depth = 0) {
  if (depth > 30) return [text('…')];
  return (tokens || []).flatMap(token => {
    const children = () => token.tokens ? convert(token.tokens, depth + 1) : [text(token.text)];
    switch (token.type) {
      case 'space': return [];
      case 'heading': return [element('h' + token.depth, children())];
      case 'paragraph': return [element('p', children())];
      case 'text': return children();
      case 'escape': return [text(token.text)];
      case 'strong': return [element('strong', children())];
      case 'em': return [element('em', children())];
      case 'del': return [element('del', children())];
      case 'codespan': return [element('code', [text(token.text)])];
      case 'code': return [element('pre', [element('code', [text(token.text)])])];
      case 'br': return [element('br', [])];
      case 'hr': return [element('hr', [])];
      case 'blockquote': return [element('blockquote', children())];
      case 'list': return [element(token.ordered ? 'ol' : 'ul', token.items.map(item => element('li', (item.task ? [text(item.checked ? '☑ ' : '☐ ')] : []).concat(convert(item.tokens, depth + 1)))), token.ordered ? { start: String(token.start) } : undefined)];
      case 'link': return [safeUrl(token.href) ? element('a', children(), { href: token.href }) : element('span', children())];
      case 'image': return [safeUrl(token.href) ? element('img', [], { src: token.href, alt: token.text || '', style: 'max-width:100%;height:auto;' }) : text(token.text)];
      case 'table': return [element('table', [
        element('thead', [element('tr', token.header.map(cell => element('th', convert(cell.tokens, depth + 1))))]),
        element('tbody', token.rows.map(row => element('tr', row.map(cell => element('td', convert(cell.tokens, depth + 1))))))
      ], { style: 'width:100%;border-collapse:collapse;' })];
      default: return [text(token.raw || token.text)];
    }
  });
}
function markdownNodes(source) { return convert(lexer(String(source || ''), { gfm: true, breaks: true })); }
module.exports = { markdownNodes };
