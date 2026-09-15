<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Cartesian2, Cartographic, Math as CesiumMath, type Viewer } from 'cesium';
import {
  BeidouGrid,
  MAX_HEIGHT_LAYERS,
  type BeidouGridMode,
  type BeidouGridStats,
  type GridPickResult
} from './beidou-grid';
import { parseGridCode } from './beidou-grid-code';
import { MAX_LOCAL_CELLS, estimateGridCells } from './beidou-grid-geometry';

defineOptions({ name: 'BeidouGridPanel' });

const props = withDefaults(
  defineProps<{
    /** 原生 Cesium Viewer 实例（由宿主页面透传） */
    viewer: Viewer | null;
    collapsed?: boolean;
  }>(),
  { collapsed: false }
);

const emit = defineEmits<{ close: []; 'toggle-collapse': [] }>();

/** 网格类型：二维随地图自适应渲染；立体按指定范围生成，带高度分层 */
type GridType = '2d' | '3d';

/** 层级选项：到 7 级即止（8~10 级约米—厘米级，铺开无实际意义且几何量指数增长） */
const LEVEL_OPTIONS = [
  { value: 1, brief: '1 级', desc: '6° × 4°（约 667 km）' },
  { value: 2, brief: '2 级', desc: '30′ × 30′（约 55 km）' },
  { value: 3, brief: '3 级', desc: '15′ × 10′（约 18 km）' },
  { value: 4, brief: '4 级', desc: '1′ × 1′（约 1.8 km）' },
  { value: 5, brief: '5 级', desc: '4″ × 4″（约 120 m）' },
  { value: 6, brief: '6 级', desc: '2″ × 2″（约 60 m）' },
  { value: 7, brief: '7 级', desc: '0.25″ × 0.25″（约 7.5 m）' }
];
const MAX_LEVEL_OPTION = LEVEL_OPTIONS.length;

/** 高度层数选项：1 层即贴地平面，故自 2 层起 */
const LAYER_OPTIONS = Array.from({ length: MAX_HEIGHT_LAYERS - 1 }, (_, index) => index + 2);
const DEFAULT_LAYERS = 4;

/** 默认生成范围：全国 */
const DEFAULT_RANGE = { west: 70, south: 12, east: 134, north: 53 };
/** 全球范围：1 级即 60 × 45 = 2700 格，在上限内，是全球视野下可行的最细层级 */
const GLOBAL_RANGE = { west: -180, south: -90, east: 180, north: 90 };

const gridType = ref<GridType>('2d');
const levelSetting = ref<number | 'auto'>('auto');
const heightLayers = ref(DEFAULT_LAYERS);
const showOutline = ref(true);
const showFaces = ref(false);
const labelsEnabled = ref(false);
const pickEnabled = ref(false);
const localRange = reactive({ ...DEFAULT_RANGE });
const generating = ref(false);
const localCellCount = ref(0);
const stats = ref<BeidouGridStats | null>(null);
const pickResult = ref<GridPickResult | null>(null);
const codeInput = ref('');
const codeFeedback = ref('');
const queryLon = ref<number | null>(null);
const queryLat = ref<number | null>(null);
const queryLevel = ref(5);
const readoutRef = ref<HTMLElement | null>(null);

// 重对象不入响应式：仅保存实例引用
let grid: BeidouGrid | null = null;
let unsubscribePick: (() => void) | null = null;
let statsTimer: number | null = null;

const gridReady = computed(() => props.viewer != null);
const isSolid = computed(() => gridType.value === '3d');
/** 渲染模式：二维走瓦片自适应，立体走几何生成 */
const renderMode = computed<BeidouGridMode>(() => (isSolid.value ? 'geometry' : 'tile'));
/** 立体层数：二维恒为 1（贴地平面） */
const solidLayers = computed(() => (isSolid.value ? heightLayers.value : 1));

/**
 * 自适应层级：取格数不超上限的最细层级。
 * 全球范围下 2 级已达 25.9 万格，故自动落到最粗的 1 级（2700 格），
 * 使立体网格在任意视野尺度下都可生成。
 */
