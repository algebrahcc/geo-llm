/**
 * 北斗网格位置码（GB/T 39409-2020）编码内核 —— 纯函数、无副作用、可单独核对。
 *
 * 二维：十级步长（经纬向不等），逐级在父格内剖分。
 * 三维：高度域按国标 C.14，把高度映射为 32 位整数码元后按位宽分段取进制。
 *
 * 边界规则：
 * - 极区：南北纬 88° 以外合并为一级网格 N000 / S000，不再向下剖分（避免产生非标码）；
 * - 跨 180° 经线：拆分为两段矩形处理；
 * - 负经度/南半球：剖分在下标空间进行，不使用取模，规避负数取模歧义。
 */

export interface GridStep {
  lon: number;
  lat: number;
}

export interface GeoRect {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GridCodeRect extends GeoRect {
  level: number;
}

/** 一个网格单元：范围 + 完整码 + 是否处于极区合并格 */
export interface GridCellResult extends GridCodeRect {
  code: string;
  polar: boolean;
}

/** 十级步长（度），索引 0 对应 1 级 */
export const GRID_STEPS: readonly GridStep[] = [
  { lon: 6, lat: 4 },
  { lon: 30 / 60, lat: 30 / 60 },
  { lon: 15 / 60, lat: 10 / 60 },
  { lon: 1 / 60, lat: 1 / 60 },
  { lon: 4 / 3600, lat: 4 / 3600 },
  { lon: 2 / 3600, lat: 2 / 3600 },
  { lon: 1 / (3600 * 4), lat: 1 / (3600 * 4) },
  { lon: 1 / (3600 * 32), lat: 1 / (3600 * 32) },
  { lon: 1 / (3600 * 256), lat: 1 / (3600 * 256) },
  { lon: 1 / (3600 * 2048), lat: 1 / (3600 * 2048) }
];

/** 各级完整二维码长度（4/6/7/9/11/12/14/16/18/20），索引 0 对应 1 级 */
export const LEVEL_CODE_LENGTHS: readonly number[] = [4, 6, 7, 9, 11, 12, 14, 16, 18, 20];

/** 极区阈值（国标：纬向 88° 以外单独处理） */
export const POLAR_LAT_LIMIT = 88;

export const MAX_LEVEL = GRID_STEPS.length;

const LON_12 = '0123456789AB';
const LON_15 = '0123456789ABCDE';
const LAT_8 = '01234567';
const LAT_10 = '0123456789';
/** 3 级 Z 序：矩阵 [[0,2,4],[1,3,5]] 按行展开，下标 = 经向序号 * 3 + 纬向序号 */
const Z_2X3 = '024135';
/** 6 级 Z 序：矩阵 [[0,2],[1,3]] 按行展开 */
const Z_2X2 = '0213';

interface LevelRule {
  lonParts: number;
  latParts: number;
  /** 该级追加的字符数 */
  length: number;
  encode(lonIndex: number, latIndex: number): string;
  decode(segment: string): { lonIndex: number; latIndex: number } | null;
}

/** 由两个字符集构成的「经向字符 + 纬向字符」行列式编码规则 */
function rowColRule(lonAlphabet: string, latAlphabet: string): LevelRule {
  return {
    lonParts: lonAlphabet.length,
    latParts: latAlphabet.length,
    length: 2,
    encode: (lonIndex, latIndex) => `${lonAlphabet[lonIndex]}${latAlphabet[latIndex]}`,
    decode: segment => {
      const lonIndex = lonAlphabet.indexOf(segment[0]);
      const latIndex = latAlphabet.indexOf(segment[1]);
      return lonIndex < 0 || latIndex < 0 ? null : { lonIndex, latIndex };
    }
  };
}

/** Z 序编码规则（二维序号映射为一个字符） */
function zOrderRule(table: string, lonParts: number, latParts: number): LevelRule {
  return {
    lonParts,
    latParts,
    length: 1,
    encode: (lonIndex, latIndex) => table[lonIndex * latParts + latIndex],
    decode: segment => {
      const code = table.indexOf(segment);
      return code < 0 ? null : { lonIndex: Math.floor(code / latParts), latIndex: code % latParts };
    }
  };
}

/** 2~10 级剖分规则（索引 0 未使用） */
const LEVEL_RULES: Record<number, LevelRule> = {
  2: rowColRule(LON_12, LAT_8),
  3: zOrderRule(Z_2X3, 2, 3),
  4: rowColRule(LON_15, LAT_10),
  5: rowColRule(LON_15, LON_15),
  6: zOrderRule(Z_2X2, 2, 2),
  7: rowColRule(LAT_8, LAT_8),
  8: rowColRule(LAT_8, LAT_8),
  9: rowColRule(LAT_8, LAT_8),
  10: rowColRule(LAT_8, LAT_8)
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 正向取模（负数结果映射到 [0, modulus)） */
export function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** 把经度收敛到 [-180, 180)，180 归入最后一个 6° 带 */
function normalizeLon(lon: number): number {
  return clamp(lon, -180, 180 - 1e-9);
}

/** 1 级格：返回包含该点的 1 级格范围与码；极区返回合并格 */
export function getLevel1Cell(lon: number, lat: number): { rect: GeoRect; code: string; polar: boolean } {
  const hemisphere = lat >= 0 ? 'N' : 'S';
  if (Math.abs(lat) >= POLAR_LAT_LIMIT) {
    const rect: GeoRect =
      lat >= 0
        ? { west: -180, south: POLAR_LAT_LIMIT, east: 180, north: 90 }
        : { west: -180, south: -90, east: 180, north: -POLAR_LAT_LIMIT };
    return { rect, code: `${hemisphere}000`, polar: true };
  }

  const lonIndex = clamp(Math.floor((normalizeLon(lon) + 180) / 6), 0, 59);
  const latIndex = clamp(Math.floor(Math.abs(lat) / 4), 0, 21);
  const west = -180 + lonIndex * 6;
  const rect: GeoRect =
    lat >= 0
      ? { west, south: latIndex * 4, east: west + 6, north: latIndex * 4 + 4 }
      : { west, south: -(latIndex + 1) * 4, east: west + 6, north: -latIndex * 4 };
  const code = `${hemisphere}${String(lonIndex + 1).padStart(2, '0')}${String.fromCharCode(65 + latIndex)}`;
  return { rect, code, polar: false };
}

/** 逐级解析：返回该点在第 level 级下的格范围与完整码（极区仅到 1 级） */
export function resolveGridCell(lon: number, lat: number, level: number): GridCellResult {
  const latSafe = clamp(lat, -90, 90);
  const lonSafe = normalizeLon(lon);
  const level1 = getLevel1Cell(lonSafe, latSafe);
  if (level1.polar) {
    return { ...level1.rect, level: 1, code: level1.code, polar: true };
  }

  const target = clamp(Math.floor(level), 1, MAX_LEVEL);
  let rect = level1.rect;
  let code = level1.code;
  let current = 1;

  for (let lv = 2; lv <= target; lv++) {
    const rule = LEVEL_RULES[lv];
    const step = GRID_STEPS[lv - 1];
    const lonIndex = clamp(Math.floor((lonSafe - rect.west) / step.lon), 0, rule.lonParts - 1);
    const latIndex = clamp(Math.floor((latSafe - rect.south) / step.lat), 0, rule.latParts - 1);
    code += rule.encode(lonIndex, latIndex);
    rect = {
      west: rect.west + lonIndex * step.lon,
      south: rect.south + latIndex * step.lat,
      east: rect.west + (lonIndex + 1) * step.lon,
      north: rect.south + (latIndex + 1) * step.lat
    };
    current = lv;
  }

  return { ...rect, level: current, code, polar: false };
}

/** 完整二维网格码 */
export function getFullGridCode(lon: number, lat: number, level: number): string {
  return resolveGridCell(lon, lat, level).code;
}

/** 按码反解格范围（层级由编码长度确定），非法码返回 null */
export function parseGridCode(code: string): GridCodeRect | null {
  const raw = code.trim().toUpperCase();
  if (!raw) return null;
  const level = LEVEL_CODE_LENGTHS.indexOf(raw.length) + 1;
  if (!level) return null;

  const hemisphere = raw[0];
  if (hemisphere !== 'N' && hemisphere !== 'S') return null;
  const lonNumber = Number(raw.slice(1, 3));
  if (!Number.isInteger(lonNumber) || lonNumber < 1 || lonNumber > 60) return null;

  const latChar = raw[3];
  const latIndex = latChar.charCodeAt(0) - 65;
  if (latIndex < 0 || latIndex > 21) return null;

  const west = -180 + (lonNumber - 1) * 6;
  let rect: GeoRect =
    hemisphere === 'N'
      ? { west, south: latIndex * 4, east: west + 6, north: latIndex * 4 + 4 }
      : { west, south: -(latIndex + 1) * 4, east: west + 6, north: -latIndex * 4 };

  let cursor = 4;
  for (let lv = 2; lv <= level; lv++) {
    const rule = LEVEL_RULES[lv];
    const segment = raw.slice(cursor, cursor + rule.length);
    if (segment.length < rule.length) return null;
    const index = rule.decode(segment);
    if (!index) return null;
    const step = GRID_STEPS[lv - 1];
    rect = {
      west: rect.west + index.lonIndex * step.lon,
      south: rect.south + index.latIndex * step.lat,
      east: rect.west + (index.lonIndex + 1) * step.lon,
      north: rect.south + (index.latIndex + 1) * step.lat
    };
    cursor += rule.length;
  }

  return { ...rect, level };
}

// ─────────────────────────── 高度域（国标 C.14） ───────────────────────────

const EARTH_RADIUS = 6378137;
const THETA0 = Math.PI / 180;
const HEIGHT_GRID_STEP = 1 / (2048 * 3600);

/** 高度域有效范围（米） */
export const HEIGHT_RANGE = { min: -6302106.722602182, max: 528680171.1252437 };

/**
 * 32 位码元分段（MSB 下标 0）：第 0 位为地上/地下标志，
 * 其余按「1 级 6 位 64 进制、2 级 3 位 8 进制、3 级 1 位二进制、4/5 级 4 位 16 进制、
 * 6 级 1 位二进制、7~10 级各 3 位 8 进制」切分。
 */
const HEIGHT_SEGMENTS: readonly { start: number; end: number; radix: number }[] = [
  { start: 1, end: 7, radix: 64 },
  { start: 7, end: 10, radix: 8 },
  { start: 10, end: 11, radix: 2 },
  { start: 11, end: 15, radix: 16 },
  { start: 15, end: 19, radix: 16 },
  { start: 19, end: 20, radix: 2 },
  { start: 20, end: 23, radix: 8 },
  { start: 23, end: 26, radix: 8 },
  { start: 26, end: 29, radix: 8 },
  { start: 29, end: 32, radix: 8 }
];

/** 64 进制字符集（对齐参考实现的 Long.toUnsignedString(value, 64)） */
const BASE64_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

/** 高度（米）→ 32 位二进制码元串 */
export function getHeightCodeBinary(heightMeters: number): string {
  const height = clamp(heightMeters, HEIGHT_RANGE.min, HEIGHT_RANGE.max);
  const ratio = (EARTH_RADIUS + height) / EARTH_RADIUS;
  const n = (1 / HEIGHT_GRID_STEP) * (Math.log(ratio) / Math.log(1 + THETA0));
  const low32 = Math.trunc(n) >>> 0;
  return low32.toString(2).padStart(32, '0');
}

/** 高度维编码：地上/地下标志 + 按层级截取的分段码元（level 级对应 1~level 段） */
export function getHeightCode(heightMeters: number, level = MAX_LEVEL): string {
  const binary = getHeightCodeBinary(heightMeters);
  const depth = clamp(Math.floor(level), 1, MAX_LEVEL);
  let out = binary.charAt(0);
  for (let i = 0; i < depth; i++) {
    const segment = HEIGHT_SEGMENTS[i];
    const value = Number.parseInt(binary.slice(segment.start, segment.end), 2);
    out += segment.radix === 64 ? BASE64_ALPHABET[value] : value.toString(segment.radix).toUpperCase();
  }
  return out;
}

/**
 * 三维网格位置码：在二维码的半球标识之后插入地上/地下标志，
 * 并按级追加高度维码元（形如 N50J47539 → N0 50J4 7539… 的高度层号）。
 */
export function compose3DGridCode(lon: number, lat: number, heightMeters: number, level: number): string {
  const cell = resolveGridCell(lon, lat, level);
  const depth = cell.level;
  const heightParts = getHeightCode(heightMeters, depth);
  const flag = heightParts.charAt(0);
  const heightChars = heightParts.slice(1);

  // 二维码前 4 位为「半球 + 经向号(2) + 纬向字」，其后再逐级追加
  let out = `${cell.code.charAt(0)}${flag}${cell.code.slice(1, 4)}${heightChars.charAt(0)}`;
  let cursor = 4;
  for (let lv = 2; lv <= depth; lv++) {
    const segmentLength = LEVEL_CODE_LENGTHS[lv - 1] - LEVEL_CODE_LENGTHS[lv - 2];
    out += cell.code.slice(cursor, cursor + segmentLength) + heightChars.charAt(lv - 1);
    cursor += segmentLength;
  }
  return out;
}

// ─────────────────────────── 投影换算（瓦片内定位） ───────────────────────────

/** 墨卡托纬度极限（WebMercatorTilingScheme 的覆盖范围） */
export const MERCATOR_LAT_LIMIT = 85.05112878;

/** 纬度 → 墨卡托归一化 y（北 0，南 1） */
export function mercatorY(latDeg: number): number {
  const lat = clamp(latDeg, -MERCATOR_LAT_LIMIT, MERCATOR_LAT_LIMIT);
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

/**
 * 纬度 → 瓦片内归一化 y（0 在瓦片北缘，1 在南缘）。
 * mercator=true 时按墨卡托投影换算（与底图一致），否则按线性换算（地理坐标瓦片方案）。
 * 网格线在墨卡托瓦片上必须用投影换算，按线性比例会在中高纬度逐格偏移。
 */
export function latToTileY(lat: number, north: number, south: number, mercator: boolean): number {
  if (mercator) {
    const yNorth = mercatorY(north);
    const span = mercatorY(south) - yNorth;
    return span === 0 ? 0 : (mercatorY(lat) - yNorth) / span;
  }
  const span = north - south;
  return span === 0 ? 0 : (north - lat) / span;
}

// ─────────────────────────── 范围与自适应选级 ───────────────────────────

/** 跨 180° 经线的范围拆分为两段（不跨则原样返回单元素） */
export function splitRangeByDateline(rect: GeoRect): GeoRect[] {
  const { west, south, east, north } = rect;
  if (east >= west) return [{ west, south, east, north }];
  return [
    { west, south, east: 180, north },
    { west: -180, south, east, north }
  ];
}

/** 把范围对齐到指定层级的真实格网边界（各级边界均为该级步长的整数倍） */
export function rangeAlignToLevel(rect: GeoRect, level: number): GridCodeRect {
  const lv = clamp(Math.floor(level), 1, MAX_LEVEL);
  const step = GRID_STEPS[lv - 1];
  return {
    west: clamp(Math.floor(rect.west / step.lon) * step.lon, -180, 180),
    south: clamp(Math.floor(rect.south / step.lat) * step.lat, -90, 90),
    east: clamp(Math.ceil(rect.east / step.lon) * step.lon, -180, 180),
    north: clamp(Math.ceil(rect.north / step.lat) * step.lat, -90, 90),
    level: lv
  };
}

/** 每瓦片允许的最大网格线条数（决定自适应选级的目标密度，约 42px 一条线） */
export const MAX_LINES_PER_TILE = 6;
/** 级别切换滞回系数：偏差未超过该比例则维持原级别，避免连续缩放时抖动 */
const LEVEL_HYSTERESIS = 1.6;

/**
 * 选级用的等效步长：取经纬两个方向的较小者。
 * 国标部分层级经纬步长不等（如 3 级为 15′×10′），若只按经向步长选级，
 * 纬线密度会超出预算；取较小者可使两个方向同时受控。
 * 墨卡托瓦片的纬向跨度不超过经向跨度，故以经向跨度作为统一参照是保守且一致的。
 */
export function effectiveGridStep(level: number): number {
  const step = GRID_STEPS[clamp(Math.floor(level), 1, MAX_LEVEL) - 1];
  return Math.min(step.lon, step.lat);
}

/**
 * 按瓦片跨度（度）选择网格层级：取「每瓦片线条数不超过 MAX_LINES_PER_TILE」的最细级别，
 * 使网格在允许的绘制成本下尽可能细。传入 previous 时启用滞回，临界区间内保持原级别。
 */
export function pickGridLevelByTileExtent(tileExtentDeg: number, previous?: number): number {
  const fallback = clamp(Math.floor(previous ?? 1), 1, MAX_LEVEL);
  if (!(tileExtentDeg > 0)) return fallback;

  let ideal = 1;
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    if (tileExtentDeg / effectiveGridStep(lv) <= MAX_LINES_PER_TILE) ideal = lv;
    else break;
  }
  if (!previous) return ideal;

  const desired = tileExtentDeg / MAX_LINES_PER_TILE;
  const prevStep = effectiveGridStep(fallback);
  if (prevStep <= desired * LEVEL_HYSTERESIS && prevStep >= desired / LEVEL_HYSTERESIS) return fallback;
  return ideal;
}
