'use strict';

const zlib = require('zlib');

const SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const CHANNELS = new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function parseChunks(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(SIGNATURE)) throw new TypeError('Not a PNG file.');
  let offset = 8;
  const chunks = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new TypeError(`Truncated PNG chunk: ${type || 'unknown'}.`);
    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

function decodePngPixels(buffer) {
  const chunks = parseChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr || ihdr.data.length !== 13) throw new TypeError('PNG IHDR is missing or invalid.');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const compression = ihdr.data[10];
  const filterMethod = ihdr.data[11];
  const interlace = ihdr.data[12];
  if (!width || !height) throw new TypeError('PNG dimensions must be positive.');
  if (bitDepth !== 8) throw new TypeError(`Signal decoder supports 8-bit PNG only; observed bitDepth=${bitDepth}.`);
  if (!CHANNELS.has(colorType)) throw new TypeError(`Signal decoder does not support PNG colorType=${colorType}.`);
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) throw new TypeError('Signal decoder supports standard non-interlaced PNG only.');
  const channels = CHANNELS.get(colorType);
  const stride = width * channels;
  const idat = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (!idat.length) throw new TypeError('PNG has no IDAT data.');
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  if (inflated.length !== height * (stride + 1)) throw new TypeError('Unexpected decompressed PNG scanline size.');
  const raw = Buffer.alloc(width * height * channels);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[source++];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const up = y > 0 ? raw[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? raw[rowStart - stride + x - channels] : 0;
      let out;
      if (filter === 0) out = value;
      else if (filter === 1) out = (value + left) & 255;
      else if (filter === 2) out = (value + up) & 255;
      else if (filter === 3) out = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) out = (value + paeth(left, up, upLeft)) & 255;
      else throw new TypeError(`Unsupported PNG filter ${filter}.`);
      raw[rowStart + x] = out;
    }
  }

  let palette = null;
  let transparency = null;
  if (colorType === 3) {
    const plte = chunks.find((chunk) => chunk.type === 'PLTE');
    if (!plte || !plte.data.length || plte.data.length % 3 !== 0) throw new TypeError('Palette PNG requires a valid PLTE chunk.');
    palette = plte.data;
    const trns = chunks.find((chunk) => chunk.type === 'tRNS');
    transparency = trns ? trns.data : null;
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const src = pixel * channels;
    const dst = pixel * 4;
    if (colorType === 0) {
      const gray = raw[src];
      rgba[dst] = gray; rgba[dst + 1] = gray; rgba[dst + 2] = gray; rgba[dst + 3] = 255;
    } else if (colorType === 2) {
      rgba[dst] = raw[src]; rgba[dst + 1] = raw[src + 1]; rgba[dst + 2] = raw[src + 2]; rgba[dst + 3] = 255;
    } else if (colorType === 3) {
      const index = raw[src];
      const p = index * 3;
      if (p + 2 >= palette.length) throw new TypeError(`Palette index ${index} is outside PLTE.`);
      rgba[dst] = palette[p]; rgba[dst + 1] = palette[p + 1]; rgba[dst + 2] = palette[p + 2];
      rgba[dst + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    } else if (colorType === 4) {
      const gray = raw[src];
      rgba[dst] = gray; rgba[dst + 1] = gray; rgba[dst + 2] = gray; rgba[dst + 3] = raw[src + 1];
    } else if (colorType === 6) {
      rgba[dst] = raw[src]; rgba[dst + 1] = raw[src + 1]; rgba[dst + 2] = raw[src + 2]; rgba[dst + 3] = raw[src + 3];
    }
  }
  return { width, height, bitDepth, colorType, rgba };
}

module.exports = { decodePngPixels, parseChunks };
