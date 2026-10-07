<script setup lang="ts">
/**
 * 街景自检预览弹窗
 *
 * 为什么需要它：街景的失败原因几乎都不在页面上（rid 无效、服务没起、跨域被拦、
 * 图片命名对不上），而球上只表现为「点不动 / 弹不出来」。这里把三步（点位查询 →
 * 最近点解析 → 全景图请求）逐步跑一遍并计时，配上首个点位的缩略图，
 * 让「配得对不对」一眼可见，而不是靠猜。
 *
 * 与球上加载共用同一套来源判定（source-factory），因此自检结论与实际加载一致。
 */
import { computed, ref, watch } from 'vue';
import { resolveServiceUrl } from '@/composables/cesium/service-loader';
import { distanceMeters } from '@/composables/cesium/streetview/geo';
import { createStreetViewSourceOf } from '@/composables/cesium/streetview/source-factory';
import {
  StreetViewError,
  type StreetViewErrorKind,
  type StreetViewPoint
} from '@/composables/cesium/streetview/service-api';

interface Props {
  show: boolean;
  service: Api.DataService.DataServiceItem | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:show': [value: boolean] }>();

defineOptions({ name: 'StreetviewSelfcheck' });

type StepStatus = 'pending' | 'running' | 'ok' | 'fail';

interface CheckStep {
  key: 'points' | 'resolve' | 'image';
  label: string;
  status: StepStatus;
  detail: string;
  durationMs: number | null;
}

/** 失败原因 → 可执行的下一步（只说"失败"等于没说） */
const ADVICE: Record<StreetViewErrorKind, string> = {
  'no-rid': '在线服务需要在「连接参数」里填 rid；若用本地数据，把服务地址改成 data/streetview/<目录> 这类相对路径',
  unreachable: '地址不通：确认服务已启动；在线服务还需服务端允许跨域（CORS）',
  http: '请求被拒绝：核对服务地址与 rid，并确认全景图级别（level）合法',
  'bad-data': '返回内容不是合法 JSON/GeoJSON：确认该地址确实是街景服务端点',
  'no-points': '该区域没有街景点：核对 rid 是否正确，或检查本地目录的点位文件是否有内容',
  'no-nearest': '首个街景点取不到全景图：检查点位坐标与图片命名是否一一对应'
};

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
});

const steps = ref<CheckStep[]>(createSteps());
const running = ref(false);
const summary = ref<{ points: number; bbox: string; spanKm: string; durationMs: number } | null>(null);
const thumbnailUrl = ref('');
const thumbnailFailed = ref(false);
const failure = ref<{ message: string; advice: string } | null>(null);

function createSteps(): CheckStep[] {
  return [
    { key: 'points', label: '点位查询', status: 'pending', detail: '等待执行', durationMs: null },
    { key: 'resolve', label: '就近取图', status: 'pending', detail: '等待执行', durationMs: null },
    { key: 'image', label: '全景图请求', status: 'pending', detail: '等待执行', durationMs: null }
  ];
}

function stepOf(key: CheckStep['key']): CheckStep {
  const found = steps.value.find(item => item.key === key);
  if (!found) throw new Error(`缺少自检步骤：${key}`);
  return found;
}

function markStep(key: CheckStep['key'], status: StepStatus, detail: string, durationMs: number | null = null): void {
  const step = stepOf(key);
  step.status = status;
  step.detail = detail;
  step.durationMs = durationMs;
}

/** 用 Image 预加载统计「这张图到底能不能拿到」（含跨域与 404） */
function probeImage(url: string): Promise<{ ok: boolean; message: string; durationMs: number }> {
  return new Promise(resolve => {
    const started = performance.now();
    const image = new Image();
    image.addEventListener('load', () =>
      resolve({ ok: true, message: '图片已加载', durationMs: performance.now() - started })
    );
    image.addEventListener('error', () =>
      resolve({
        ok: false,
        message: '图片无法加载（路径不存在、不是图片，或未允许跨域）',
        durationMs: performance.now() - started
      })
    );
    image.src = url;
  });
}

function describeBounds(points: StreetViewPoint[]): { bbox: string; spanKm: string } {
  if (points.length === 0) return { bbox: '—', spanKm: '—' };
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  points.forEach(point => {
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
  });
  const span = distanceMeters(minLon, minLat, maxLon, maxLat) / 1000;
  return {
    bbox: `${minLon.toFixed(4)}, ${minLat.toFixed(4)} ~ ${maxLon.toFixed(4)}, ${maxLat.toFixed(4)}`,
    spanKm: `${span.toFixed(2)} km`
  };
}

