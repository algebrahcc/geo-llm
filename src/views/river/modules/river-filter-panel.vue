<script setup lang="ts">
import { ref } from 'vue';
import type { FilterForm } from './types';
import { filterTaskTypeOptions, priorityOptions, directionOptions } from '@/mock/river';

defineOptions({
  name: 'RiverFilterPanel'
});

interface Props {
  collapsed: boolean;
  form: FilterForm;
  running: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  filter: [];
  updateForm: [value: FilterForm];
}>();

// 可折叠 section
const taskSectionOpen = ref(true);
const filterSectionOpen = ref(true);

function updateField<K extends keyof FilterForm>(key: K, value: FilterForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}

const bankGeomOptions = [
  { label: '平坦', value: '平坦' },
  { label: '缓坡', value: '缓坡' },
  { label: '陡坡', value: '陡坡' }
];

const resourceOptions = [
  { label: '浮桥器材', value: '浮桥器材' },
  { label: '舟桥器材', value: '舟桥器材' },
  { label: '无', value: '无' }
];
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="filter-panel"
    :class="[{ 'filter-panel--collapsed': collapsed }]"
    :content-style="{ padding: 0 }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:filter-variant" class="panel-icon" />
          <span>智能筛选</span>
        </div>
        <div class="header-actions">
          <span class="status-dot" :class="running ? 'status-dot--active' : ''"></span>
          <NTag :bordered="false" size="tiny" :type="running ? 'warning' : 'default'" class="status-tag">
            {{ running ? '筛选中...' : '待筛选' }}
          </NTag>
        </div>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-content">
      <!-- ═══ 工程任务信息（可折叠） ═══ -->
      <div class="collapsible-section">
        <button type="button" class="section-toggle" @click="taskSectionOpen = !taskSectionOpen">
          <SvgIcon icon="mdi:clipboard-list-outline" class="section-toggle-icon" />
          <span>工程任务信息</span>
          <SvgIcon :icon="taskSectionOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="section-arrow" />
        </button>
        <div v-show="taskSectionOpen" class="section-body">
          <NForm label-placement="top" size="small" class="filter-form">
            <NFormItem label="任务名称">
              <NInput :value="form.taskName" @update:value="updateField('taskName', $event)" />
            </NFormItem>
            <NFormItem label="任务类型">
              <NSelect
                :value="form.taskType"
                :options="filterTaskTypeOptions"
                @update:value="updateField('taskType', $event)"
              />
            </NFormItem>
            <div class="field-grid-2">
              <NFormItem label="预期通行时间">
                <NInput :value="form.expectedTime" @update:value="updateField('expectedTime', $event)" />
              </NFormItem>
              <NFormItem label="通行保障时长">
                <NInput :value="form.duration" @update:value="updateField('duration', $event)" />
              </NFormItem>
            </div>
            <div class="field-grid-2">
              <NFormItem label="通行载具">
                <NInput :value="form.vehicleType" @update:value="updateField('vehicleType', $event)" />
              </NFormItem>
              <NFormItem label="通行方向">
                <NSelect
                  :value="form.direction"
                  :options="directionOptions"
                  @update:value="updateField('direction', $event)"
                />
              </NFormItem>
            </div>
            <NFormItem label="优先级">
              <NSelect
                :value="form.priority"
                :options="priorityOptions"
                @update:value="updateField('priority', $event)"
              />
            </NFormItem>
          </NForm>
        </div>
      </div>

      <!-- ═══ 筛选条件设置（可折叠） ═══ -->
      <div class="collapsible-section">
        <button type="button" class="section-toggle" @click="filterSectionOpen = !filterSectionOpen">
          <SvgIcon icon="mdi:tune-variant" class="section-toggle-icon" />
          <span>筛选条件设置</span>
          <SvgIcon :icon="filterSectionOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="section-arrow" />
        </button>
        <div v-show="filterSectionOpen" class="section-body">
          <NForm label-placement="top" size="small" class="filter-form">
            <div class="slider-item">
              <div class="slider-header">
                <SvgIcon icon="mdi:waves" class="slider-label-icon" />
                <span>水深半径</span>
                <span class="slider-val">≤{{ form.depthRadius }}km</span>
              </div>
              <NSlider
                :value="form.depthRadius"
                :min="5"
                :max="50"
                :step="1"
                class="premium-slider"
                @update:value="updateField('depthRadius', $event)"
              />
            </div>

            <div class="slider-item">
              <div class="slider-header">
                <SvgIcon icon="mdi:speedometer" class="slider-label-icon" />
                <span>流速范围(可通)</span>
                <span class="slider-val">≤{{ form.velocityRange }}m/s</span>
              </div>
              <NSlider
                :value="form.velocityRange"
                :min="0.5"
                :max="5"
                :step="0.1"
                class="premium-slider"
                @update:value="updateField('velocityRange', $event)"
              />
            </div>

            <div class="slider-item">
              <div class="slider-header">
                <SvgIcon icon="mdi:arrow-left-right" class="slider-label-icon" />
                <span>沟宽范围</span>
                <span class="slider-val">{{ form.widthMin }}~{{ form.widthMax }}m</span>
              </div>
              <NSlider
                range
                :value="[form.widthMin, form.widthMax]"
                :min="20"
                :max="500"
                :step="10"
                class="premium-slider"
                @update:value="
                  ((v: number[]) => {
                    updateField('widthMin', v[0]);
                    updateField('widthMax', v[1]);
                  })($event)
                "
              />
            </div>

            <div class="slider-item">
              <div class="slider-header">
                <SvgIcon icon="mdi:slope-uphill" class="slider-label-icon" />
                <span>河岸坡度</span>
                <span class="slider-val">≤{{ form.bankSlope }}°</span>
              </div>
              <NSlider
                :value="form.bankSlope"
                :min="0.5"
                :max="10"
                :step="0.5"
                class="premium-slider"
                @update:value="updateField('bankSlope', $event)"
              />
            </div>

            <NFormItem label="河岸地貌">
              <NCheckboxGroup
                :value="form.bankGeomorphology"
                @update:value="updateField('bankGeomorphology', $event as string[])"
              >
                <NSpace item-style="display: flex;">
                  <NCheckbox v-for="opt in bankGeomOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
                </NSpace>
              </NCheckboxGroup>
            </NFormItem>

            <NFormItem label="可用资源">
              <NRadioGroup :value="form.availableResource" @update:value="updateField('availableResource', $event)">
                <NSpace>
                  <NRadio v-for="opt in resourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <NFormItem label="重点规避">
              <NCheckbox :checked="form.avoidFloodArea" @update:checked="updateField('avoidFloodArea', $event)">
                洪水区域
              </NCheckbox>
            </NFormItem>

            <NFormItem label="其他要求">
              <NInput
                type="textarea"
                :rows="2"
                :value="form.otherRequirements"
                placeholder="输入额外筛选要求…"
                @update:value="updateField('otherRequirements', $event)"
              />
            </NFormItem>
          </NForm>
        </div>
      </div>

      <!-- ═══ 提交按钮 ═══ -->
      <div class="submit-bar">
        <NButton type="primary" block :loading="running" size="large" class="submit-btn" @click="emit('filter')">
          <template #icon>
            <SvgIcon icon="mdi:auto-fix" />
          </template>
          智能筛选
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
/* ──── Panel Shell ──── */
.filter-panel {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.filter-panel :deep(.n-card-header) {
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-content {
  overflow-y: auto;
  max-height: calc(100vh - 220px);
}

/* ──── Header ──── */
.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.panel-icon {
  font-size: 18px;
  color: #3b82f6;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-tag {
  font-size: 11px !important;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}

.status-dot--active {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  animation: pulse-dot 1.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.4);
  }
}

