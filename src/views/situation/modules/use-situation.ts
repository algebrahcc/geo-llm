/**
 * 环境研判页编排：选区 → 上下文装配 → 规则研判 → （可选）模型归纳 → 结论落图与报告
 *
 * 两个通道严格分工，界面也分开显示：
 *   规则通道  算出四类结论（通过性/关键节点/断堵卡风险/临机通路适宜等级），可复算、可追溯；
 *   模型通道  只做归纳、质疑与风险提示，其结构化表态单独比对一致率，不覆盖规则结论。
 *
 * 质效读数（实时性/可追溯性/一致性）在每次运行后落成决策日志，可从界面导出归档。
 */

import { computed, ref } from 'vue';
import { useCesiumBase } from '@/composables/cesium/use-cesium-base';
import { useCesiumRegionSelect } from '@/composables/cesium/use-cesium-region-select';
import { useCesiumServices } from '@/composables/cesium/use-cesium-services';
import { VEHICLE_PROFILE, type VehicleType } from '@/composables/intel/passability';
import {
  assembleBrief,
  citationHitRate,
  ruleAgreementRate,
  type ConclusionOverlay,
  type DecisionLogEntry,
  type JudgementItem,
  type SituationBrief
} from '@/composables/intel/situation-brief';
import { runRuleEngine } from '@/composables/intel/situation-engine';
import {
  buildSituationContext,
  buildSituationQuery,
  parseSituationItems,
  stripSituationBlock
} from '@/composables/intel/situation-prompt';
import {
  buildDecisionLogMarkdown,
  buildSituationReportHtml,
  downloadText,
  type ReportMetrics
} from '@/composables/intel/situation-report';
import { fetchEnabledDataServices } from '@/service/api/dataservice';
import { fetchDifyChatStream } from '@/service/api/dify-stream';
import { unwrapResponseData } from '@/service/request/envelope';
import { Cartesian2, Cartesian3, Color, LabelStyle } from 'cesium';

/** 结论图层配色：通过性蓝、风险橙、关键节点紫、通路绿 */
const OVERLAY_COLOR = '#f0b866';