const autoLevel = computed(() => {
  for (let level = MAX_LEVEL_OPTION; level > 1; level--) {
    if (estimateGridCells({ ...localRange }, level).cells <= MAX_LOCAL_CELLS) return level;
  }
  return 1;
});
const effectiveLevel = computed(() => (levelSetting.value === 'auto' ? autoLevel.value : levelSetting.value));
const activeLevel = computed(() => (isSolid.value ? effectiveLevel.value : (stats.value?.activeLevel ?? 1)));
const estimatedCells = computed(() =>
  isSolid.value ? estimateGridCells({ ...localRange }, effectiveLevel.value).cells : 0
);
const estimateRatio = computed(() => estimatedCells.value / MAX_LOCAL_CELLS);
/** 用量条比例：超限时顶格显示 */
const estimatePercent = computed(() => Math.min(100, Math.max(0, estimateRatio.value * 100)));
const estimateTone = computed(() => {
  if (estimatedCells.value > MAX_LOCAL_CELLS) return 'danger';
  return estimateRatio.value > 0.7 ? 'warning' : 'normal';
});
const levelHint = computed(() => {
  if (levelSetting.value === 'auto') {
    return isSolid.value ? `按范围自动选级：${autoLevel.value} 级` : '随地图缩放自动换级';
  }
  const option = LEVEL_OPTIONS.find(item => item.value === levelSetting.value);
  return option ? `格边长 ${option.desc}` : '';
});
/** 网格面覆盖范围偏大：格子投影到屏幕上很大时提示（以屏幕尺寸为准，层级高低不等于覆盖程度） */
const facesHint = computed(() => showFaces.value && (stats.value?.faceCellPixels ?? 0) >= 160);
/** 二维下网格面被整体隐藏：格子屏幕尺寸小于填充门槛，立体走几何绘制不受此限 */
const facesHiddenHint = computed(
  () => showFaces.value && !isSolid.value && !facesHint.value && stats.value?.faceFillVisible === false
);

/**
 * 常驻摘要：把「当前生效」提到滚动区外。
 * 立体模式下生成立即生效、二维模式下层级随缩放变化，都是需要随时可见的状态。
 */
const summaryText = computed(() => {
  let base: string;
  if (isSolid.value) {
    base =
      localCellCount.value > 0 ? `${localCellCount.value.toLocaleString()} 格 · ${heightLayers.value} 层` : '未生成';
  } else {
    base = `当前 ${activeLevel.value} 级`;
  }
  return labelsEnabled.value ? `${base} · 标签 ${(stats.value?.labelCount ?? 0).toLocaleString()}` : base;
});

function ensureGrid(): BeidouGrid | null {
  if (!gridReady.value) {
    window.$message?.warning('三维场景尚未就绪');
    return null;
  }
  if (!grid) createGrid(props.viewer);
  return grid;
}

function createGrid(viewer: Viewer | null) {
  if (!viewer || grid) return;
  grid = new BeidouGrid(viewer, {
    mode: renderMode.value,
    level: levelSetting.value,
    showOutline: showOutline.value,
    showFaces: showFaces.value,
    labels: labelsEnabled.value
  });
  unsubscribePick = grid.onPick(result => {
    pickResult.value = result;
  });
  grid.setVisible(true);
  syncStats();
  startStatsPolling();
}

function destroyGrid() {
  unsubscribePick?.();
  unsubscribePick = null;
  grid?.destroy();
  grid = null;
  stats.value = null;
  pickResult.value = null;
  localCellCount.value = 0;
  stopStatsPolling();
}

function syncStats() {
  stats.value = grid ? { ...grid.stats } : null;
}

function startStatsPolling() {
  if (statsTimer !== null) return;
  // 瓦片层级与标签数随相机变化，面板可见时低频同步即可
  statsTimer = window.setInterval(() => {
    if (!props.collapsed) syncStats();
  }, 1500);
}

function stopStatsPolling() {
  if (statsTimer !== null) window.clearInterval(statsTimer);
  statsTimer = null;
}

// ─────────────── 类型与参数 ───────────────

/** 类型 / 层级 / 层数变化后统一下发：立体走几何生成，二维走瓦片自适应 */
function applyRender(announce = false) {
  const instance = grid;
  if (!instance) return;
  instance.setMode(renderMode.value);
  instance.setLevel(levelSetting.value);
  if (isSolid.value && instance.setLocalLayers(solidLayers.value)) {
    localCellCount.value = instance.stats.localCellCount;
    if (announce) window.$message?.success(`立体层数已调整为 ${solidLayers.value} 层`);
  }
  syncStats();
}

