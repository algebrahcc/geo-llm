<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { DecisionLogEntry, JudgementItem } from '@/composables/intel/situation-brief';
import type { VehicleType } from '@/composables/intel/passability';
import type { RegionSelection } from '@/composables/intel/map-selection';

defineOptions({ name: 'SituationPanel' });

const props = defineProps<{
  /** 当前选区（null=未框选） */
  selection: RegionSelection | null;
  selecting: boolean;
  vehicle: VehicleType;
  vehicleLabel: string;
  items: JudgementItem[];
  modelItems: JudgementItem[];
  narrative: string;
  running: boolean;
  modelRunning: boolean;
  notice: string;
  ruleMs: number | null;
  llmMs: number | null;
  citationText: string;
  agreementText: string;
  log: DecisionLogEntry[];
}>();

const emit = defineEmits<{
  'start-select': [];
  'clear-select': [];
  'update:vehicle': [value: VehicleType];
  run: [];
  'run-model': [];
  review: [value: DecisionLogEntry['reviewed']];
  'export-report': [];
  'export-log': [];
  /** 点击依据要素，地图上定位该要素 */
  focus: [evidenceId: string];
}>();

const TOPIC_LABEL: Record<JudgementItem['topic'], string> = {
  passability: '通过性判定',
  'critical-node': '关键节点',
  risk: '断堵卡风险',
  bypass: '临机开设通路'
};

/** 结论分组（保持固定顺序，避免列表随结果数量跳动） */
const grouped = computed(() =>
  (['passability', 'critical-node', 'risk', 'bypass'] as Array<JudgementItem['topic']>)
    .map(topic => ({ topic, label: TOPIC_LABEL[topic], rows: props.items.filter(item => item.topic === topic) }))
    .filter(group => group.rows.length > 0)
);

const levelClass = computed(() => (level: string) => {
  if (['不可通行', '高', '劣'].some(token => level.includes(token))) return 'sp-chip--danger';
  if (['受限通行', '中', '差'].some(token => level.includes(token))) return 'sp-chip--warn';
  return 'sp-chip--ok';
});

const latestLog = computed(() => props.log.slice(0, 5));
</script>

