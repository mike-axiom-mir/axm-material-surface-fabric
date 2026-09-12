'use strict';

const zlib = require('zlib');

const SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.from(data || []);
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  name.copy(out, 4);
  payload.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, payload])), 8 + payload.length);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePngRgba(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(SIGNATURE)) throw new TypeError('Not a PNG file.');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = -1;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); offset += 4;
    const type = bytes.toString('ascii', offset, offset + 4); offset += 4;
    const data = bytes.subarray(offset, offset + length); offset += length;
    offset += 4; // CRC is transport integrity; Git/source pack has independent SHA continuity.
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height) throw new TypeError('PNG IHDR is missing.');
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) throw new TypeError(`v0.14 source decoder supports non-interlaced RGBA8 PNG only; observed bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}.`);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  if (inflated.length !== height * (stride + 1)) throw new TypeError('Unexpected decompressed PNG scanline size.');
  const rgba = Buffer.alloc(width * height * 4);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[source++];
      const left = x >= bpp ? rgba[rowStart + x - bpp] : 0;
      const up = y > 0 ? rgba[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? rgba[rowStart - stride + x - bpp] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else throw new TypeError(`Unsupported PNG filter ${filter}.`);
      rgba[rowStart + x] = value;
    }
  }
  return { width, height, rgba: new Uint8Array(rgba) };
}

function encodePngRgba(rgba, width, height) {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  if (!rgba || !Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || rgba.length < w * h * 4) throw new TypeError('RGBA bytes and positive width/height are required.');
  const stride = w * 4;
  const scan = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y += 1) {
    const dest = y * (stride + 1);
    scan[dest] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(scan, dest + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scan, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { decodePngRgba, encodePngRgba, crc32 };
