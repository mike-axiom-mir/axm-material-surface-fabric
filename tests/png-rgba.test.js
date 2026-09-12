'use strict';
const assert = require('assert');
const png = require('../tools/png-rgba.js');

const width = 5, height = 4;
const rgba = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
  const i = (y * width + x) * 4;
  rgba[i] = x * 31;
  rgba[i + 1] = y * 47;
  rgba[i + 2] = (x + y) * 19;
  rgba[i + 3] = (x === 0 && y === 0) ? 0 : 90 + x * 20 + y * 7;
}
const encoded = png.encodePngRgba(rgba, width, height);
assert.ok(Buffer.isBuffer(encoded));
assert.strictEqual(encoded.subarray(1,4).toString('ascii'), 'PNG');
const decoded = png.decodePngRgba(encoded);
assert.strictEqual(decoded.width, width);
assert.strictEqual(decoded.height, height);
assert.deepStrictEqual(Array.from(decoded.rgba), Array.from(rgba));
assert.throws(() => png.decodePngRgba(Buffer.from('not png')), /Not a PNG/);
console.log('AXM PNG RGBA codec tests: PASS');