function handleTypeChange(next: GridType) {
  if (gridType.value === next) return;
  gridType.value = next;
  applyRender();
}

function handleLevelChange() {
  grid?.setLevel(levelSetting.value);
  syncStats();
}

function handleLayersChange() {
  applyRender(true);
}

function handleSwitchChange() {
  grid?.setVisibility({ outline: showOutline.value, faces: showFaces.value, labels: labelsEnabled.value });
  syncStats();
}

// ─────────────── 生成范围 ───────────────

function useCurrentView() {
  const viewer = props.viewer;
  if (!viewer) return;
  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!rect) {
    window.$message?.warning('无法获取当前视野范围，请稍后再试');
    return;
  }
  localRange.west = Number(CesiumMath.toDegrees(rect.west).toFixed(4));
  localRange.south = Number(CesiumMath.toDegrees(rect.south).toFixed(4));
  localRange.east = Number(CesiumMath.toDegrees(rect.east).toFixed(4));
  localRange.north = Number(CesiumMath.toDegrees(rect.north).toFixed(4));
}

function useChinaRange() {
  Object.assign(localRange, DEFAULT_RANGE);
}

function useGlobalRange() {
  Object.assign(localRange, GLOBAL_RANGE);
}

/** 一键切回自适应：按当前范围自动落到可用层级（超限时的出口） */
function useAutoLevel() {
  levelSetting.value = 'auto';
  handleLevelChange();
}

async function handleGenerate() {
  const instance = ensureGrid();
  if (!instance || generating.value) return;
  if (localRange.east <= localRange.west || localRange.north <= localRange.south) {
    window.$message?.warning('范围无效：东经应大于西经，北纬应大于南纬');
    return;
  }
  if (estimatedCells.value > MAX_LOCAL_CELLS) {
    window.$message?.warning(
      `预计 ${estimatedCells.value.toLocaleString()} 个网格，超过上限 ${MAX_LOCAL_CELLS.toLocaleString()}，请缩小范围或降低层级`
    );
    return;
  }
  generating.value = true;
  // 让出一帧，先呈现按钮 loading 态再执行同步几何构建
  await new Promise(resolve => window.setTimeout(resolve, 30));
  const result = instance.buildLocal({ ...localRange }, effectiveLevel.value, solidLayers.value);
  generating.value = false;
  localCellCount.value = result.cellCount;
  if (result.tooLarge) {
    window.$message?.warning('范围过大，已取消生成');
    return;
  }
  const layerText = solidLayers.value > 1 ? ` · 立体 ${solidLayers.value} 层` : '';
  window.$message?.success(`已生成 ${result.cellCount.toLocaleString()} 个网格${layerText}`);
  syncStats();
}

function handleClearLocal() {
  grid?.clearLocal();
  localCellCount.value = 0;
  syncStats();
}

// ─────────────── 拾取 / 定位 / 查询 ───────────────

function handlePickToggle() {
  const instance = ensureGrid();
  if (!instance) return;
  instance.setPickEnabled(pickEnabled.value);
  if (!pickEnabled.value) pickResult.value = null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success('已复制');
  } catch {
    window.$message?.error('复制失败');
  }
}

function locatePickResult() {
  const result = pickResult.value;
  if (!result) return;
  grid?.highlightByCode(result.code, true);
}

function handleCodeLocate() {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    codeFeedback.value = '请输入北斗网格码';
    return;
  }
  const parsed = parseGridCode(code);
  if (!parsed) {
    codeFeedback.value = '编码无法识别：应为 N/S + 经向号 + 纬向字 + 逐级码元';
    return;
  }
  const result = grid?.highlightByCode(code, true);
  if (!result) {
    codeFeedback.value = '编码层级超出范围';
    return;
  }
  codeFeedback.value = '';
  pickResult.value = result;
  window.$message?.success(`已定位到 ${parsed.level} 级网格`);
}

