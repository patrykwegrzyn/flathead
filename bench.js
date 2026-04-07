#!/usr/bin/env node
'use strict';

const flathead = require('./');

// --- Random object generators ---
function randFloat() { return +(Math.random() * 200 - 100).toFixed(6); }
function randInt() { return Math.floor(Math.random() * 10000); }
function randUUID() {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += h[Math.random() * 16 | 0];
  return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
}

// --- Test schemas ---
const schemas = [
  {
    name: 'tiny (3 fields)',
    schema: { x: 'number', y: 'number', id: 'string' },
    gen: () => ({ x: randFloat(), y: randFloat(), id: randUUID() })
  },
  {
    name: 'mixed (8 fields)',
    schema: { temp: 'number', humidity: 'number', pressure: 'number', wind: 'number',
              active: 'boolean', sensor_id: 'string', zone_id: 'string', org_id: 'string' },
    gen: () => ({ temp: randFloat(), humidity: randFloat(), pressure: randFloat(), wind: randFloat(),
                  active: Math.random() > 0.5, sensor_id: randUUID(), zone_id: randUUID(), org_id: randUUID() })
  },
  {
    name: 'numbers (20 fields)',
    schema: Object.fromEntries([...Array(20)].map((_, i) => [`f${i}`, 'number'])),
    gen: () => Object.fromEntries([...Array(20)].map((_, i) => [`f${i}`, randFloat()]))
  },
  {
    name: 'big (30 fields)',
    schema: {
      ...Object.fromEntries([...Array(22)].map((_, i) => [`v${i}`, 'number'])),
      ...Object.fromEntries([...Array(5)].map((_, i) => [`id${i}`, 'string'])),
      ...Object.fromEntries([...Array(3)].map((_, i) => [`on${i}`, 'boolean'])),
    },
    gen() {
      const o = {};
      for (let i = 0; i < 22; i++) o[`v${i}`] = randFloat();
      for (let i = 0; i < 5; i++) o[`id${i}`] = randUUID();
      for (let i = 0; i < 3; i++) o[`on${i}`] = Math.random() > 0.5;
      return o;
    }
  },
];

// --- Correctness: random roundtrips ---
let pass = 0, fail = 0;
for (const { name, schema, gen } of schemas) {
  const codec = flathead(schema);
  for (let i = 0; i < 500; i++) {
    const obj = gen();
    const json = codec.stringify(obj);
    const expected = JSON.stringify(obj);
    if (json !== expected) {
      console.error(`FAIL stringify ${name} #${i}`);
      console.error(`  expected: ${expected}`);
      console.error(`  got:      ${json}`);
      fail++; continue;
    }
    const parsed = codec.parse(Buffer.from(json));
    const reparsed = JSON.stringify(parsed);
    if (reparsed !== expected) {
      console.error(`FAIL parse ${name} #${i}`);
      console.error(`  expected: ${expected}`);
      console.error(`  got:      ${reparsed}`);
      fail++; continue;
    }
    pass++;
  }
}
console.log(`Correctness: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);

// --- Bench ---
const WARMUP = 2000;
const MIN_MS = 2000;

for (const { name, schema, gen } of schemas) {
  const codec = flathead(schema);
  const objs = Array.from({ length: 200 }, gen);
  const bufs = objs.map(o => Buffer.from(JSON.stringify(o)));
  const bytes = bufs.reduce((s, b) => s + b.length, 0) / bufs.length;

  let sink = 0;

  // warmup
  for (let i = 0; i < WARMUP; i++) {
    sink += codec.stringify(objs[i % objs.length]).length;
    sink += codec.parse(bufs[i % bufs.length]).x !== undefined ? 1 : 0;
  }

  // bench stringify
  let iters = 0, start = performance.now();
  while (performance.now() - start < MIN_MS) {
    for (let j = 0; j < 100; j++) sink += codec.stringify(objs[j % objs.length]).length;
    iters += 100;
  }
  const sNs = ((performance.now() - start) / iters) * 1e6;

  iters = 0; start = performance.now();
  while (performance.now() - start < MIN_MS) {
    for (let j = 0; j < 100; j++) sink += JSON.stringify(objs[j % objs.length]).length;
    iters += 100;
  }
  const sjNs = ((performance.now() - start) / iters) * 1e6;

  // bench parse
  iters = 0; start = performance.now();
  while (performance.now() - start < MIN_MS) {
    for (let j = 0; j < 100; j++) { const o = codec.parse(bufs[j % bufs.length]); sink += o[Object.keys(schema)[0]] || 0; }
    iters += 100;
  }
  const pNs = ((performance.now() - start) / iters) * 1e6;

  iters = 0; start = performance.now();
  while (performance.now() - start < MIN_MS) {
    for (let j = 0; j < 100; j++) { const o = JSON.parse(bufs[j % bufs.length]); sink += o[Object.keys(schema)[0]] || 0; }
    iters += 100;
  }
  const pjNs = ((performance.now() - start) / iters) * 1e6;

  if (sink === 0) throw new Error('DCE');

  console.log(`--- ${name} (~${bytes.toFixed(0)}B) ---`);
  console.log(`  stringify: ${sNs.toFixed(0)} ns  vs  JSON.stringify: ${sjNs.toFixed(0)} ns  → ${(sjNs/sNs).toFixed(1)}x`);
  console.log(`  parse:     ${pNs.toFixed(0)} ns  vs  JSON.parse:     ${pjNs.toFixed(0)} ns  → ${(pjNs/pNs).toFixed(1)}x`);
  console.log();
}
