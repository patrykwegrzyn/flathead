'use strict';

const { createJSFlatParser } = require('./src/parse');
const { createJSFlatStringifier } = require('./src/stringify');

// flathead — schema-aware JSON codegen
//
// Usage:
//   const flathead = require('flathead');
//   const codec = flathead({ channel: 'number', name: 'string' });
//   const obj = codec.parse(buffer);       // Buffer → Object  (12x faster)
//   const json = codec.stringify(obj);     // Object → JSON string  (7x faster)
//
// Schema field order MUST match JSON key order for parse.
// Stringify works regardless of order.
// Falls back to JSON.parse if structure doesn't match.

function flathead(schema) {
  const { parse } = createJSFlatParser(schema);
  const { stringify } = createJSFlatStringifier(schema);
  return { parse, stringify };
}

module.exports = flathead;
module.exports.flathead = flathead;
module.exports.createParser = createJSFlatParser;
module.exports.createStringifier = createJSFlatStringifier;