function handleCoordinateQuery() {
  const instance = ensureGrid();
  if (!instance) return;
  const lon = queryLon.value;
  const lat = queryLat.value;
  if (lon === null || lat === null || Number.isNaN(lon) || Number.isNaN(lat)) {
    window.$message?.warning('请输入有效的经纬度');
    return;
  }
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    window.$message?.warning('经纬度超出有效范围');
    return;
  }
  pickResult.value = instance.queryCell(lon, lat, queryLevel.value);
}

/** 取视野中心（屏幕中心与地表交点）直接查询：省去手输坐标或先开拾取再点图 */
function queryViewCenter() {
  const viewer = props.viewer;
  const instance = ensureGrid();
  if (!viewer || !instance) return;
  const scene = viewer.scene;
  const cartesian = viewer.camera.pickEllipsoid(
    new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2),
    scene.globe.ellipsoid
  );
  const carto = cartesian ? Cartographic.fromCartesian(cartesian) : null;
  if (!carto) {
    window.$message?.warning('视野中心未落在地表');
    return;
  }
  const lon = Number(CesiumMath.toDegrees(carto.longitude).toFixed(6));
  const lat = Number(CesiumMath.toDegrees(carto.latitude).toFixed(6));
  queryLon.value = lon;
  queryLat.value = lat;
  pickResult.value = instance.queryCell(lon, lat, queryLevel.value);
}

function handleClearHighlight() {
  grid?.clearHighlight();
  pickResult.value = null;
}

// viewer 就绪 / 更换时重建实例
watch(
  () => props.viewer,
  viewer => {
    destroyGrid();
    if (viewer) createGrid(viewer);
  },
  { immediate: true }
);

// 面板收起时停止轮询
watch(
  () => props.collapsed,
  collapsed => {
    if (collapsed) stopStatsPolling();
    else if (grid) startStatsPolling();
  }
);

