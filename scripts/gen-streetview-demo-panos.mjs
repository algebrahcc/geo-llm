/**
 * 生成本地街景示例的占位全景图（2:1 等距柱状 PNG）
 *
 * 为什么是 PNG 而不是 SVG：占位图会被 Photo Sphere Viewer 当作 WebGL 纹理加载，
 * SVG 在部分浏览器/加载路径下会失败（表现为图片 error，甚至未捕获的 promise 异常），位图没有这个问题。
 *
 * 为什么用脚本生成而不是直接提交图片：占位图是可复现的构建产物，
 * 脚本本身就是数据规格（尺寸、色板、命名），日后替换真实数据时也一眼看得懂。
 *
 * 用法：node scripts/gen-streetview-demo-panos.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1024;
const HEIGHT = 512;

/** 城市 → 点位 → 基色（RGB）：颜色只用来区分点位，切换时肉眼可辨 */
const CITIES = [
  {
    dir: 'taipei',
    points: [
      ['tp-01', [14, 60, 92]],
      ['tp-02', [22, 86, 96]],
      ['tp-03', [58, 46, 96]]
    ]
  },
  {
    dir: 'newtaipei',
    points: [
      ['nt-01', [22, 82, 62]],
      ['nt-02', [92, 70, 28]],
      ['nt-03', [24, 62, 104]]
    ]
  }
];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, pixelAt) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // 每行前缀：filter = none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // 颜色类型：truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** 上暗下亮的天空渐变 + 地平线 + 经纬网格（旋转时能看出在动、也能核对接缝） */
function buildPanorama(base) {
  const [r0, g0, b0] = base;
  return encodePng(WIDTH, HEIGHT, (x, y) => {
    const vertical = y / HEIGHT;
    const shade = vertical < 0.5 ? 0.45 + vertical * 0.9 : 0.75 - (vertical - 0.5) * 0.7;
    let r = Math.round(r0 * shade + 12);
    let g = Math.round(g0 * shade + 14);
    let b = Math.round(b0 * shade + 18);

    if (x % 64 === 0 || y % 64 === 0) {
      r = Math.min(255, r + 26);
      g = Math.min(255, g + 30);
      b = Math.min(255, b + 34);
    }
    if (Math.abs(y - HEIGHT / 2) <= 1) {
      r = Math.min(255, r + 90);
      g = Math.min(255, g + 96);
      b = Math.min(255, b + 104);
    }
    return [r, g, b];
  });
}

let generated = 0;
CITIES.forEach(city => {
  const dir = join(ROOT, 'public', 'data', 'streetview', city.dir, 'pano');
  mkdirSync(dir, { recursive: true });
  city.points.forEach(([geoid, base]) => {
    const file = join(dir, `${geoid}.png`);
    writeFileSync(file, buildPanorama(base));
    generated += 1;
    console.log(`generated ${file}`);
  });
});

console.log(`\n共生成 ${generated} 张占位全景图（${WIDTH}×${HEIGHT}）`);