async function run(): Promise<void> {
  const service = props.service;
  if (!service || running.value) return;

  running.value = true;
  steps.value = createSteps();
  summary.value = null;
  thumbnailUrl.value = '';
  thumbnailFailed.value = false;
  failure.value = null;

  const startedAll = performance.now();
  try {
    const source = createStreetViewSourceOf(service, resolveServiceUrl(service));

    markStep('points', 'running', '正在拉取街景点…');
    const startedPoints = performance.now();
    const points = await source.fetchPoints();
    markStep('points', 'ok', `共 ${points.length} 个街景点`, performance.now() - startedPoints);

    const bounds = describeBounds(points);
    summary.value = {
      points: points.length,
      bbox: bounds.bbox,
      spanKm: bounds.spanKm,
      durationMs: performance.now() - startedAll
    };

    const first = points[0];
    markStep('resolve', 'running', '正在解析首个点位的全景图地址…');
    const startedResolve = performance.now();
    const image = await source.resolveImage(first.lon, first.lat);
    markStep('resolve', 'ok', `geoid ${image.geoid}`, performance.now() - startedResolve);

    thumbnailUrl.value = image.imageUrl;
    markStep('image', 'running', '正在请求全景图…');
    const probe = await probeImage(image.imageUrl);
    if (probe.ok) {
      markStep('image', 'ok', probe.message, probe.durationMs);
    } else {
      markStep('image', 'fail', probe.message, probe.durationMs);
      thumbnailFailed.value = true;
    }
  } catch (e) {
    const isStreetViewError = e instanceof StreetViewError;
    const kind: StreetViewErrorKind = isStreetViewError ? e.kind : 'http';
    const message = e instanceof Error ? e.message : '自检失败';
    const pending =
      steps.value.find(step => step.status === 'running') ?? steps.value.find(step => step.status === 'pending');
    if (pending) markStep(pending.key, 'fail', message);
    failure.value = { message, advice: ADVICE[kind] };
  } finally {
    if (summary.value) summary.value.durationMs = performance.now() - startedAll;
    running.value = false;
  }
}

/** 每次打开都重跑：用户往往刚改完参数就来点自检 */
watch(
  () => props.show,
  value => {
    if (value) void run();
  }
);
</script>

<template>
  <NModal v-model:show="visible" :mask-closable="!running">
    <div class="sv-check">
      <header class="sv-check__head">
        <div class="sv-check__title">
          <span>街景自检</span>
          <span class="sv-check__name">{{ service?.name ?? '未选择服务' }}</span>
        </div>
        <button type="button" class="sv-check__close" title="关闭" @click="visible = false">
          <SvgIcon icon="mdi:close" />
        </button>
      </header>

      <div class="sv-check__body">
        <div class="sv-check__metrics">
          <div class="sv-metric">
            <span class="sv-metric__label">街景点数</span>
            <strong class="sv-metric__value">{{ summary?.points ?? '--' }}</strong>
          </div>
          <div class="sv-metric">
            <span class="sv-metric__label">覆盖跨度</span>
            <strong class="sv-metric__value">{{ summary?.spanKm ?? '--' }}</strong>
          </div>
          <div class="sv-metric">
            <span class="sv-metric__label">总耗时</span>
            <strong class="sv-metric__value">
              {{ summary ? `${Math.round(summary.durationMs)} ms` : '--' }}
            </strong>
          </div>
          <div class="sv-metric">
            <span class="sv-metric__label">状态</span>
            <strong class="sv-metric__value" :class="{ 'sv-metric__value--fail': failure }">
              {{ failure ? '未通过' : running ? '检测中' : '通过' }}
            </strong>
          </div>
        </div>

        <p v-if="summary" class="sv-check__bounds">范围 {{ summary.bbox }}</p>

        <div class="sv-check__grid">
          <div class="sv-thumb">
            <img
              v-if="thumbnailUrl && !thumbnailFailed"
              :src="thumbnailUrl"
              alt="首个街景点全景图缩略图"
              @error="thumbnailFailed = true"
            />
            <div v-else class="sv-thumb__empty">
              {{ running ? '正在获取全景图…' : '暂无可预览的全景图' }}
            </div>
            <span v-if="thumbnailUrl" class="sv-thumb__caption">首个街景点全景图（缩略）</span>
          </div>

          <ul class="sv-steps">
            <li v-for="step in steps" :key="step.key" class="sv-steps__item" :class="`sv-steps__item--${step.status}`">
              <span class="sv-steps__dot" />
              <div class="sv-steps__text">
                <span class="sv-steps__label">{{ step.label }}</span>
                <span class="sv-steps__detail">{{ step.detail }}</span>
              </div>
              <span class="sv-steps__time">
                {{ step.durationMs === null ? '' : `${Math.round(step.durationMs)} ms` }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="failure" class="sv-check__failure">
          <strong>{{ failure.message }}</strong>
          <span>{{ failure.advice }}</span>
        </div>
      </div>

      <footer class="sv-check__foot">
        <span class="sv-check__hint">自检与三维球上加载使用同一套数据来源判定，结论一致</span>
        <button type="button" class="sv-check__btn" :disabled="running" @click="run">
          {{ running ? '检测中…' : '重新自检' }}
        </button>
      </footer>
    </div>
  </NModal>
</template>

<style scoped>
.sv-check {
  width: min(720px, calc(100vw - 48px));
  border: 1px solid rgba(43, 131, 255, 0.32);
  border-radius: 10px;
  background: rgba(4, 17, 34, 0.98);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
  color: rgba(214, 237, 255, 0.92);
  overflow: hidden;
}

.sv-check__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(5, 24, 46, 0.98), rgba(5, 24, 46, 0.72));
  border-bottom: 1px solid rgba(43, 131, 255, 0.28);
}