// 结果出现后把读数区滚入视野（立体模式的拾取结果常在折叠线以下）
watch(pickResult, result => {
  if (!result) return;
  void nextTick(() => {
    readoutRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
});

onBeforeUnmount(() => {
  destroyGrid();
});
</script>

<template>
  <div class="bdg" :class="{ 'bdg--collapsed': collapsed }">
    <!-- ══ 标题栏 ══ -->
    <header class="bdg-head">
      <span class="bdg-head__icon"><SvgIcon icon="mdi:grid-large" /></span>
      <span class="bdg-head__title">北斗网格位置码</span>
      <span class="bdg-head__state" :class="gridReady ? 'is-ready' : 'is-idle'">
        <i class="bdg-dot" />
        {{ gridReady ? '就绪' : '未就绪' }}
      </span>
      <div class="bdg-head__actions">
        <button
          type="button"
          class="bdg-icon-btn"
          :title="collapsed ? '展开' : '折叠'"
          :aria-label="collapsed ? '展开面板' : '折叠面板'"
          @click="emit('toggle-collapse')"
        >
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="bdg-icon-btn" title="关闭" aria-label="关闭面板" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </header>

    <!-- ══ 常驻摘要（不随内容滚动，收起时仍可见） ══ -->
    <div class="bdg-summary">
      <span class="bdg-summary__kind">{{ isSolid ? '立体网格' : '二维网格' }}</span>
      <span class="bdg-summary__value">{{ summaryText }}</span>
    </div>

    <div v-show="!collapsed" class="bdg-body">
      <!-- ══ 网格类型 ══ -->
      <section class="bdg-block">
        <div class="bdg-block__label">
          网格类型
          <span class="bdg-block__std">GB/T 39409-2020</span>
        </div>
        <div class="bdg-block__body">
          <div class="bdg-seg" role="group" aria-label="网格类型">
            <button
              type="button"
              class="bdg-seg__item"
              :class="{ 'is-on': gridType === '2d' }"
              :aria-pressed="gridType === '2d'"
              @click="handleTypeChange('2d')"
            >
              二维网格
            </button>
            <button
              type="button"
              class="bdg-seg__item"
              :class="{ 'is-on': gridType === '3d' }"
              :aria-pressed="gridType === '3d'"
              @click="handleTypeChange('3d')"
            >
              立体网格
            </button>
          </div>
          <p class="bdg-note">{{ isSolid ? '按指定范围生成，高度分层' : '随地图范围自适应渲染' }}</p>
        </div>
      </section>

      <!-- ══ 网格参数 ══ -->
      <section class="bdg-block">
        <div class="bdg-block__label">网格参数</div>
        <div class="bdg-block__body">
          <div class="bdg-row">
            <label class="bdg-row__label" for="bdg-level">层级</label>
            <select id="bdg-level" v-model="levelSetting" class="bdg-select" @change="handleLevelChange">
              <option value="auto">自适应</option>
              <option v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.brief }}</option>
            </select>
          </div>
          <p class="bdg-note bdg-note--tight">{{ levelHint }}</p>
          <p v-if="stats?.skippedByDensity" class="bdg-alert">
            <SvgIcon icon="mdi:alert-outline" />
            当前缩放下线条过密，已跳过绘制；请调低层级或改为自适应
          </p>

          <div v-if="isSolid" class="bdg-row bdg-row--stack">
            <label class="bdg-row__label" for="bdg-layers">高度层数</label>
            <select id="bdg-layers" v-model.number="heightLayers" class="bdg-select" @change="handleLayersChange">
              <option v-for="n in LAYER_OPTIONS" :key="n" :value="n">{{ n }} 层</option>
            </select>
          </div>

          <div class="bdg-chips">
            <label class="bdg-chip" :class="{ 'is-on': showOutline }">
              <input v-model="showOutline" type="checkbox" @change="handleSwitchChange" />
              <span>边框线</span>
            </label>
            <label class="bdg-chip" :class="{ 'is-on': showFaces }">
              <input v-model="showFaces" type="checkbox" @change="handleSwitchChange" />
              <span>网格面</span>
            </label>
            <label class="bdg-chip" :class="{ 'is-on': labelsEnabled }">
              <input v-model="labelsEnabled" type="checkbox" @change="handleSwitchChange" />
              <span>编码标签</span>
            </label>
          </div>
          <p v-if="facesHint" class="bdg-alert">
            <SvgIcon icon="mdi:alert-outline" />
            网格面覆盖范围较大，会影响底图判读；可提高层级或关闭网格面
          </p>
          <p v-else-if="facesHiddenHint" class="bdg-note bdg-note--tight">
            当前层级格子在屏幕上过小，网格面已整体隐藏；放大或提高层级后恢复
          </p>
        </div>
      </section>

      <!-- ══ 生成范围（仅立体网格） ══ -->
      <section v-if="isSolid" class="bdg-block">
        <div class="bdg-block__label">生成范围</div>
        <div class="bdg-block__body">
          <div class="bdg-grid2">
            <label class="bdg-mini">
              <span>西经</span>
              <input
                v-model.number="localRange.west"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="-180"
                max="180"
              />
            </label>
            <label class="bdg-mini">
              <span>东经</span>
              <input
                v-model.number="localRange.east"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="-180"
                max="180"
              />
            </label>
            <label class="bdg-mini">
              <span>南纬</span>
              <input
                v-model.number="localRange.south"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="-90"
                max="90"
              />
            </label>
            <label class="bdg-mini">
              <span>北纬</span>
              <input
                v-model.number="localRange.north"
                type="number"
                inputmode="decimal"
                step="0.01"
                min="-90"
                max="90"
              />
            </label>
          </div>
          <div class="bdg-links">
            <button type="button" class="bdg-link" @click="useCurrentView">取当前视野</button>
            <button type="button" class="bdg-link" @click="useChinaRange">全国范围</button>
            <button type="button" class="bdg-link" @click="useGlobalRange">全球范围</button>
          </div>

          <div class="bdg-meter" :class="`is-${estimateTone}`">
            <div class="bdg-meter__top">
              <span>格数</span>
              <b>{{ estimatedCells.toLocaleString() }}</b>
            </div>
            <div class="bdg-meter__track">
              <i :style="{ width: `${estimatePercent}%` }" />
            </div>
            <div class="bdg-meter__foot">
              <template v-if="estimateTone === 'danger'">
                超出上限 {{ MAX_LOCAL_CELLS.toLocaleString() }} 格 ·
                <button type="button" class="bdg-link" @click="useAutoLevel">改为自适应（{{ autoLevel }} 级）</button>
              </template>
              <template v-else>上限 {{ MAX_LOCAL_CELLS.toLocaleString() }} 格</template>
            </div>
          </div>

          <div class="bdg-actions">
            <button
              type="button"
              class="bdg-btn bdg-btn--primary"
              :disabled="generating || !gridReady"
              @click="handleGenerate"
            >
              {{ generating ? '生成中…' : '生成网格' }}
            </button>
            <button type="button" class="bdg-btn" :disabled="localCellCount === 0" @click="handleClearLocal">
              清除
            </button>
          </div>
        </div>
      </section>

      <!-- ══ 拾取与查询 ══ -->
      <section class="bdg-block">
        <div class="bdg-block__label">拾取与查询</div>
        <div class="bdg-block__body">
          <label class="bdg-chip bdg-chip--wide" :class="{ 'is-on': pickEnabled }">
            <input v-model="pickEnabled" type="checkbox" @change="handlePickToggle" />
            <span>地图拾取</span>
          </label>
          <p v-if="pickEnabled" class="bdg-note bdg-note--tight">在地图上单击拾取网格</p>

          <div class="bdg-combo">
            <input
              v-model="codeInput"
              type="text"
              class="bdg-input bdg-input--code"
              placeholder="网格码，如 N50J475"
              aria-label="按北斗网格码定位"
              autocomplete="off"
              spellcheck="false"
              @keyup.enter="handleCodeLocate"
            />
            <button type="button" class="bdg-btn bdg-btn--inline" @click="handleCodeLocate">定位</button>
          </div>
          <p v-if="codeFeedback" class="bdg-alert">{{ codeFeedback }}</p>

          <div class="bdg-coord">
            <input
              v-model.number="queryLon"
              type="number"
              inputmode="decimal"
              class="bdg-input"
              placeholder="经度"
              aria-label="查询经度"
              @keyup.enter="handleCoordinateQuery"
            />
            <input
              v-model.number="queryLat"
              type="number"
              inputmode="decimal"
              class="bdg-input"
              placeholder="纬度"
              aria-label="查询纬度"
              @keyup.enter="handleCoordinateQuery"
            />
            <select v-model.number="queryLevel" class="bdg-select bdg-select--tiny" aria-label="查询层级">
              <option v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.value }} 级</option>
            </select>
          </div>
          <div class="bdg-actions bdg-actions--flush">
            <button type="button" class="bdg-btn" @click="handleCoordinateQuery">查询网格码</button>
            <button type="button" class="bdg-btn" @click="queryViewCenter">视野中心</button>
          </div>
        </div>
      </section>

      <!-- ══ 网格码读数 ══ -->
      <div v-if="pickResult" ref="readoutRef" class="bdg-readout">
        <div class="bdg-readout__top">
          <span class="bdg-readout__tag">{{ pickResult.level }} 级</span>
          <span class="bdg-readout__coord">
            {{ pickResult.longitude.toFixed(4) }}°E&nbsp;&nbsp;{{ pickResult.latitude.toFixed(4) }}°N
          </span>
        </div>
        <div class="bdg-readout__code">{{ pickResult.code }}</div>
        <div class="bdg-readout__acts">
          <button type="button" class="bdg-link" @click="copyText(pickResult.code)">复制</button>
          <span class="bdg-sep" />
          <button type="button" class="bdg-link" @click="locatePickResult">定位</button>
          <span class="bdg-sep" />
          <button type="button" class="bdg-link" @click="handleClearHighlight">清除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  视觉基准对齐同屏「图层管理」与「渡河工程方案设置」面板：
  扁平表面 + 1px 细线 + 表格数字；不用渐变、发光与胶囊装饰。
  语义色取自 src/theme/settings.ts（success #6AAE8A / warning #C9A45C / error #C25B5B）。
