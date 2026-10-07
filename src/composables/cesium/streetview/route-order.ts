/**
 * 街景道路顺序推导（纯函数，不依赖 Cesium）
 *
 * 为什么必须自己推：街景服务的端点只给「一堆坐标 + 按坐标取图」，既不返回路网拓扑，
 * 也不返回相邻关系（已确认不可扩展接口）。而要求是「沿道路前进/后退」——
 * 直接按接口返回的数组顺序走会跳点（城市点集在库里不按道路排列），必须自己恢复顺序。
 *
 * 做法（局部米制平面内）：
 *  1. 以点集中心为原点投影到米制坐标（避免在经纬度上算距离/转角的畸变）；
 *  2. 以「最大步长」为格边长建网格，只把 3×3 格内的点当候选邻居（避免 O(n²) 建边）；
 *  3. 贪心成链：每一步在未访问邻居里选「距离 + 转角惩罚」最小的点，转角越小越优先，
 *     于是直行优先、路口不折返；
 *  4. 安全网：若推导结果的平均步长明显差于原始数组顺序，就退回原始顺序——
 *     宁可用朴素顺序，也不能比改造前更差。
 *
 * 不做「丢点式去重」：重复点若被丢掉，用户就永远定位不到它；重复点导致的折返
 * 由「转角惩罚 + 已访问标记」处理。
 */
import { bearingDegrees, centerOf, projectToLocalMeters, type LocalMeters } from './geo';

export interface RouteOrderLocation {
  /** 所属链下标（chains 的索引） */
  chain: number;
  /** 链内位置 */
  pos: number;
}

export interface RouteOrder {
  /** 多条有序链，元素为输入数组下标，按行进顺序排列 */
  chains: number[][];
  /** 下标 → 所属链与链内位置，供 O(1) 前进/后退 */
  locate: Map<number, RouteOrderLocation>;
  /** 下标 → 指向下一个点的方位角（度，0=正北，顺时针），链尾为 null */
  bearing: Map<number, number | null>;
  /** 是否采用了推导顺序（false 表示不如原始顺序，已回退） */
  derived: boolean;
}

export interface RouteOrderOptions {
  /** 相邻点最大间距（米），超过视为断链 */
  maxStepMeters?: number;
  /** 方向连续性惩罚权重（越大越不折返） */
  turnPenalty?: number;
  /** 参与推导的点数上限，超过直接回退原始顺序（保护主线程） */
  maxPoints?: number;
}

/**
 * 默认最大步长（米）。
 *
 * 取 40m 的理由：城市街景点间距多为 10~30m，40m 能容忍中等稀疏的路段；
 * 上限又不足以把相邻平行道路（通常 30m 以上）直接缝成一条链——真串上了也会
 * 被「掉头 = 1.5 个步长」的转角惩罚拆开。数据更密时可调小到 20~25m。
 */
export const DEFAULT_MAX_STEP_METERS = 40;

/** 默认转角惩罚：180° 掉头相当于多走 1.5 个步长的代价 */
export const DEFAULT_TURN_PENALTY = 1.5;

/** 默认点数上限：十万级点仍可推导，但为避免长时间占用主线程留出上限 */
export const DEFAULT_MAX_POINTS = 50000;

