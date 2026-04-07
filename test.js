#!/usr/bin/env node
'use strict';

const jsflat = require('./');

let pass = 0, fail = 0;

function assert(name, got, expected) {
  if (JSON.stringify(got) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  got:      ${JSON.stringify(got)}`);
  }
}

// --- Basic schema ---
const schema = {
  channel: 'number', w: 'number', va: 'number', var: 'number', rms: 'number',
  thing_id: 'string', org_id: 'string'
};

const codec = jsflat(schema);

const obj = {
  channel: 5, w: 3.868574, va: 8.681729, var: 5.835541, rms: 0.039649,
  thing_id: "f92594e1-252a-43de-aabd-9a837af3195b",
  org_id: "72562341-35e4-42ea-b998-3c4de9719ab9"
};

// Test stringify
const json = codec.stringify(obj);
assert('stringify output matches JSON.stringify', json, JSON.stringify(obj));

// Test parse
const buf = Buffer.from(json, 'latin1');
const parsed = codec.parse(buf);
assert('parse roundtrip', parsed, obj);

// Test parse/stringify roundtrip
const json2 = codec.stringify(parsed);
assert('stringify(parse(stringify(obj))) === stringify(obj)', json2, json);

// --- Boolean fields ---
const boolSchema = { active: 'boolean', count: 'number', name: 'string' };
const boolCodec = jsflat(boolSchema);

const boolObj = { active: true, count: 42, name: "test" };
const boolJson = boolCodec.stringify(boolObj);
assert('bool stringify', boolJson, JSON.stringify(boolObj));

const boolParsed = boolCodec.parse(Buffer.from(boolJson));
assert('bool parse true', boolParsed.active, true);

const boolObj2 = { active: false, count: 7, name: "abc" };
const boolJson2 = boolCodec.stringify(boolObj2);
const boolParsed2 = boolCodec.parse(Buffer.from(boolJson2));
assert('bool parse false', boolParsed2.active, false);

// --- Negative numbers ---
const negObj = { channel: -1, w: -3.14, va: 0, var: -0.001, rms: 100,
  thing_id: "abc", org_id: "def" };
const negJson = codec.stringify(negObj);
const negParsed = codec.parse(Buffer.from(negJson));
assert('negative numbers roundtrip', negParsed, negObj);

// --- Large schema (>20 fields, triggers zero-alloc path) ---
const bigSchema = {};
for (let i = 0; i < 25; i++) bigSchema[`f${i}`] = 'number';
bigSchema.id = 'string';

const bigCodec = jsflat(bigSchema);
const bigObj = {};
for (let i = 0; i < 25; i++) bigObj[`f${i}`] = +(i * 1.1).toFixed(6);
bigObj.id = "big-test-id";

const bigJson = bigCodec.stringify(bigObj);
assert('big schema stringify', bigJson, JSON.stringify(bigObj));

const bigParsed = bigCodec.parse(Buffer.from(bigJson));
assert('big schema parse roundtrip', bigParsed, bigObj);

// --- Structural guard fallback ---
const wrongOrder = '{"org_id":"x","channel":1,"w":2,"va":3,"var":4,"rms":5,"thing_id":"y"}';
const fallback = codec.parse(Buffer.from(wrongOrder));
assert('fallback to JSON.parse on wrong key order', fallback.org_id, "x");
assert('fallback preserves all fields', fallback.channel, 1);

// --- Separate API ---
const { createParser, createStringifier } = require('./');
const p = createParser(schema);
const s = createStringifier(schema);
assert('createParser works', p.parse(buf).channel, 5);
assert('createStringifier works', s.stringify(obj), JSON.stringify(obj));

// --- Report ---
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
