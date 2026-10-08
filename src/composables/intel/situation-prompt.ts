/**
 * 研判提示词与结构化结论解析（提示词契约版本化在仓库里，不散落在 Dify 控制台）
 *
 * 契约要点：
 *   1. 数值结论由图论/几何规则算出（facts），模型只做归纳、叙述与质疑；
 *   2. 模型若要对结论表态，必须返回 ```situation JSON 块，且 evidenceIds 只能引用上下文里的要素 id；
 *   3. 上下文只给「聚合统计 + 要素摘要 + id」，不给全量坐标。
 *
 * 解析保持宽容：流式中间态、缺字段、非法坐标一律跳过而不是抛错（与既有标绘指令解析同一策略）。
 */

import type { JudgementItem, JudgementTopic, SituationBrief } from './situation-brief';

export const SITUATION_PROMPT_VERSION = 'situation-v1';

const TOPIC_VALUES: JudgementTopic[] = ['passability', 'critical-node', 'risk', 'bypass'];

/** 送给模型的自然语言指令（Dify 的 query） */
export function buildSituationQuery(brief: SituationBrief): string {
  return [
    `请对「${brief.region.name}」开展战场环境分析研判（车辆类型：${brief.vehicle.label}）。`,
    '',
    '要求：',
    '1. 数值型结论（通过性、关键节点、断堵卡风险、临机通路适宜等级）由规则算出，见上下文 facts，不要自行计算或改写数值；',
    '2. 你的任务是归纳结论、指出关键假设与薄弱点、提出需要现地核实的事项（扮演质疑者，而不是复述结论）；',
    '3. 若要对结论表态，请在回复末尾给出 ```situation 代码块，内容为 JSON 数组，元素形如',
    '{"topic":"risk","targetId":"要素id","level":"高","conclusion":"...","evidenceIds":["要素id"],"confidence":0.8}；',
    '4. evidenceIds 只能引用上下文中出现过的要素 id，不得编造。'
  ].join('\n');
}

/** 送给模型的上下文（inputs.context）：聚合统计 + 要素摘要 + id，不含全量坐标 */
export function buildSituationContext(brief: SituationBrief): string {
  return JSON.stringify({
    promptVersion: SITUATION_PROMPT_VERSION,
    region: { name: brief.region.name, areaKm2: brief.region.areaKm2, bounds: brief.region.bounds },
    vehicle: brief.vehicle,
    layers: brief.layers,
    truncated: brief.truncated,
    evidences: brief.evidences.map(item => ({
      id: item.id,
      layer: item.layerName,
      kind: item.kind,
      label: item.label,
      attrs: item.attrs
    })),
    facts: brief.facts.map(item => ({
      topic: item.topic,
      targetId: item.targetId,
      level: item.level,
      conclusion: item.conclusion,
      evidenceIds: item.evidenceIds,
      confidence: item.confidence
    }))
  });
}

/** 从模型回复里抽 JSON 数组（```situation 代码块优先，其次裸数组） */
function extractJsonArray(raw: string): unknown[] | null {
  const fenced = raw.match(/```(?:situation|json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // 流式中间态会解析失败：跳过继续找下一个候选
    }
  }
  return null;
}

/**
 * 解析模型返回的结构化结论。
 *
 * 只接受合法 topic 与非空 evidenceIds 的条目：没有依据的结论不进结果，
 * 这样「引用命中率」度量的确实是模型有没有编造依据，而不是解析器的宽容度。
 */
export function parseSituationItems(raw: string): JudgementItem[] {
  const parsed = extractJsonArray(raw);
  if (!parsed) return [];
  const items: JudgementItem[] = [];
  parsed.forEach(entry => {
    if (typeof entry !== 'object' || entry === null) return;
    const record = entry as Record<string, unknown>;
    const topic = String(record.topic ?? '');
    if (!TOPIC_VALUES.includes(topic as JudgementTopic)) return;
    const evidenceIds = Array.isArray(record.evidenceIds)
      ? record.evidenceIds.map(item => String(item)).filter(item => item !== '')
      : [];
    if (evidenceIds.length === 0) return;
    const confidence = Number(record.confidence);
    items.push({
      topic: topic as JudgementTopic,
      targetId: String(record.targetId ?? evidenceIds[0]),
      level: String(record.level ?? '—'),
      conclusion: String(record.conclusion ?? ''),
      evidenceIds,
      confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.5
    });
  });
  return items;
}

/** 从回复里剥掉结构化块，只留给人看的叙述 */
export function stripSituationBlock(raw: string): string {
  return raw.replace(/```(?:situation|json)?\s*[\s\S]*?```/g, '').trim();
}
