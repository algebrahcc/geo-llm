<script setup lang="ts">
import { ref } from 'vue';
import type { EvaluateForm, EvaluateWeights, ResourceCategory } from './types';
import { regionOptions, riverSectionOptions, taskCapacityOptions } from '@/mock/river';

defineOptions({
  name: 'RiverEvaluatePanel'
});

interface Props {
  collapsed: boolean;
  form: EvaluateForm;
  running: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  evaluate: [];
  updateForm: [value: EvaluateForm];
}>();

// 可折叠 section
const baseSectionOpen = ref(true);
const weightSectionOpen = ref(true);
const resourceSectionOpen = ref(true);

const resourceCategoryOptions: { label: string; value: ResourceCategory }[] = [
  { label: '天然渡口', value: '天然渡口' },
  { label: '可建设渡口', value: '可建设渡口' },
  { label: '工程装备', value: '工程装备' },
  { label: '舟桥器材', value: '舟桥器材' },
  { label: '浮游器材', value: '浮游器材' },
  { label: '冲击舟', value: '冲击舟' },
  { label: '运输车辆', value: '运输车辆' },
  { label: '岸滩', value: '岸滩' }
];

function updateField<K extends keyof EvaluateForm>(key: K, value: EvaluateForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}

function updateWeight<K extends keyof EvaluateWeights>(key: K, value: number) {
  emit('updateForm', {
    ...props.form,
    weights: { ...props.form.weights, [key]: value }
  });
}

