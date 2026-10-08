/**
 * 通过性判定（一期条款 (7)：结合车辆类型判断路口、桥梁、道路、街区的通过性）
 *
 * 设计要点：
 * 1. **数值不走大模型**：通过性是物理量比较（限重、宽度、坡度），必须可复算、可复核；
 *    大模型只负责把结论组织成叙述（见研判面板）。
 * 2. **轮式与履带分开建模**：履带车爬坡能力强、接地压力小，但车体更宽、总重更大——
 *    同一条路对轮式是「可通行」，对履带可能就是「不可通行」，这正是本条款要考的区分。
 * 3. **属性缺失不给乐观结论**：缺数据的路口/道路一律按「受限」处理并提示现地勘察，
 *    避免演示时出现「无数据即畅通」的假结论。
 */

export type VehicleType = 'wheeled' | 'tracked';

export type PassTargetKind = 'intersection' | 'bridge' | 'road' | 'block';

/** 通过性等级：可通行 / 受限（需条件或保障） / 不可通行 */
export type PassLevel = 'passable' | 'restricted' | 'impassable';

const LEVEL_SEVERITY: Record<PassLevel, number> = { passable: 0, restricted: 1, impassable: 2 };

export interface VehicleProfile {
  label: string;
  /** 车辆总重（吨），与桥梁限重比较 */
  weightT: number;
  /** 车体宽度（米） */
  widthM: number;
  /** 可通行最大纵坡（度） */
  maxSlopeDeg: number;
  /** 可通行最小路宽（米）= 车宽 + 车道余量 */
  minRoadWidthM: number;
  /** 是否受未铺装路面限制（轮式在土路/碎石路上机动性能下降） */
  affectedByLooseSurface: boolean;
}

/** 车辆通行能力基线（取值口径写在注释里，便于评审核对与后续调整） */
export const VEHICLE_PROFILE: Record<VehicleType, VehicleProfile> = {
  wheeled: {
    label: '轮式车辆',
    weightT: 12,
    widthM: 2.5,
    // 轮式受附着条件限制：15° 以上纵坡需工程保障
    maxSlopeDeg: 15,
    minRoadWidthM: 4,
    affectedByLooseSurface: true
  },
  tracked: {
    label: '履带车辆',
    weightT: 40,
    widthM: 3.3,
    // 履带附着好，可爬 30° 纵坡
    maxSlopeDeg: 30,
    minRoadWidthM: 5,
    affectedByLooseSurface: false
  }
};

export interface PassTargetAttrs {
  /** 路宽 / 桥面宽（米） */
  widthM?: number;
  /** 桥梁限重（吨） */
  loadLimitT?: number;
  /** 纵坡（度） */
  slopeDeg?: number;
  /** 路面类型：沥青 / 混凝土 / 碎石 / 土路 */
  surface?: string;
  /** 障碍物数量（街区、路口） */
  obstacleCount?: number;
}

export interface PassTarget {
  id: string;
  kind: PassTargetKind;
  name?: string;
  attrs: PassTargetAttrs;
}

export interface PassabilityResult {
  targetId: string;
  kind: PassTargetKind;
  level: PassLevel;
  conclusion: string;
  /** 判定依据（每条都可核对到具体属性） */
  reasons: string[];
  confidence: number;
}

const KIND_LABEL: Record<PassTargetKind, string> = {
  intersection: '路口',
  bridge: '桥梁',
  road: '道路',
  block: '街区'
};

const LOOSE_SURFACES = ['土路', '碎石', '泥'];

/**
 * 宽度余量下限（米）。
 *
 * 用绝对余量而不是比例：比例在窄路上过于激进（4.5m 的路对轮式车其实是正常窄路），
 * 绝对的「不足半米就要引导」更贴近实际判定习惯，也便于在界面上向指挥员解释。
 */
const MIN_WIDTH_MARGIN_M = 0.5;

/** 该类型下「有意义」的属性集合：用于计算数据完备度（置信度与缺失提示） */
const RELEVANT_ATTRS: Record<PassTargetKind, Array<keyof PassTargetAttrs>> = {
  bridge: ['loadLimitT', 'widthM'],
  road: ['widthM', 'slopeDeg', 'surface'],
  intersection: ['widthM', 'obstacleCount'],
  block: ['obstacleCount', 'widthM']
};

interface Candidate {
  level: PassLevel;
  reason: string;
}