*/
.bdg {
  --bdg-line: rgba(255, 255, 255, 0.06);
  --bdg-line-strong: rgba(255, 255, 255, 0.1);
  --bdg-surface: rgba(255, 255, 255, 0.035);
  --bdg-text: rgba(255, 255, 255, 0.88);
  --bdg-text-2: rgba(255, 255, 255, 0.6);
  --bdg-text-3: rgba(255, 255, 255, 0.38);
  --bdg-accent: #8db0dd;
  --bdg-accent-bg: rgba(93, 140, 200, 0.14);
  --bdg-accent-line: rgba(93, 140, 200, 0.42);
  --bdg-primary: #3d6fb4;
  --bdg-warning: #c9a45c;
  --bdg-danger: #c25b5b;
  --bdg-success: #6aae8a;

  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  color: var(--bdg-text);
  font-size: 12px;
  color-scheme: dark;
}

/* ══ 标题栏 ══ */
.bdg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--bdg-line);
  flex-shrink: 0;
}

.bdg-head__icon {
  font-size: 18px;
  color: var(--bdg-accent);
  line-height: 1;
}

.bdg-head__title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.01em;
}

.bdg-head__state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 11px;
  color: var(--bdg-text-3);
}

.bdg-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentcolor;
}

.bdg-head__state.is-ready {
  color: var(--bdg-success);
}