export function useSituation() {
  const base = useCesiumBase();
  const services = useCesiumServices(base);
  const region = useCesiumRegionSelect();

  const vehicle = ref<VehicleType>('tracked');
  const brief = ref<SituationBrief | null>(null);
  const items = ref<JudgementItem[]>([]);
  const narrative = ref('');
  const modelItems = ref<JudgementItem[]>([]);
  const running = ref(false);
  const modelRunning = ref(false);
  const notice = ref('');
  const metrics = ref<ReportMetrics | null>(null);
  const log = ref<DecisionLogEntry[]>([]);

  const vehicleLabel = computed(() => VEHICLE_PROFILE[vehicle.value].label);
  const hasSelection = computed(() => region.selection.value !== null);
  const citationText = computed(() => (metrics.value ? `${(metrics.value.citation * 100).toFixed(0)}%` : '—'));
  const agreementText = computed(() =>
    metrics.value === null || metrics.value.agreement === null
      ? '未返回结构化结论'
      : `${(metrics.value.agreement * 100).toFixed(0)}%`
  );

  /** 加载场景图层（矢量类数据服务）：有要素才谈得上圈选研判 */
  async function loadLayers(): Promise<void> {
    const list = unwrapResponseData<Api.DataService.DataServiceItem[]>(await fetchEnabledDataServices()) ?? [];
    await services.loadEnabled('vector', list);
  }

  /** 把结论要素落到地图上（点 + 标签） */
  function drawOverlays(): void {
    const viewer = base.viewerRef.value;
    if (!viewer) return;
    viewer.entities.values
      .filter(entity => entity.name === '研判结论')
      .forEach(entity => viewer.entities.remove(entity));
    const color = Color.fromCssColorString(OVERLAY_COLOR);
    items.value.forEach(item => {
      const overlay = currentOverlays.find(candidate => candidate.targetId === item.targetId);
      if (!overlay) return;
      const [lon, lat] = overlay.positions[0];
      viewer.entities.add({
        name: '研判结论',
        position: Cartesian3.fromDegrees(lon, lat),
        point: { pixelSize: 9, color, outlineColor: Color.WHITE, outlineWidth: 1 },
        label: {
          text: `${item.level}`,
          font: '12px sans-serif',
          style: LabelStyle.FILL_AND_OUTLINE,
          fillColor: Color.WHITE,
          outlineColor: Color.fromCssColorString('#0b1622'),
          outlineWidth: 3,
          pixelOffset: new Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });
    viewer.scene.requestRender();
  }

  let currentOverlays: ConclusionOverlay[] = [];

  /** 运行规则通道：装配上下文 → 算四类结论 → 落图 → 记质效与决策日志 */
  function runRules(): void {
    const selection = region.selection.value;
    if (!selection) {
      notice.value = '请先在地图上框选研判区域';
      return;
    }
    running.value = true;
    notice.value = '';
    const built = assembleBrief({
      region: { name: selection.name, bounds: selection.bounds },
      evidences: selection.evidences,
      vehicle: { type: vehicle.value, label: vehicleLabel.value }
    });
    const result = runRuleEngine({
      brief: built,
      targets: selection.targets,
      roadNodes: selection.roadNodes,
      roadEdges: selection.roadEdges,
      vehicle: vehicle.value
    });
    brief.value = { ...built, facts: result.facts };
    items.value = result.conclusion.items;
    currentOverlays = result.conclusion.overlays;
    narrative.value = '';
    modelItems.value = [];
    metrics.value = {
      ruleMs: result.durationMs,
      llmMs: null,
      citation: citationHitRate(result.conclusion.items, built),
      agreement: null
    };
    recordLog(result.durationMs);
    running.value = false;
    drawOverlays();

    if (items.value.length === 0) {
      notice.value = '选区内没有可研判的要素：请选择带路网/桥梁属性的图层，或放大范围后重选';
    }
  }

  function recordLog(ruleMs: number): void {
    const selection = region.selection.value;
    const entry: DecisionLogEntry = {
      id: `log-${Date.now()}`,
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      trigger: `框选研判区 · ${vehicleLabel.value} · 规则通道 ${ruleMs}ms`,
      region: selection?.name ?? '—',
      vehicle: vehicleLabel.value,
      conclusionCount: items.value.length,
      citationHitRate: metrics.value?.citation ?? 0,
      reviewed: 'pending'
    };
    log.value = [entry, ...log.value].slice(0, 20);
  }

  /** 模型通道：把规则结论交给模型归纳与质疑，并把它的结构化表态与规则基线比对 */
  async function runModel(): Promise<void> {
    const currentBrief = brief.value;
    if (!currentBrief) {
      notice.value = '请先运行规则研判';
      return;
    }
    modelRunning.value = true;
    notice.value = '';
    narrative.value = '';
    const startedAt = performance.now();
    let text = '';
    let firstTokenMs: number | null = null;
    try {
      await fetchDifyChatStream(
        {
          userId: 'situation-workbench',
          query: buildSituationQuery(currentBrief),
          conversationId: '',
          inputs: { context: buildSituationContext(currentBrief) }
        },
        {
          onDelta: delta => {
            if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - startedAt);
            text += delta;
            narrative.value = stripSituationBlock(text);
          }
        }
      );
      modelItems.value = parseSituationItems(text);
      if (metrics.value) {
        metrics.value = {
          ...metrics.value,
          llmMs: Math.round(performance.now() - startedAt),
          agreement: modelItems.value.length > 0 ? ruleAgreementRate(modelItems.value, currentBrief.facts) : null
        };
      }
      if (modelItems.value.length > 0) {
        const modelCitation = citationHitRate(modelItems.value, currentBrief);
        const last = log.value[0];
        if (last) {
          log.value = [
            { ...last, trigger: `${last.trigger} · 模型通道引用命中 ${(modelCitation * 100).toFixed(0)}%` },
            ...log.value.slice(1)
          ];
        }
      }
      if (!text.trim()) {
        notice.value = '模型未返回内容：请确认 Dify 应用已配置（智能体页）';
      }
    } catch (error) {
      console.error('模型通道运行失败', error);
      notice.value = '模型通道不可用（未配置 Dify 应用时属正常），规则结论仍然有效';
    } finally {
      modelRunning.value = false;
    }
  }

  /** 复核：采纳/否决当前结论（写入决策日志，报告里可见） */
  function review(reviewed: DecisionLogEntry['reviewed']): void {
    const last = log.value[0];
    if (!last) return;
    log.value = [{ ...last, reviewed }, ...log.value.slice(1)];
    notice.value =
      reviewed === 'accepted'
        ? '已记录：结论被采纳'
        : reviewed === 'rejected'
          ? '已记录：结论被否决'
          : '已重置为待复核';
  }

  /** 导出分析报告（含选区条件、四类结论、模型叙述、质效读数、决策日志） */
  function exportReport(): void {
    if (!brief.value || !metrics.value) return;
    const html = buildSituationReportHtml({
      brief: brief.value,
      items: items.value,
      narrative: narrative.value,
      metrics: metrics.value,
      log: log.value
    });
    downloadText(`战场环境分析研判报告-${Date.now()}.html`, html, 'text/html');
  }

  function exportLog(): void {
    downloadText(`研判决策日志-${Date.now()}.md`, buildDecisionLogMarkdown(log.value), 'text/markdown');
  }

  return {
    // viewer
    containerRef: base.containerRef,
    viewerRef: base.viewerRef,
    cursorCoordinates: base.cursorCoordinates,
    initViewer: base.initViewer,
    requestRender: base.requestRender,
    // 图层与选区
    loadLayers,
    startSelect: () => {
      const viewer = base.viewerRef.value;
      if (viewer) region.startDraw(viewer);
    },
    clearSelect: () => {
      region.clear(base.viewerRef.value ?? undefined);
      brief.value = null;
      items.value = [];
      narrative.value = '';
      modelItems.value = [];
      metrics.value = null;
      notice.value = '';
    },
    selection: region.selection,
    selectDrawing: region.drawing,
    hasSelection,
    // 研判
    vehicle,
    vehicleLabel,
    brief,
    items,
    modelItems,
    narrative,
    running,
    modelRunning,
    notice,
    metrics,
    log,
    citationText,
    agreementText,
    runRules,
    runModel,
    review,
    exportReport,
    exportLog
  };
}