export function buildRouteOrder(points: Array<[number, number]>, options: RouteOrderOptions = {}): RouteOrder {
  const count = points.length;
  if (count === 0) {
    return { chains: [], locate: new Map(), bearing: new Map(), derived: false };
  }
  if (count === 1) {
    return {
      chains: [[0]],
      locate: new Map([[0, { chain: 0, pos: 0 }]]),
      bearing: new Map([[0, null]]),
      derived: false
    };
  }

  const maxStepMeters = options.maxStepMeters ?? DEFAULT_MAX_STEP_METERS;
  const turnPenalty = options.turnPenalty ?? DEFAULT_TURN_PENALTY;
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;

  // 退化输入与超限输入：直接按原始顺序成链，保证「前进/后退」永远可用
  if (count > maxPoints) {
    return buildResult(points, [indexRange(count)], false);
  }

  const [originLon, originLat] = centerOf(points);
  const local = points.map(([lon, lat]) => projectToLocalMeters(originLon, originLat, lon, lat));
  const cell = maxStepMeters > 0 ? maxStepMeters : DEFAULT_MAX_STEP_METERS;
  const buckets = new Map<string, number[]>();
  local.forEach((point, index) => {
    const key = gridKey(Math.floor(point.x / cell), Math.floor(point.y / cell));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  });

  function localDistance(a: number, b: number): number {
    return Math.hypot(local[a].x - local[b].x, local[a].y - local[b].y);
  }

  /** 阈值内的候选邻居（同格 + 相邻格，故只需 3×3） */
  function neighborsOf(index: number): number[] {
    const point = local[index];
    const cx = Math.floor(point.x / cell);
    const cy = Math.floor(point.y / cell);
    const result: number[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = buckets.get(gridKey(cx + dx, cy + dy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const candidate = bucket[i];
          if (candidate !== index && localDistance(index, candidate) <= maxStepMeters) {
            result.push(candidate);
          }
        }
      }
    }
    return result;
  }

  const visited = new Uint8Array(count);

  /**
   * 选下一个点。
   *
   * `heading` 是「沿链前进方向的上一步方位」：候选点与该方位越一致，得分越低；
   * 惩罚按米折算（turnPenalty × 转角占比 × 步长），因此「多走 5m 直行」优于「原地掉头」。
   */
  function pickNext(current: number, heading: number | null): number {
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    const candidates = neighborsOf(current);
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (visited[candidate]) continue;
      let score = localDistance(current, candidate);
      if (heading !== null) {
        const stepBearing = bearingDegrees(
          points[current][0],
          points[current][1],
          points[candidate][0],
          points[candidate][1]
        );
        score += turnPenalty * (Math.abs(angleDeltaDegrees(stepBearing, heading)) / 180) * maxStepMeters;
      }
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  /** 从一个未访问点向两端延伸，得到尽量长的一条链 */
  function growFrom(start: number): number[] {
    visited[start] = 1;

    // 正向：沿链前进方向不断取下一个点
    const forward: number[] = [];
    let current = start;
    let heading: number | null = null;
    for (;;) {
      const next = pickNext(current, heading);
      if (next < 0) break;
      visited[next] = 1;
      heading = bearingDegrees(points[current][0], points[current][1], points[next][0], points[next][1]);
      forward.push(next);
      current = next;
    }

    // 反向：链的行进方向是 prev → current，与正向相反，故参考方位翻转 180°
    const backward: number[] = [];
    current = start;
    heading = null;
    for (;;) {
      const prev = pickNext(current, heading);
      if (prev < 0) break;
      visited[prev] = 1;
      heading = flipBearing(bearingDegrees(points[prev][0], points[prev][1], points[current][0], points[current][1]));
      backward.push(prev);
      current = prev;
    }
    backward.reverse();

    return [...backward, start, ...forward];
  }

  const chains: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    if (visited[i]) continue;
    chains.push(growFrom(i));
  }

  // 择优：推导顺序若明显不如原始顺序（平均步长更大），回退原始顺序
  const naturalChain = indexRange(count);
  const derivedAverage = averageStep(chains, local);
  const naturalAverage = averageStep([naturalChain], local);
  const derived = derivedAverage <= naturalAverage * 1.05;

  return buildResult(points, derived ? chains : [naturalChain], derived);
}

/** 生成 locate 与 bearing：前进/后退靠 locate，全景初始朝向靠 bearing */
function buildResult(points: Array<[number, number]>, chains: number[][], derived: boolean): RouteOrder {
  const locate = new Map<number, RouteOrderLocation>();
  const bearing = new Map<number, number | null>();

  chains.forEach((chain, chainIndex) => {
    chain.forEach((pointIndex, pos) => {
      locate.set(pointIndex, { chain: chainIndex, pos });
      const next = chain[pos + 1];
      bearing.set(
        pointIndex,
        next === undefined
          ? null
          : bearingDegrees(points[pointIndex][0], points[pointIndex][1], points[next][0], points[next][1])
      );
    });
  });

  return { chains, locate, bearing, derived };
}

function averageStep(chains: number[][], local: LocalMeters[]): number {
  let total = 0;
  let steps = 0;
  chains.forEach(chain => {
    for (let i = 1; i < chain.length; i += 1) {
      total += Math.hypot(local[chain[i]].x - local[chain[i - 1]].x, local[chain[i]].y - local[chain[i - 1]].y);
      steps += 1;
    }
  });
  return steps === 0 ? Number.POSITIVE_INFINITY : total / steps;
}

function indexRange(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function gridKey(x: number, y: number): string {
  return `${x}:${y}`;
}

/** 角度差归一化到 [-180, 180] */
function angleDeltaDegrees(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** 方位角翻转 180°（反向延伸时把参考方向对齐到链的行进方向） */
function flipBearing(bearing: number): number {
  return (bearing + 180) % 360;
}
