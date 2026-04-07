HACK FIRST, DOUBT NEVER. We beat yyjson 2x with hand-rolled JSON. We built io_uring in an afternoon. M:N scheduler from scratch. Entire language in <10h of sessions.
Nothing is "very hard" or "major rearchitecture" — it's just code. No corp-speak, no timelines, no pessimism. When in doubt: ship it. All is possible, we can do anything, only limit is tokens.

## Project: json-fast

Schema-aware JSON parser that beats V8's JSON.parse. Multiple approaches explored.

### Results (vs JSON.parse, real IoT payloads)

| Approach | payload1 (391B) | payload2 (981B) | File |
|----------|-----------------|-----------------|------|
| C++ generic (SIMD+cache) | 0.99x | 0.96x | json_fast_v8.cc |
| C++ schema (interned keys) | 0.76-0.80x | 0.64-0.67x | json_fast_v8.cc |
| C++ flat (custom dbl parser + key prediction) | 1.60-1.65x | 1.60-1.67x | json_flat.cc |
| **JS codegen flat** | **2.2-2.8x** | **2.7-2.8x** | **js_flat_parser.js** |
| **JS codegen flat + string cache** | **5.8-6.2x** | **3.4-3.6x** | **js_flat_parser.js** |

### Architecture
- `json_fast_v8.cc` — C++ V8 addon: generic parse (SIMD ASCII → v8::JSON::Parse) + schema parse (interned keys, bulk Object::New)
- `json_flat.cc` — C++ flat-only parser: custom fast_parse_double (pow10 table, no strtod), FNV-1a hash, key-order prediction, SSE2 string scan
- `js_flat_parser.js` — **THE WINNER**: code-generates a specialized parse function per schema via `new Function()`. No key matching (hardcoded offsets), inline number parser, object literal return, per-field string cache

### Key insights (hard-won)
- **V8 JIT beats V8 C++ API**: object literals with pre-computed hidden class are 40-60% faster than `Object::New(isolate, proto, names, values, N)` from C++
- **FFI boundary is the enemy**, not the parsing. Every native→JS crossing costs ~100ns
- `buf.latin1Slice()` > `buf.toString('latin1')` by ~10%
- `Buffer.indexOf(byte)` uses C++ SIMD internally, 6x faster than JS byte scan
- Division by pow10 is mandatory — multiply by 10^-n loses precision
- Digit-by-digit JS number parser (22ns) beats parseFloat+string (86ns) by 4x
- String creation (`latin1Slice`) dominates per-string cost (~53ns for 36-byte UUID)
- Per-field string cache is realistic for IoT (sensor IDs constant across readings)
- Node 22 JIT produces better code than Node 25 for this workload
- `--max-inlined-bytecode-size=999` V8 flag can push ~10% more

### Build
```
npx node-gyp rebuild
```

### Benchmarks
- `node bench-real.js` — real IoT payload benchmark (schema + flat + jsflat)
- `node bench-schema.js` — schema parser on synthetic fixtures
- `node bench-json.js` — generic parser benchmark (DON'T TOUCH)
- See `results-flat.md` for full experiment log

### Don't touch
- bench-json.js, experiment-json.sh