function updateResourceTypes(vals: (string | number)[]) {
  emit('updateForm', { ...props.form, resourceTypes: vals as ResourceCategory[] });
}
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="evaluate-panel"
    :class="[{ 'evaluate-panel--collapsed': collapsed }]"
    :content-style="{ padding: 0 }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:clipboard-text-search-outline" class="panel-icon" />
          <span>评估条件设置</span>
        </div>
        <div class="header-actions">
          <span class="status-dot" :class="running ? 'status-dot--active' : ''"></span>
          <NTag :bordered="false" size="tiny" :type="running ? 'warning' : 'default'" class="status-tag">
            {{ running ? '评估中...' : '待评估' }}
          </NTag>
        </div>
      </div>
    </template>

    <div v-if="!collapsed" class="panel-content">
      <!-- ═══ 基础设置（可折叠） ═══ -->
      <div class="collapsible-section">
        <button type="button" class="section-toggle" @click="baseSectionOpen = !baseSectionOpen">
          <SvgIcon icon="mdi:cog-outline" class="section-toggle-icon" />
          <span>基础设置</span>
          <SvgIcon :icon="baseSectionOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="section-arrow" />
        </button>
        <div v-show="baseSectionOpen" class="section-body">
          <NForm label-placement="top" size="small" class="evaluate-form">
            <NFormItem label="评估区域">
              <NSelect :value="form.region" :options="regionOptions" @update:value="updateField('region', $event)" />
            </NFormItem>
            <NFormItem label="评估河段">
              <NSelect
                :value="form.riverSection"
                :options="riverSectionOptions"
                @update:value="updateField('riverSection', $event)"
              />
            </NFormItem>
            <NFormItem label="评估时间">
              <NDatePicker
                :value="form.evaluateTime"
                type="datetime"
                clearable
                style="width: 100%"
                @update:value="updateField('evaluateTime', $event ?? Date.now())"
              />
            </NFormItem>

            <div class="field-separator">任务需求</div>
            <div class="field-grid-3">
              <NFormItem label="能力需求">
                <NSelect
                  :value="form.taskCapacity"
                  :options="taskCapacityOptions"
                  @update:value="updateField('taskCapacity', $event)"
                />
              </NFormItem>
              <NFormItem label="单位(天)">
                <NInputNumber
                  :value="form.taskDays"
                  :min="1"
                  :max="30"
                  style="width: 100%"
                  @update:value="updateField('taskDays', $event ?? 1)"
                />
              </NFormItem>
              <NFormItem label="车辆数量">
                <NInputNumber
                  :value="form.vehicleCount"
                  :min="1"
                  :max="500"
                  style="width: 100%"
                  @update:value="updateField('vehicleCount', $event ?? 1)"
                />
              </NFormItem>
            </div>
          </NForm>
        </div>
      </div>

      <!-- ═══ 评估指标权重（可折叠） ═══ -->
      <div class="collapsible-section">
        <button type="button" class="section-toggle" @click="weightSectionOpen = !weightSectionOpen">
          <SvgIcon icon="mdi:weight-lifter" class="section-toggle-icon" />
          <span>评估指标权重</span>
          <SvgIcon :icon="weightSectionOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="section-arrow" />
        </button>
        <div v-show="weightSectionOpen" class="section-body">
          <div class="weight-group">
            <div class="weight-item">
              <div class="weight-header">
                <SvgIcon icon="mdi:road-variant" class="weight-icon" />
                <span>通行能力</span>
                <span class="weight-val">{{ form.weights.passAbility }}%</span>
              </div>
              <NSlider
                :value="form.weights.passAbility"
                :min="0"
                :max="100"
                :step="5"
                class="premium-slider"
                @update:value="updateWeight('passAbility', $event)"
              />
            </div>
            <div class="weight-item">
              <div class="weight-header">
                <SvgIcon icon="mdi:eye-off-outline" class="weight-icon" />
                <span>隐蔽性</span>
                <span class="weight-val">{{ form.weights.concealment }}%</span>
              </div>
              <NSlider
                :value="form.weights.concealment"
                :min="0"
                :max="100"
                :step="5"
                class="premium-slider"
                @update:value="updateWeight('concealment', $event)"
              />
            </div>
            <div class="weight-item">
              <div class="weight-header">
                <SvgIcon icon="mdi:shield-outline" class="weight-icon" />
                <span>防护条件</span>
                <span class="weight-val">{{ form.weights.protection }}%</span>
              </div>
              <NSlider
                :value="form.weights.protection"
                :min="0"
                :max="100"
                :step="5"
                class="premium-slider"
                @update:value="updateWeight('protection', $event)"
              />
            </div>
            <div class="weight-item">
              <div class="weight-header">
                <SvgIcon icon="mdi:terrain" class="weight-icon" />
                <span>地形条件</span>
                <span class="weight-val">{{ form.weights.terrain }}%</span>
              </div>
              <NSlider
                :value="form.weights.terrain"
                :min="0"
                :max="100"
                :step="5"
                class="premium-slider"
                @update:value="updateWeight('terrain', $event)"
              />
            </div>
            <div class="weight-item">
              <div class="weight-header">
                <SvgIcon icon="mdi:package-variant-closed" class="weight-icon" />
                <span>后勤保障</span>
                <span class="weight-val">{{ form.weights.logistics }}%</span>
              </div>
              <NSlider
                :value="form.weights.logistics"
                :min="0"
                :max="100"
                :step="5"
                class="premium-slider"
                @update:value="updateWeight('logistics', $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 资源类型筛选（可折叠） ═══ -->
      <div class="collapsible-section">
        <button type="button" class="section-toggle" @click="resourceSectionOpen = !resourceSectionOpen">
          <SvgIcon icon="mdi:package-variant" class="section-toggle-icon" />
          <span>资源类型筛选</span>
          <SvgIcon :icon="resourceSectionOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="section-arrow" />
        </button>
        <div v-show="resourceSectionOpen" class="section-body">
          <NCheckboxGroup :value="form.resourceTypes" @update:value="updateResourceTypes">
            <div class="resource-tag-grid">
              <label
                v-for="opt in resourceCategoryOptions"
                :key="opt.value"
                class="resource-tag"
                :class="{ 'resource-tag--checked': form.resourceTypes.includes(opt.value) }"
              >
                <NCheckbox :value="opt.value" class="resource-checkbox" />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </NCheckboxGroup>
        </div>
      </div>

      <!-- ═══ 提交按钮 ═══ -->
      <div class="submit-bar">
        <NButton type="primary" block :loading="running" size="large" class="submit-btn" @click="emit('evaluate')">
          <template #icon>
            <SvgIcon icon="mdi:auto-fix" />
          </template>
          智能评估
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
/* ──── Panel Shell ──── */
.evaluate-panel {
  width: 100% !important;
  border: none !important;
  background: transparent !important;
  backdrop-filter: none !important;
  border-radius: 0 !important;
}

.evaluate-panel :deep(.n-card-header) {
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
.evaluate-form {
  margin-top: 0;
}

.evaluate-form :deep(.n-form-item-label) {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.field-separator {
  margin: 14px 0 8px;
  padding-left: 10px;
  border-left: 2px solid #3b82f6;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.field-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

/* ──── Weight Items ──── */
.weight-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weight-item {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.weight-item:hover {
  border-color: rgba(59, 130, 246, 0.15);
  background: rgba(59, 130, 246, 0.04);
}

.weight-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.weight-icon {
  font-size: 14px;
  color: #3b82f6;
  opacity: 0.55;
}

.weight-val {
  margin-left: auto;
  font-weight: 700;
  font-size: 12px;
  color: #93c5fd;
  font-variant-numeric: tabular-nums;
}

/* ──── Premium Slider ──── */
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

/* ──── Resource Tag Grid ──── */
.resource-tag-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.resource-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.resource-tag:hover {
  border-color: rgba(59, 130, 246, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.resource-tag--checked {
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.08);
  color: #93c5fd;
}

.resource-checkbox {
  flex-shrink: 0;
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

.evaluate-panel--collapsed {
  width: 100% !important;
}
</style>
