// Sinh icon PNG cho PWA mà không cần thư viện đồ hoạ ngoài.
// Vẽ ở độ phân giải gấp 3 rồi thu nhỏ để cạnh mượt (khử răng cưa).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDirs = [path.join(root, 'public', 'icons'), path.join(root, 'extension', 'icons')];
const SS = 3; // hệ số siêu lấy mẫu

/* ---- PNG encoder tối giản (RGBA, không nén filter) ---- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolor + alpha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- Vẽ hình ---- */
const mix = (a, b, t) => Math.round(a + (b - a) * t);

function insideRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function insideTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const t = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (s < 0 !== t < 0 && s !== 0 && t !== 0) return false;
  const d = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  return d === 0 || d < 0 === s + t <= 0;
}

/**
 * @param {number} size cạnh ảnh (px)
 * @param {number} corner bán kính bo góc theo tỉ lệ (0 = vuông, dùng cho maskable)
 * @param {number} inset thu nhỏ hoạ tiết vào giữa (tỉ lệ) để hợp safe-zone của maskable
 */
function drawIcon(size, corner, inset) {
  const S = size * SS;
  const big = Buffer.alloc(S * S * 4);
  const u = S / 512; // hệ số quy đổi từ hệ toạ độ 512
  const r = corner * S;

  // hoạ tiết mũi tên trong hệ 512, được thu nhỏ quanh tâm theo `inset`
  const k = 1 - inset;
  const m = (v) => (v - 256) * k + 256;
  const shafts = [
    [m(120), m(196), 210 * k, 28 * k, 14 * k],
    [m(182), m(288), 210 * k, 28 * k, 14 * k],
  ];
  const heads = [
    [[m(318), m(170)], [m(396), m(210)], [m(318), m(250)]],
    [[m(194), m(262)], [m(116), m(302)], [m(194), m(342)]],
  ];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (r > 0 && !insideRoundRect(x + 0.5, y + 0.5, 0, 0, S, S, r)) continue;

      // nền gradient chéo cam
      const t = (x / S + y / S) / 2;
      big[i] = mix(255, 255, t);
      big[i + 1] = mix(157, 84, t);
      big[i + 2] = mix(77, 0, t);
      big[i + 3] = 255;

      const px = (x + 0.5) / u;
      const py = (y + 0.5) / u;
      const white =
        shafts.some(([rx, ry, w, h, rad]) => insideRoundRect(px, py, rx, ry, w, h, rad)) ||
        heads.some((pts) => insideTriangle(px, py, ...pts));

      if (white) {
        big[i] = 255;
        big[i + 1] = 255;
        big[i + 2] = 255;
      }
    }
  }

  // thu nhỏ SSxSS -> 1x1 (lọc hộp)
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const j = ((y * SS + dy) * S + (x * SS + dx)) * 4;
          const a = big[j + 3] / 255;
          rr += big[j] * a; gg += big[j + 1] * a; bb += big[j + 2] * a; aa += a;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = aa ? Math.round(rr / aa) : 0;
      out[o + 1] = aa ? Math.round(gg / aa) : 0;
      out[o + 2] = aa ? Math.round(bb / aa) : 0;
      out[o + 3] = Math.round((aa / n) * 255);
    }
  }
  return encodePNG(size, size, out);
}

const files = [
  ['icon-48.png', drawIcon(48, 112 / 512, 0)],
  ['icon-192.png', drawIcon(192, 112 / 512, 0)],
  ['icon-512.png', drawIcon(512, 112 / 512, 0)],
  ['icon-maskable-512.png', drawIcon(512, 0, 0.18)],
];

for (const dir of outDirs) {
  // extension/ có thể chưa tồn tại khi ai đó chỉ lấy phần web — bỏ qua, không lỗi.
  if (!fs.existsSync(path.dirname(dir))) continue;
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, buf] of files) {
    fs.writeFileSync(path.join(dir, name), buf);
  }
  console.log(`✓ ${files.length} icon → ${path.relative(root, dir)}`);
}