.bdg-head__state.is-idle {
  color: var(--bdg-warning);
}

.bdg-head__actions {
  display: flex;
  gap: 4px;
  margin-left: 4px;
}

.bdg-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s;
}

.bdg-icon-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

/* ══ 常驻摘要 ══ */
.bdg-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--bdg-line);
  background: rgba(255, 255, 255, 0.015);
  font-size: 11px;
  flex-shrink: 0;
}

.bdg-summary__kind {
  font-weight: 600;
  color: var(--bdg-text-2);
}

.bdg-summary__value {
  color: var(--bdg-accent);
  font-variant-numeric: tabular-nums;
}

/* ══ 滚动区 ══ */
.bdg-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.bdg-body::-webkit-scrollbar {
  width: 5px;
}

.bdg-body::-webkit-scrollbar-track {
  background: transparent;
}

.bdg-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ══ 分区 ══ */
.bdg-block {
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  overflow: hidden;
}

.bdg-block__label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bdg-text-2);
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid rgba(93, 140, 200, 0.45);
  letter-spacing: 0.02em;
}

.bdg-block__std {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.26);
  letter-spacing: 0.02em;
}

.bdg-block__body {
  padding: 10px 12px 11px;
}

.bdg-note {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--bdg-text-3);
}

.bdg-note--tight {
  margin-top: 4px;
}

.bdg-alert {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 7px 0 0;
  font-size: 10px;
  line-height: 1.55;
  color: var(--bdg-warning);
}

/* ══ 分段控件 ══ */
.bdg-seg {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--bdg-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.bdg-seg__item {
  flex: 1;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--bdg-text-2);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.16s,
    color 0.16s,
    border-color 0.16s;
}

.bdg-seg__item:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(43, 107, 255, 0.08);
}

.bdg-seg__item.is-on {
  background: var(--bdg-accent-bg);
  border-color: var(--bdg-accent-line);
  color: #cfe0f5;
  font-weight: 600;
}

/* ══ 字段 ══ */
.bdg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}

.bdg-row--stack {
  margin-top: 9px;
}

.bdg-row__label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  font-weight: 500;
  flex-shrink: 0;
}

.bdg-select,
.bdg-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--bdg-line-strong);
  border-radius: 7px;
  background: var(--bdg-surface);
  color: var(--bdg-text);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.bdg-select {
  min-width: 104px;
  cursor: pointer;
  color-scheme: dark;
}

/* 原生下拉的展开层由浏览器绘制，仅靠容器的 color-scheme 不受约束：
   不显式配色时 option 会落到默认白底，而文字继承面板浅色，形成白底白字 */
.bdg-select option {
  background-color: #101828;
  color: rgba(255, 255, 255, 0.92);
}

.bdg-select--tiny {
  min-width: 68px;
  flex: 0 0 68px;
}

.bdg-select:hover,
.bdg-input:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
}

.bdg-select:focus,
.bdg-input:focus {
  border-color: rgba(93, 140, 200, 0.5);
  background: rgba(93, 140, 200, 0.05);
}

