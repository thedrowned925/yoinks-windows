// Draws the app icon — the pixel "Y" from the yoinks logo on a rounded
// tile — and writes build/icon.png (512px) plus a multi-size build/icon.ico.
// No image libraries: the glyph is axis-aligned blocks, so it is rasterised
// by hand and encoded with node's zlib.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.join(import.meta.dirname, '..', 'build')
const BG = [0x18, 0x18, 0x1b]
const FG = [0xff, 0xff, 0xff]

// the Y glyph from the logo art in half-cell units: 1 = solid, 2 = shaded (▓)
const GLYPH = [
  [2, 0, 2],
  [2, 0, 2],
  [1, 1, 1],
  [0, 1, 0],
  [0, 1, 0],
]

function sample(size, x, y) {
  const radius = size * 0.22
  // rounded tile
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) return null
  const unit = size >= 64 ? Math.round((size * 0.15) / 4) * 4 : size * 0.15
  const left = Math.round((size - unit * 3) / 2)
  const top = Math.round((size - unit * 5) / 2)
  const col = Math.floor((x - left) / unit)
  const row = Math.floor((y - top) / unit)
  const kind = GLYPH[row]?.[col] ?? 0
  if (kind === 1) return FG
  if (kind === 2) {
    // tiny icons can't hold a checker — shade reads as a flat mid-tone there
    if (size < 64) return BG.map((c, i) => Math.round((c + FG[i]) / 2))
    const checker = Math.max(1, unit / 4)
    const on = (Math.floor((x - left) / checker) + Math.floor((y - top) / checker)) % 2 === 0
    return on ? FG : BG
  }
  return BG
}

function render(size) {
  const SS = 4 // supersampling for the rounded corners
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = sample(size, x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
          if (!color) continue
          r += color[0]; g += color[1]; b += color[2]; a++
        }
      }
      const i = (y * size + x) * 4
      if (a) {
        pixels[i] = Math.round(r / a)
        pixels[i + 1] = Math.round(g / a)
        pixels[i + 2] = Math.round(b / a)
        pixels[i + 3] = Math.round((a / (SS * SS)) * 255)
      }
    }
  }
  return pixels
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size) {
  const pixels = render(size)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // rgba
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ICO with PNG-compressed entries (supported since Windows Vista)
function ico(sizes) {
  const images = sizes.map(png)
  const header = Buffer.alloc(6 + 16 * sizes.length)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i
    header[entry] = size >= 256 ? 0 : size
    header[entry + 1] = size >= 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4) // planes
    header.writeUInt16LE(32, entry + 6) // bpp
    header.writeUInt32LE(images[i].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += images[i].length
  })
  return Buffer.concat([header, ...images])
}

fs.mkdirSync(OUT, {recursive: true})
fs.writeFileSync(path.join(OUT, 'icon.png'), png(512))
fs.writeFileSync(path.join(OUT, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]))
console.log('wrote build/icon.png and build/icon.ico')