/** 各类型判定：返回候选结论与依据，最后取最严等级并合并依据 */
function judgeByKind(target: PassTarget, profile: VehicleProfile): Candidate[] {
  const { attrs, kind } = target;
  const candidates: Candidate[] = [];

  if (kind === 'bridge' && attrs.loadLimitT !== undefined) {
    if (profile.weightT > attrs.loadLimitT) {
      candidates.push({
        level: 'impassable',
        reason: `桥梁限重 ${attrs.loadLimitT}t 低于${profile.label}总重 ${profile.weightT}t`
      });
    } else if (profile.weightT > attrs.loadLimitT * 0.8) {
      candidates.push({
        level: 'restricted',
        reason: `桥梁限重 ${attrs.loadLimitT}t 接近${profile.label}总重 ${profile.weightT}t，需限速单车通过`
      });
    }
  }

  if (attrs.widthM !== undefined) {
    if (attrs.widthM < profile.minRoadWidthM) {
      candidates.push({
        level: 'impassable',
        reason: `宽度 ${attrs.widthM}m 小于${profile.label}最小通行宽度 ${profile.minRoadWidthM}m（车宽 ${profile.widthM}m 加余量）`
      });
    } else if (attrs.widthM < profile.minRoadWidthM + MIN_WIDTH_MARGIN_M) {
      candidates.push({
        level: 'restricted',
        reason: `宽度 ${attrs.widthM}m 的余量不足 ${MIN_WIDTH_MARGIN_M}m，需减速并设引导`
      });
    }
  }

  if (attrs.slopeDeg !== undefined) {
    if (attrs.slopeDeg > profile.maxSlopeDeg) {
      candidates.push({
        level: 'impassable',
        reason: `坡度 ${attrs.slopeDeg}° 超过${profile.label}可通行上限 ${profile.maxSlopeDeg}°`
      });
    } else if (attrs.slopeDeg > profile.maxSlopeDeg * 0.85) {
      candidates.push({
        level: 'restricted',
        reason: `坡度 ${attrs.slopeDeg}° 接近${profile.label}可通行上限 ${profile.maxSlopeDeg}°，需低速通过`
      });
    }
  }

  if (profile.affectedByLooseSurface && attrs.surface && LOOSE_SURFACES.some(item => attrs.surface?.includes(item))) {
    candidates.push({
      level: 'restricted',
      reason: `${attrs.surface}路面：${profile.label}附着条件不足，建议先做路面工程保障`
    });
  }

  if (attrs.obstacleCount !== undefined) {
    if (attrs.obstacleCount >= 3) {
      candidates.push({ level: 'impassable', reason: `范围内检出 ${attrs.obstacleCount} 处障碍物，判定为受阻` });
    } else if (attrs.obstacleCount > 0) {
      candidates.push({ level: 'restricted', reason: `范围内检出 ${attrs.obstacleCount} 处障碍物，需清障后通过` });
    }
  }

  return candidates;
}

/**
 * 判定单个目标的通过性。
 *
 * @param target  目标（路口/桥梁/道路/街区）及其属性
 * @param vehicle 车辆类型：轮式 / 履带
 */
export function judgePassability(target: PassTarget, vehicle: VehicleType): PassabilityResult {
  const profile = VEHICLE_PROFILE[vehicle];
  const kindLabel = KIND_LABEL[target.kind];
  const name = target.name ? `${target.name}（${kindLabel}）` : kindLabel;

  const relevant = RELEVANT_ATTRS[target.kind];
  const missing = relevant.filter(key => target.attrs[key] === undefined || target.attrs[key] === null);
  const present = relevant.length - missing.length;

  // 「一项属性都没有」与「有属性但都满足」必须分开：前者是数据不足，后者才是可通行，
  // 混在一起会让缺数据的路口显示为畅通（或把畅通的路口判成受限）。
  if (present === 0) {
    return {
      targetId: target.id,
      kind: target.kind,
      level: 'restricted',
      conclusion: `${profile.label}：${name} 属性数据不足，无法判定通过性，按受限处理并建议现地勘察`,
      reasons: [`缺少${relevant.join('、')}等属性，未参与比对`],
      confidence: 0.3
    };
  }

  const candidates = judgeByKind(target, profile);
  const level = candidates.reduce<PassLevel>(
    (worst, item) => (LEVEL_SEVERITY[item.level] > LEVEL_SEVERITY[worst] ? item.level : worst),
    'passable'
  );
  const reasons = candidates.map(item => item.reason);
  if (candidates.length === 0) {
    reasons.push(`已比对${relevant.filter(key => !missing.includes(key)).join('、')}，均满足${profile.label}通行条件`);
  }
  // 数据完备度影响置信度：属性齐、结论可靠；缺关键项时下调并写进依据
  const confidence = Math.min(0.5 + present * 0.15, 0.92);
  if (missing.length > 0) {
    reasons.push(
      `尚有 ${missing.length} 项属性缺失（如${missing.join('、')}），结论置信度按 ${confidence.toFixed(2)} 计`
    );
  }

  const levelText: Record<PassLevel, string> = {
    passable: '判定可通行',
    restricted: '判定为受限通行',
    impassable: '判定不可通行'
  };
  return {
    targetId: target.id,
    kind: target.kind,
    level,
    conclusion: `${profile.label}：${name} ${levelText[level]}（依据 ${reasons.length} 项）`,
    reasons,
    confidence
  };
}
