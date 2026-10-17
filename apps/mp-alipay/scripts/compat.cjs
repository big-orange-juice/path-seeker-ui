function validateRegularExpressions(source, filename, ts) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isRegularExpressionLiteral(node) && /\(\?<|\\k<|\\[pP]\{|\/[a-z]*[dsv][a-z]*$/.test(node.text)) {
      throw Error('SDK 2.x 不支持的正则表达式: ' + filename + ':' + (ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
function validateTemplateExpressions(template, filename, ts) {
  for (const match of template.matchAll(/{{([\s\S]*?)}}/g)) {
    const expression = match[1];
    const ast = ts.createSourceFile('expression.js', '(' + expression + ')', ts.ScriptTarget.ES2017, true);
    if (/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/i.test(expression) || ast.parseDiagnostics.length) {
      const line = template.slice(0, match.index).split('\n').length;
      throw Error('AXML 表达式无效，请直接使用 && 等运算符: ' + filename + ':' + line + ' {{' + expression + '}}');
    }
  }
}
module.exports = { validateRegularExpressions, validateTemplateExpressions };
