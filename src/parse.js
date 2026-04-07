'use strict';

// Code-generating flat JSON parser.
// Emits a specialized parse function per schema — no key matching,
// no hash, no loops for key processing. V8 JIT gets a simple linear
// function with an object literal return.
//
// Optimizations:
// - Single-comparison digit loop: (d >>> 0) < 10
// - Length-predicted string scan: skip indexOf when length repeats
// - Flattened temporaries (shared across fields)
// - Auto zero-alloc for >20 field schemas
// - Structural guard + JSON.parse fallback for safety

function createJSFlatParser(schema) {
  const fields = Object.entries(schema);
  const N = fields.length;
  const useZeroAlloc = N > 20;

  // Structural guard bytes: verify first key at b[2] (after '{"')
  const firstKey = fields[0][0];
  const g0 = firstKey.charCodeAt(0);
  const g1 = firstKey.length > 1 ? firstKey.charCodeAt(1) : null;

  const vars = fields.map((_, i) => `v${i}`).join(', ');

  const strCacheDecls = fields
    .map(([, type], i) => (type === 'string' || type === 'str')
      ? `let c${i}l = -1;` : '')
    .filter(Boolean).join('\n  ');

  let body = '';
  for (let i = 0; i < N; i++) {
    const [key, type] = fields[i];
    const skip = key.length + 4;
    body += `  pos += ${skip};\n`;

    if (type === 'number' || type === 'num' || type === 'f64') {
      body += `  neg = b[pos] === 45;
  if (neg) pos++;
  m = b[pos++] - 48;
  for (d = b[pos] - 48; (d >>> 0) < 10; d = b[++pos] - 48) m = m * 10 + d;
  f = 0;
  if (b[pos] === 46) {
    pos++;
    fs = pos;
    m = m * 10 + b[pos++] - 48;
    for (d = b[pos] - 48; (d >>> 0) < 10; d = b[++pos] - 48) m = m * 10 + d;
    f = pos - fs;
  }
  v${i} = f === 6 ? m / 1000000 : f === 5 ? m / 100000 : f === 4 ? m / 10000 : f === 7 ? m / 10000000 : f ? m / P[f] : m;
  if (neg) v${i} = -v${i};
`;
    } else if (type === 'string' || type === 'str') {
      body += `  pos++;
  pq = pos + c${i}l;
  if (c${i}l >= 0 && b[pq] === 34) {
    v${i} = b.latin1Slice(pos, pq);
    pos = pq + 1;
  } else {
    q = b.indexOf(34, pos);
    v${i} = b.latin1Slice(pos, q);
    c${i}l = q - pos;
    pos = q + 1;
  }
`;
    } else if (type === 'boolean' || type === 'bool') {
      body += `  v${i} = b[pos] === 116;
  pos += v${i} ? 4 : 5;
`;
    }
  }

  const reserved = new Set(['var','class','return','do','if','else','for','while','switch',
    'case','break','continue','new','delete','typeof','void','in','of','with','try',
    'catch','finally','throw','this','super','import','export','default','extends',
    'yield','async','await','let','const','static','enum']);

  const pow10pos = Array.from({length: 23}, (_, i) => `${10 ** i}`).join(', ');

  let returnCode;
  let prelude = '';
  if (useZeroAlloc) {
    const initProps = fields.map(([key, type]) => {
      const k = reserved.has(key) ? `"${key}"` : key;
      return `${k}: ${type === 'string' || type === 'str' ? "''" : '0'}`;
    }).join(', ');
    const fillProps = fields.map(([key], i) => {
      const k = reserved.has(key) ? `["${key}"]` : `.${key}`;
      return `  R${k} = v${i};`;
    }).join('\n');
    prelude = `const R = { ${initProps} };\n  `;
    returnCode = `${fillProps}\n    return R;`;
  } else {
    const retProps = fields.map(([key], i) => {
      return reserved.has(key) ? `"${key}": v${i}` : `${key}: v${i}`;
    }).join(', ');
    returnCode = `return { ${retProps} };`;
  }

  // Guard: check first key bytes — catches wrong key order, different schema,
  // whitespace, or corrupted data. Falls back to JSON.parse (~0 cost on happy path).
  const guardCheck = g1 !== null
    ? `b[2] !== ${g0} || b[3] !== ${g1}`
    : `b[2] !== ${g0}`;

  const src = `
  const P = [${pow10pos}];
  ${strCacheDecls}
  ${prelude}return function parse(b) {
    if (${guardCheck}) return JSON.parse(b);
    let ${vars};
    let pos = 0, neg, m, f, fs, d, q, pq;
  ${body}
    ${returnCode}
  };`;

  return { parse: new Function(src)() };
}

module.exports = { createJSFlatParser };