<template>
  <aside class="situation-panel">
    <div class="sp-head">
      <SvgIcon icon="mdi:map-search-outline" />
      <span>环境研判</span>
      <span class="sp-head__ver">规则 + 模型双通道</span>
    </div>

    <!-- ① 研判条件 -->
    <section class="sp-section">
      <h4 class="sp-title">
        <SvgIcon icon="mdi:crosshairs-gps" />
        研判条件
      </h4>
      <div class="sp-row">
        <button type="button" class="sp-btn" :disabled="selecting" @click="emit('start-select')">
          <SvgIcon icon="mdi:vector-square" />
          {{ selecting ? '拖拽框选中…' : '框选区域' }}
        </button>
        <button type="button" class="sp-btn sp-btn--ghost" :disabled="!selection" @click="emit('clear-select')">
          <SvgIcon icon="mdi:close-circle-outline" />
          清除
        </button>
      </div>

      <div v-if="selection" class="sp-condition">
        <div class="sp-condition__row">
          <span>区域</span>
          <strong>{{ selection.name }}</strong>
        </div>
        <div class="sp-condition__row">
          <span>面积</span>
          <strong>{{ selection.areaKm2.toFixed(2) }} km²</strong>
        </div>
        <div class="sp-condition__row">
          <span>要素</span>
          <strong>{{ selection.evidences.length }} 个 · 路网节点 {{ selection.roadNodes.length }}</strong>
        </div>
        <div class="sp-condition__row">
          <span>范围</span>
          <strong>
            {{ selection.bounds[0].toFixed(3) }}, {{ selection.bounds[1].toFixed(3) }} ~
            {{ selection.bounds[2].toFixed(3) }}, {{ selection.bounds[3].toFixed(3) }}
          </strong>
        </div>
      </div>
      <p v-else-if="selecting" class="sp-hint sp-hint--active">
        <SvgIcon icon="mdi:gesture-swipe" />
        在地图上
        <b>按住鼠标左键</b>
        拖出矩形，
        <b>松开即完成</b>
        ；滚轮可缩放调整视野，误点（位移过小）不会产生选区。
      </p>
      <ol v-else class="sp-steps">
        <li>
          <b>①</b>
          点上方「框选区域」
        </li>
        <li>
          <b>②</b>
          在球上按住左键拖出矩形
        </li>
        <li>
          <b>③</b>
          松手即出选区，再点「运行研判」
        </li>
      </ol>

      <div class="sp-vehicle">
        <span class="sp-vehicle__label">车辆类型</span>
        <div class="sp-vehicle__switch">
          <button
            type="button"
            :class="{ 'sp-vehicle__btn--active': vehicle === 'wheeled' }"
            class="sp-vehicle__btn"
            @click="emit('update:vehicle', 'wheeled')"
          >
            轮式
          </button>
          <button
            type="button"
            :class="{ 'sp-vehicle__btn--active': vehicle === 'tracked' }"
            class="sp-vehicle__btn"
            @click="emit('update:vehicle', 'tracked')"
          >
            履带
          </button>
        </div>
      </div>
    </section>

    <!-- ② 运行 -->
    <section class="sp-section">
      <div class="sp-row">
        <button type="button" class="sp-btn sp-btn--primary" :disabled="!selection || running" @click="emit('run')">
          <SvgIcon :icon="running ? 'mdi:loading' : 'mdi:play-circle-outline'" />
          {{ running ? '研判中…' : '运行研判' }}
        </button>
        <button
          type="button"
          class="sp-btn"
          :disabled="!items.length || modelRunning"
          title="把规则结论交给大模型归纳与质疑（需配置 Dify 应用）"
          @click="emit('run-model')"
        >
          <SvgIcon :icon="modelRunning ? 'mdi:loading' : 'mdi:robot-outline'" />
          模型归纳
        </button>
      </div>
      <p v-if="notice" class="sp-notice">{{ notice }}</p>
    </section>

    <!-- ③ 结论 -->
    <section class="sp-section sp-section--grow">
      <h4 class="sp-title">
        <SvgIcon icon="mdi:clipboard-check-outline" />
        研判结论
        <span v-if="items.length" class="sp-title__count">{{ items.length }} 条</span>
      </h4>
      <div v-if="!grouped.length" class="sp-hint">运行研判后在此逐条给出结论、等级与依据。</div>
      <div v-for="group in grouped" :key="group.topic" class="sp-group">
        <div class="sp-group__head">{{ group.label }}</div>
        <article v-for="(item, index) in group.rows" :key="`${group.topic}-${index}`" class="sp-card">
          <header class="sp-card__head">
            <span class="sp-chip" :class="levelClass(item.level)">{{ item.level }}</span>
            <span class="sp-card__target">{{ item.targetId }}</span>
            <span class="sp-card__conf">置信度 {{ item.confidence.toFixed(2) }}</span>
          </header>
          <p class="sp-card__text">{{ item.conclusion }}</p>
          <div class="sp-card__evidence">
            <span>依据：</span>
            <button
              v-for="id in item.evidenceIds"
              :key="id"
              type="button"
              class="sp-evidence"
              :title="`定位要素 ${id}`"
              @click="emit('focus', id)"
            >
              {{ id }}
            </button>
          </div>
        </article>
      </div>

      <div v-if="narrative || modelItems.length" class="sp-model">
        <div class="sp-group__head">模型归纳与质疑</div>
        <p v-if="narrative" class="sp-model__text">{{ narrative }}</p>
        <p v-if="modelItems.length" class="sp-model__meta">
          模型给出 {{ modelItems.length }} 条结构化表态，一致率见下方质效读数
        </p>
      </div>
    </section>

    <!-- ④ 质效读数 -->
    <section class="sp-section">
      <h4 class="sp-title">
        <SvgIcon icon="mdi:speedometer" />
        质效读数
      </h4>
      <div class="sp-metrics">
        <div class="sp-metric">
          <span>规则耗时</span>
          <strong>{{ ruleMs === null ? '—' : `${ruleMs}ms` }}</strong>
        </div>
        <div class="sp-metric">
          <span>模型耗时</span>
          <strong>{{ llmMs === null ? '—' : `${llmMs}ms` }}</strong>
        </div>
        <div class="sp-metric">
          <span>引用命中率</span>
          <strong>{{ citationText }}</strong>
        </div>
        <div class="sp-metric">
          <span>与规则一致率</span>
          <strong>{{ agreementText }}</strong>
        </div>
      </div>
      <div class="sp-row">
        <button type="button" class="sp-btn sp-btn--ghost" :disabled="!log.length" @click="emit('review', 'accepted')">
          <SvgIcon icon="mdi:check" />
          采纳
        </button>
        <button type="button" class="sp-btn sp-btn--ghost" :disabled="!log.length" @click="emit('review', 'rejected')">
          <SvgIcon icon="mdi:close" />
          否决
        </button>
      </div>
      <div class="sp-row">
        <button type="button" class="sp-btn" :disabled="!items.length" @click="emit('export-report')">
          <SvgIcon icon="mdi:file-document-outline" />
          导出报告
        </button>
        <button type="button" class="sp-btn sp-btn--ghost" :disabled="!log.length" @click="emit('export-log')">
          <SvgIcon icon="mdi:history" />
          决策日志
        </button>
      </div>
    </section>

    <!-- ⑤ 决策日志 -->
    <section v-if="latestLog.length" class="sp-section">
      <h4 class="sp-title">
        <SvgIcon icon="mdi:notebook-outline" />
        决策日志
      </h4>
      <ul class="sp-log">
        <li v-for="entry in latestLog" :key="entry.id">
          <span class="sp-log__time">{{ entry.time }}</span>
          <span class="sp-log__text">{{ entry.trigger }}</span>
          <span class="sp-log__state" :class="`sp-log__state--${entry.reviewed}`">
            {{ entry.reviewed === 'pending' ? '待复核' : entry.reviewed === 'accepted' ? '已采纳' : '已否决' }}
          </span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped lang="scss">