.bdg-input::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.bdg-input--code {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, 'SF Mono', Consolas, 'JetBrains Mono', monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bdg-input--code::placeholder {
  text-transform: none;
  letter-spacing: 0;
  font-family: inherit;
}

.bdg-combo,
.bdg-coord {
  display: flex;
  gap: 6px;
}

.bdg-coord {
  margin-bottom: 7px;
}

.bdg-coord .bdg-input {
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

/* ══ 选项片 ══ */
.bdg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.bdg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--bdg-line-strong);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.66);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.bdg-chip:hover {
  background: rgba(43, 107, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.bdg-chip.is-on {
  background: rgba(93, 140, 200, 0.09);
  border-color: var(--bdg-accent-line);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.bdg-chip--wide {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 9px;
}

.bdg-chip input[type='checkbox'] {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: #4a7dbd;
  cursor: pointer;
  flex-shrink: 0;
}

/* ══ 范围输入 ══ */
.bdg-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.bdg-mini {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bdg-mini span {
  font-size: 10px;
  color: var(--bdg-text-3);
}

.bdg-mini input {
  height: 27px;
  padding: 0 8px;
  border: 1px solid var(--bdg-line-strong);
  border-radius: 7px;
  background: var(--bdg-surface);
  color: var(--bdg-text);
  font-size: 12px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.bdg-mini input:hover {
  border-color: rgba(255, 255, 255, 0.16);
}

.bdg-mini input:focus {
  border-color: rgba(93, 140, 200, 0.5);
  background: rgba(93, 140, 200, 0.05);
}

.bdg-links {
  display: flex;
  gap: 13px;
  margin: 8px 0 10px;
}

.bdg-link {
  padding: 3px 0;
  border: none;
  background: none;
  color: var(--bdg-accent);
  font-size: 11px;
  font-family: inherit;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.15s;
}

.bdg-link:hover {
  color: #cfe0f5;
}

/* ══ 用量条 ══ */
.bdg-meter {
  padding: 8px 10px;
  border: 1px solid var(--bdg-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.bdg-meter__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  color: var(--bdg-text-3);
}

.bdg-meter__top b {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--bdg-accent);
}

.bdg-meter__track {
  height: 3px;
  margin: 6px 0 5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.bdg-meter__track i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: rgba(141, 176, 221, 0.75);
  transition: width 0.2s ease;
}

.bdg-meter.is-warning .bdg-meter__top b {
  color: var(--bdg-warning);
}

.bdg-meter.is-warning .bdg-meter__track i {
  background: var(--bdg-warning);
}

.bdg-meter.is-danger .bdg-meter__top b {
  color: var(--bdg-danger);
}

.bdg-meter.is-danger .bdg-meter__track i {
  background: var(--bdg-danger);
}

.bdg-meter__foot {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.28);
}

/* ══ 按钮 ══ */
.bdg-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.bdg-actions--flush {
  margin-top: 0;
}

.bdg-btn {
  flex: 1;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--bdg-line-strong);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.bdg-btn:hover:not(:disabled) {
  background: rgba(43, 107, 255, 0.12);
  border-color: var(--bdg-accent-line);
  color: #fff;
}

.bdg-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.bdg-btn--primary {
  border-color: transparent;
  background: var(--bdg-primary);
  color: #fff;
  font-weight: 600;
}

.bdg-btn--primary:hover:not(:disabled) {
  background: #35619f;
  border-color: transparent;
}

.bdg-btn--inline {
  flex: 0 0 auto;
}

.bdg-btn--wide {
  width: 100%;
}

/* ══ 网格码读数 ══ */
.bdg-readout {
  margin-bottom: 10px;
  padding: 10px 12px 9px;
  border: 1px solid var(--bdg-accent-line);
  border-radius: 10px;
  background: rgba(93, 140, 200, 0.07);
}

.bdg-readout__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.bdg-readout__tag {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid var(--bdg-accent-line);
  border-radius: 4px;
  color: var(--bdg-accent);
  line-height: 15px;
}

.bdg-readout__coord {
  font-size: 10px;
  color: var(--bdg-text-3);
  font-variant-numeric: tabular-nums;
}

.bdg-readout__code {
  font-family: ui-monospace, 'SF Mono', Consolas, 'JetBrains Mono', monospace;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #e8f1ff;
  word-break: break-all;
  line-height: 1.35;
}

.bdg-readout__acts {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(93, 140, 200, 0.18);
}

.bdg-sep {
  width: 1px;
  height: 10px;
  background: rgba(255, 255, 255, 0.12);
}
</style>