/* ──── Collapsible Sections ──── */
.collapsible-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.collapsible-section:last-of-type {
  border-bottom: none;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
  text-transform: uppercase;
}

.section-toggle:hover {
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.88);
}

.section-toggle-icon {
  font-size: 15px;
  color: #3b82f6;
  opacity: 0.7;
}

.section-arrow {
  margin-left: auto;
  font-size: 14px;
  opacity: 0.4;
  transition: transform 0.22s ease;
}

.section-body {
  padding: 0 16px 12px;
  animation: sectionExpand 0.22s ease-out;
}

@keyframes sectionExpand {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ──── Form ──── */
.filter-form {
  margin-top: 0;
}

.filter-form :deep(.n-form-item-label) {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.field-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* ──── Slider Items ──── */
.slider-item {
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.slider-item:hover {
  border-color: rgba(59, 130, 246, 0.15);
  background: rgba(59, 130, 246, 0.04);
}

.slider-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.slider-label-icon {
  font-size: 14px;
  color: #3b82f6;
  opacity: 0.55;
}

.slider-val {
  margin-left: auto;
  font-weight: 700;
  font-size: 12px;
  color: #93c5fd;
  font-variant-numeric: tabular-nums;
}

/* ──── Premium Slider Override ──── */
.premium-slider :deep(.n-slider-rail) {
  background: rgba(255, 255, 255, 0.06) !important;
}

.premium-slider :deep(.n-slider-rail .n-slider-rail__fill) {
  background: linear-gradient(90deg, #2563eb, #3b82f6) !important;
}

.premium-slider :deep(.n-slider-handle) {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}

/* ──── Submit Bar ──── */
.submit-bar {
  position: sticky;
  bottom: 0;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.95) 30%);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.submit-btn {
  font-weight: 600;
  letter-spacing: 0.04em;
  height: 40px;
  border-radius: 10px;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.submit-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}

.filter-panel--collapsed {
  width: 100% !important;
}
</style>