.situation-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 380px;
  max-height: calc(100% - 32px);
  padding: 12px;
  border: 1px solid rgb(43 131 255 / 32%);
  border-radius: 8px;
  background: linear-gradient(180deg, rgb(4 20 44 / 96%), rgb(2 14 30 / 96%));
  box-shadow: 0 12px 40px rgb(0 0 0 / 50%);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: rgb(43 131 255 / 35%);
  }
}

.sp-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(43 131 255 / 22%);
  color: #e6edf3;
  font-size: 14px;
  font-weight: 600;

  &__ver {
    margin-left: auto;
    color: #7f9cbb;
    font-size: 11px;
    font-weight: 400;
  }
}

.sp-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &--grow {
    flex: 1;
    min-height: 0;
  }
}

.sp-title {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: #9fb3c8;
  font-size: 12px;
  font-weight: 600;

  &__count {
    margin-left: auto;
    color: #58a6ff;
    font-size: 11px;
  }
}

.sp-row {
  display: flex;
  gap: 8px;
}

.sp-btn {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid rgb(43 131 255 / 40%);
  border-radius: 5px;
  background: rgb(43 131 255 / 12%);
  color: #cfe6ff;
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;

  &:hover:not(:disabled) {
    border-color: rgb(43 131 255 / 75%);
    background: rgb(43 131 255 / 24%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &--primary {
    border-color: rgb(34 211 238 / 55%);
    background: rgb(34 211 238 / 16%);
    color: #b8f1ff;

    &:hover:not(:disabled) {
      border-color: rgb(34 211 238 / 85%);
      background: rgb(34 211 238 / 28%);
    }
  }

  &--ghost {
    border-color: rgb(255 255 255 / 16%);
    background: rgb(255 255 255 / 4%);
    color: #9fb3c8;
  }
}

.sp-condition {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgb(43 131 255 / 20%);
  border-radius: 6px;
  background: rgb(4 20 44 / 60%);

  &__row {
    display: flex;
    justify-content: space-between;
    color: #7f9cbb;
    font-size: 11px;

    strong {
      color: #dbe9f7;
      font-weight: 500;
    }
  }
}

.sp-vehicle {
  display: flex;
  align-items: center;
  gap: 8px;

  &__label {
    color: #7f9cbb;
    font-size: 11px;
  }

  &__switch {
    display: flex;
    overflow: hidden;
    border: 1px solid rgb(43 131 255 / 35%);
    border-radius: 5px;
  }

  &__btn {
    padding: 4px 12px;
    border: none;
    background: transparent;
    color: #9fb3c8;
    font-size: 12px;
    cursor: pointer;

    &--active {
      background: rgb(34 211 238 / 22%);
      color: #b8f1ff;
    }
  }
}

.sp-hint {
  margin: 0;
  color: #7f9cbb;
  font-size: 11px;
  line-height: 1.6;

  &--active {
    display: flex;
    gap: 6px;
    padding: 7px 8px;
    border: 1px solid rgb(34 211 238 / 40%);
    border-radius: 5px;
    background: rgb(34 211 238 / 10%);
    color: #b8f1ff;
  }

  b {
    color: #e6edf3;
  }
}

.sp-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 8px 10px 8px 26px;
  border: 1px dashed rgb(43 131 255 / 35%);
  border-radius: 6px;
  background: rgb(43 131 255 / 6%);
  color: #9fb3c8;
  font-size: 11px;
  line-height: 1.7;

  b {
    margin-right: 2px;
    color: #58a6ff;
  }
}

.sp-notice {
  margin: 0;
  padding: 6px 8px;
  border-left: 2px solid #f0b866;
  background: rgb(240 184 102 / 8%);
  color: #f0b866;
  font-size: 11px;
  line-height: 1.6;
}

.sp-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;

  &__head {
    color: #58a6ff;
    font-size: 11px;
  }
}

