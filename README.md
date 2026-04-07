# flathead

Schema-aware JSON codegen. Give it a schema, get a parser and stringifier that are stupid fast.

- **~4x** faster than `JSON.parse`
- **~7x** faster than `JSON.stringify`
- Zero dependencies
- Pure JS — no native addons, no WASM, no bullshit

## How

`flathead` code-generates a specialized function for your exact schema using `new Function()`. No property enumeration, no type checking, no key matching. Just a straight-line function that knows exactly where everything is.

V8's JIT compiles it into tight machine code. That's it. That's the trick.

## Install

```
npm i flathead
```

## Usage

```js
const flathead = require('flathead');
// or
import flathead from 'flathead';

const codec = flathead({
  channel: 'number',
  value: 'number',
  sensor_id: 'string',
  active: 'boolean'
});

// parse: Buffer → Object
const obj = codec.parse(buffer);

// stringify: Object → JSON string
const json = codec.stringify(obj);
```

Types: `'number'`, `'string'`, `'boolean'`

## Rules

- **Parse** needs schema field order to match JSON key order. If it doesn't, it falls back to `JSON.parse` automatically — no crash, just slower.
- **Stringify** works regardless of order.
- Strings are not escape-scanned. Safe for ASCII (UUIDs, IDs, timestamps, etc). If your strings have characters that need JSON escaping, use `JSON.stringify`.

## Benchmarks

IoT payloads, `taskset -c 0 node bench.js`, Node 22, Linux:

| | JSON.parse | flathead | speedup |
|---|---|---|---|
| 391B, 14 fields | 1305 ns | 343 ns | **3.8x** |

| | JSON.stringify | flathead | speedup |
|---|---|---|---|
| 391B, 14 fields | 1069 ns | 150 ns | **7.1x** |

Random payloads across schema sizes:

| schema | parse | stringify |
|---|---|---|
| 3 fields, 73B | **6.8x** | **7.1x** |
| 8 fields, 240B | **4.5x** | **6.4x** |
| 20 fields, 316B | **5.5x** | **3.8x** |
| 30 fields, 609B | **3.7x** | **3.4x** |

## How it works

For a schema like `{ x: 'number', id: 'string' }`, flathead generates:

**Parser** — walks the buffer byte-by-byte with hardcoded key offsets, inline digit-by-digit number parser, and length-predicted string scanning that skips `Buffer.indexOf` when string lengths are consistent.

**Stringifier** — generates a template literal with all keys baked in. V8 pre-computes the total length and allocates once. No ConsString chains.

Both are emitted via `new Function()` and JIT-compiled by V8 into proper machine code.

## License

ISC
