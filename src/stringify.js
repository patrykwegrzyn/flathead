'use strict';

// Code-generating flat JSON stringifier.
// Emits a specialized stringify function per schema via `new Function()`.
// Uses template literals — V8 pre-computes total length and allocates once,
// avoiding ConsString chains. No property enumeration, no type checks,
// no escape scanning (safe for ASCII strings like UUIDs).

function createJSFlatStringifier(schema) {
  const fields = Object.entries(schema);
  const N = fields.length;

  const reserved = new Set(['var','class','return','do','if','else','for','while','switch',
    'case','break','continue','new','delete','typeof','void','in','of','with','try',
    'catch','finally','throw','this','super','import','export','default','extends',
    'yield','async','await','let','const','static','enum']);

  // Build template literal parts
  let tmplParts = []; // string parts
  let tmplExprs = []; // expression parts

  tmplParts.push('{');
  for (let i = 0; i < N; i++) {
    const [key, type] = fields[i];
    const accessor = reserved.has(key) ? `o["${key}"]` : `o.${key}`;
    const sep = i === 0 ? '' : ',';

    if (type === 'string' || type === 'str') {
      tmplParts[tmplParts.length - 1] += `${sep}"${key}":"`;
      tmplExprs.push(accessor);
      tmplParts.push('"');
    } else {
      tmplParts[tmplParts.length - 1] += `${sep}"${key}":`;
      tmplExprs.push(accessor);
      tmplParts.push('');
    }
  }
  tmplParts[tmplParts.length - 1] += '}';

  // Build: `str0${expr0}str1${expr1}...strN`
  let tmpl = '`' + tmplParts[0];
  for (let i = 0; i < tmplExprs.length; i++) {
    tmpl += '${' + tmplExprs[i] + '}' + tmplParts[i + 1];
  }
  tmpl += '`';

  const src = `return function stringify(o) {
    return ${tmpl};
  };`;

  return { stringify: new Function(src)() };
}

module.exports = { createJSFlatStringifier };