.sv-check__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
}

.sv-check__name {
  font-family: 'DIN', Consolas, monospace;
  font-size: 12px;
  font-weight: 500;
  color: rgba(147, 196, 255, 0.75);
}

.sv-check__close {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(45, 111, 183, 0.35);
  border-radius: 6px;
  background: rgba(6, 25, 50, 0.7);
  color: #cbe3ff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sv-check__close:hover {
  color: #29a3ff;
  border-color: rgba(70, 176, 255, 0.5);
}

.sv-check__body {
  padding: 14px 16px;
}

.sv-check__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.sv-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid rgba(43, 131, 255, 0.22);
  border-radius: 6px;
  background: rgba(6, 22, 44, 0.7);
}

.sv-metric__label {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.7);
}

.sv-metric__value {
  font-family: 'DIN', Consolas, monospace;
  font-size: 15px;
}

.sv-metric__value--fail {
  color: #ff5c6c;
}

.sv-check__bounds {
  margin: 10px 0 0;
  font-family: 'DIN', Consolas, monospace;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.65);
}

.sv-check__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.sv-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 1px solid rgba(43, 131, 255, 0.22);
  border-radius: 8px;
  overflow: hidden;
  background: #06192f;
}

.sv-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sv-thumb__empty {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 12px;
  color: rgba(147, 196, 255, 0.55);
}

.sv-thumb__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 8px;
  font-size: 11px;
  color: #cbe3ff;
  background: linear-gradient(180deg, transparent, rgba(2, 10, 20, 0.88));
}

.sv-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sv-steps__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(43, 131, 255, 0.18);
  border-radius: 6px;
  background: rgba(6, 22, 44, 0.55);
}

.sv-steps__dot {
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
  background: rgba(147, 196, 255, 0.5);
  flex-shrink: 0;
}

.sv-steps__item--running .sv-steps__dot {
  background: #29a3ff;
  animation: sv-pulse 1.2s ease-in-out infinite;
}

.sv-steps__item--ok .sv-steps__dot {
  background: #52d68a;
}

.sv-steps__item--fail .sv-steps__dot {
  background: #ff5c6c;
}

.sv-steps__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.sv-steps__label {
  font-size: 12px;
  font-weight: 600;
}

.sv-steps__detail {
  font-size: 11px;
  line-height: 1.5;
  color: rgba(147, 196, 255, 0.7);
  word-break: break-all;
}

.sv-steps__time {
  font-family: 'DIN', Consolas, monospace;
  font-size: 11px;
  color: rgba(147, 196, 255, 0.6);
  white-space: nowrap;
}

.sv-check__failure {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 92, 108, 0.35);
  border-radius: 6px;
  background: rgba(255, 92, 108, 0.08);
  font-size: 12px;
}

.sv-check__failure strong {
  color: #ff8a95;
}

.sv-check__failure span {
  color: rgba(214, 237, 255, 0.8);
  line-height: 1.6;
}

.sv-check__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid rgba(43, 131, 255, 0.22);
  background: rgba(5, 20, 38, 0.6);
}

.sv-check__hint {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.6);
}

.sv-check__btn {
  padding: 7px 16px;
  border: 1px solid rgba(70, 176, 255, 0.45);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.16);
  color: #8dc4ff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sv-check__btn:hover:not(:disabled) {
  color: #eaf5ff;
  border-color: rgba(70, 176, 255, 0.75);
}

.sv-check__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .sv-check__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sv-check__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@keyframes sv-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