.sp-card {
  padding: 8px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 6px;
  background: rgb(255 255 255 / 3%);
  transition: border-color 0.18s ease;

  &:hover {
    border-color: rgb(43 131 255 / 55%);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }

  &__target {
    color: #dbe9f7;
    font-size: 11px;
  }

  &__conf {
    margin-left: auto;
    color: #7f9cbb;
    font-size: 10px;
  }

  &__text {
    margin: 0 0 6px;
    color: #c2d4e6;
    font-size: 12px;
    line-height: 1.65;
  }

  &__evidence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    color: #7f9cbb;
    font-size: 10px;
  }
}

.sp-chip {
  padding: 1px 6px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 3px;
  font-size: 10px;

  &--ok {
    border-color: rgb(126 231 135 / 45%);
    color: #b6f0bd;
  }

  &--warn {
    border-color: rgb(240 184 102 / 45%);
    color: #f0b866;
  }

  &--danger {
    border-color: rgb(240 112 112 / 45%);
    color: #f07070;
  }
}

.sp-evidence {
  padding: 1px 6px;
  border: 1px dashed rgb(43 131 255 / 45%);
  border-radius: 3px;
  background: transparent;
  color: #8db8ff;
  font-family: Consolas, Menlo, monospace;
  font-size: 10px;
  cursor: pointer;

  &:hover {
    border-style: solid;
    background: rgb(43 131 255 / 18%);
  }
}

.sp-model {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgb(255 255 255 / 8%);

  &__text {
    margin: 0;
    color: #c2d4e6;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  &__meta {
    margin: 4px 0 0;
    color: #7f9cbb;
    font-size: 10px;
  }
}

.sp-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.sp-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 5px;
  background: rgb(255 255 255 / 3%);

  span {
    color: #7f9cbb;
    font-size: 10px;
  }

  strong {
    color: #dbe9f7;
    font-size: 13px;
    font-weight: 600;
  }
}

.sp-log {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
  }

  &__time {
    color: #7f9cbb;
  }

  &__text {
    flex: 1;
    overflow: hidden;
    color: #c2d4e6;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    padding: 0 4px;
    border-radius: 3px;

    &--pending {
      background: rgb(240 184 102 / 16%);
      color: #f0b866;
    }

    &--accepted {
      background: rgb(126 231 135 / 16%);
      color: #b6f0bd;
    }

    &--rejected {
      background: rgb(240 112 112 / 16%);
      color: #f07070;
    }
  }
}
</style>
