<script setup lang="ts">
import { ref, watch } from 'vue';
import { resourceOptions } from '@/mock/river';
import type { CrossingSettingForm } from './types';

const props = defineProps<{
  form: CrossingSettingForm;
  collapsed: boolean;
  running: boolean;
}>();

const emit = defineEmits<{
  (e: 'update-form', form: CrossingSettingForm): void;
  (e: 'submit'): void;
  (e: 'toggle-collapse'): void;
  (e: 'close'): void;
}>();

const localForm = ref<CrossingSettingForm>({ ...props.form });

watch(
  () => props.form,
  val => {
    localForm.value = { ...val };
  },
  { deep: true }
);

const taskTypeOptions = [
  { label: '渡河保障', value: '渡河保障' },
  { label: '伴随保障', value: '伴随保障' },
  { label: '桥位抢修', value: '桥位抢修' },
  { label: '门桥渡河', value: '门桥渡河' }
];

const forceScaleOptions = [
  { label: '1个连', value: '1个连' },
  { label: '1个营', value: '1个营' },
  { label: '1个合成营', value: '1个合成营' },
  { label: '1个团', value: '1个团' }
];

// ──── 区块折叠（次要信息默认折叠，点击标题展开） ────
const sectionCollapsed = ref<Record<string, boolean>>({
  mission: false,
  basic: true,
  hydrology: false,
  env: true,
  resource: false,
  constraint: true
});

function toggleSection(key: string) {
  sectionCollapsed.value[key] = !sectionCollapsed.value[key];
}

// ──── 表单变化 ────
function handleFormChange() {
  emit('update-form', { ...localForm.value });
}

function handleResourceToggle(value: string) {
  const idx = localForm.value.availableResources.indexOf(value);
  if (idx >= 0) {
    localForm.value.availableResources.splice(idx, 1);
  } else {
    localForm.value.availableResources.push(value);
  }
  handleFormChange();
}

function handleSubmit() {
  emit('submit');
}
</script>

<template>
  <div class="setting-panel" :class="{ 'setting-panel--collapsed': collapsed }">
    <!-- ══ 标题栏 ══ -->
    <div class="panel-header">
      <span class="header-title">渡河工程方案设置</span>
      <div class="header-actions">
        <button type="button" class="action-btn" title="折叠" @click="emit('toggle-collapse')">
          <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
        <button type="button" class="action-btn" title="关闭" @click="emit('close')">
          <SvgIcon icon="mdi:close" />
        </button>
      </div>
    </div>

    <!-- ══ 内容滚动区 ══ -->
    <div v-show="!collapsed" class="panel-content">
      <!-- 作战任务 -->
      <div class="form-section">
        <div class="section-label section-label--mission" @click="toggleSection('mission')">
          作战任务
          <SvgIcon class="section-chevron" :icon="sectionCollapsed.mission ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>
        <div v-show="!sectionCollapsed.mission" class="section-body">
          <div class="form-field">
            <label class="field-label">任务名称</label>
            <input v-model="localForm.taskName" type="text" class="field-input" @input="handleFormChange" />
          </div>
          <div class="form-field">
            <label class="field-label">渡河位置</label>
            <div class="field-input-with-icon">
              <input v-model="localForm.location" type="text" class="field-input" @input="handleFormChange" />
              <span class="input-icon">📍</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务基础 -->
      <div class="form-section">
        <div class="section-label section-label--basic" @click="toggleSection('basic')">
          任务基础
          <SvgIcon class="section-chevron" :icon="sectionCollapsed.basic ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>
        <div v-show="!sectionCollapsed.basic" class="section-body">
          <div class="form-row">
            <div class="form-field flex-1">
              <label class="field-label">任务类型</label>
              <NSelect v-model:value="localForm.taskType" :options="taskTypeOptions" @update:value="handleFormChange" />
            </div>
            <div class="form-field flex-1">
              <label class="field-label">行动时间</label>
              <input
                v-model="localForm.actionTime"
                type="text"
                class="field-input"
                placeholder="2026-06-15 06:00"
                @input="handleFormChange"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">保障兵力</label>
            <NSelect
              v-model:value="localForm.forceScale"
              :options="forceScaleOptions"
              @update:value="handleFormChange"
            />
          </div>
        </div>
      </div>

      <!-- 水文要素（渡河决策核心） -->
      <div class="form-section form-section--hydrology">
        <div class="section-label section-label--hydrology" @click="toggleSection('hydrology')">
          水文要素
          <span class="section-hint">渡河决策核心</span>
          <SvgIcon class="section-chevron" :icon="sectionCollapsed.hydrology ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>
        <div v-show="!sectionCollapsed.hydrology" class="section-body">
          <div class="form-row">
            <div class="form-field flex-1">
              <label class="field-label">河宽 (m)</label>
              <input
                v-model.number="localForm.riverWidth"
                type="number"
                class="field-input field-input--accent"
                @input="handleFormChange"
              />
            </div>
            <div class="form-field flex-1">
              <label class="field-label">水深范围</label>
              <input
                v-model="localForm.waterDepthRange"
                type="text"
                class="field-input field-input--accent"
                placeholder="8~15m"
                @input="handleFormChange"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field flex-1">
              <label class="field-label">流速</label>
              <input
                v-model="localForm.flowVelocity"
                type="text"
                class="field-input field-input--accent"
                placeholder="2.5~3.5 m/s"
                @input="handleFormChange"
              />
            </div>
            <div class="form-field flex-1">
              <label class="field-label">河床地形</label>
              <input
                v-model="localForm.riverbedTerrain"
                type="text"
                class="field-input field-input--accent"
                placeholder="砂卵石为主"
                @input="handleFormChange"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 环境条件 -->
      <div class="form-section">
        <div class="section-label section-label--env" @click="toggleSection('env')">
          环境条件
          <SvgIcon class="section-chevron" :icon="sectionCollapsed.env ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>
        <div v-show="!sectionCollapsed.env" class="section-body">
          <div class="form-row">
            <div class="form-field flex-1">
              <label class="field-label">天气条件</label>
              <input
                v-model="localForm.weatherCondition"
                type="text"
                class="field-input"
                placeholder="晴 28°C"
                @input="handleFormChange"
              />
            </div>
            <div class="form-field flex-1">
              <label class="field-label">能见度 (km)</label>
              <input
                v-model.number="localForm.visibilityKm"
                type="number"
                class="field-input"
                @input="handleFormChange"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">战略意图</label>
            <input
              v-model="localForm.strategicIntent"
              type="text"
              class="field-input"
              placeholder="无明确敌情"
              @input="handleFormChange"
            />
          </div>
        </div>
      </div>

      <!-- 可用资源 -->
      <div class="form-section">
        <div class="section-label section-label--resource" @click="toggleSection('resource')">
          可用资源
          <SvgIcon class="section-chevron" :icon="sectionCollapsed.resource ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </div>
        <div v-show="!sectionCollapsed.resource" class="section-body">
          <div class="resource-grid">
            <label
              v-for="opt in resourceOptions"
              :key="opt.value"
              class="resource-checkbox"
              :class="{ 'resource-checkbox--checked': localForm.availableResources.includes(opt.value) }"
            >
              <input
                type="checkbox"
                :checked="localForm.availableResources.includes(opt.value)"
                @change="handleResourceToggle(opt.value)"
              />
              <span class="checkbox-label">{{ opt.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 约束与其他 -->
      <div class="form-section">
        <div class="section-label section-label--constraint" @click="toggleSection('constraint')">
          约束与其他
          <SvgIcon
            class="section-chevron"
            :icon="sectionCollapsed.constraint ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          />
        </div>
        <div v-show="!sectionCollapsed.constraint" class="section-body">
          <div class="form-field form-field--key">
            <label class="field-label">时间约束</label>
            <input
              v-model="localForm.timeConstraint"
              type="text"
              class="field-input"
              placeholder="3小时内完成渡河"
              @input="handleFormChange"
            />
          </div>
          <div class="form-field">
            <label class="field-label">其他要求</label>
            <textarea v-model="localForm.otherRequirements" class="field-textarea" rows="2" @input="handleFormChange" />
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 提交按钮（sticky底部） ══ -->
    <div v-show="!collapsed" class="submit-area">
      <button type="button" class="submit-btn" :disabled="running" @click="handleSubmit">
        <span class="btn-text">{{ running ? 'AI 分析中...' : '提交给 AI 智能分析' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ──── 根 ──── */
.setting-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ──── 标题栏 ──── */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-icon {
  font-size: 16px;
}

.header-title {
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 16px;
  transition:
    background 0.18s,
    color 0.18s;
}

.action-btn:hover {
  background: rgba(43, 107, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

/* ──── 滚动区 ──── */
.panel-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 5px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

/* ──── 表单分区 ──── */
.form-section {
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  overflow: hidden;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.02);
  letter-spacing: 0.02em;
  border-left: 2px solid rgba(93, 140, 200, 0.45);
  cursor: pointer;
  user-select: none;
}

.section-label:hover {
  color: rgba(255, 255, 255, 0.85);
}

.section-chevron {
  margin-left: auto;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
}

/* ──── 水文要素重点区块（仅字号与底色层级，黑白灰） ──── */
.form-section--hydrology {
  border-color: rgba(93, 140, 200, 0.4);
  background: rgba(93, 140, 200, 0.05);
}

.section-label--hydrology {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.94);
  background: rgba(93, 140, 200, 0.09);
  border-left: 2px solid rgba(120, 170, 230, 0.95);
}

.section-hint {
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.38);
  letter-spacing: 0.04em;
}

/* 水文参数输入：字号略大 + 等宽数字 */
.field-input--accent {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  font-variant-numeric: tabular-nums;
}

/* 时间约束（硬条件）：琥珀语义 */
.form-field--key .field-label {
  color: #c9a45c;
  font-weight: 600;
}

.form-field--key .field-input {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  border-color: rgba(201, 164, 92, 0.45);
  background: rgba(201, 164, 92, 0.05);
}

.section-body {
  padding: 8px 12px 10px;
}

/* ──── 表单字段 ──── */
.form-field {
  margin-bottom: 6px;
}

.form-field:last-child {
  margin-bottom: 0;
}

.form-row {
  display: flex;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.field-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  margin-bottom: 3px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
  box-sizing: border-box;
}

.field-input:hover,
.field-textarea:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
}

.field-input:focus,
.field-textarea:focus {
  border-color: rgba(93, 140, 200, 0.5);
  background: rgba(93, 140, 200, 0.05);
}

.field-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 48px;
}

.field-input-with-icon {
  position: relative;
}

.field-input-with-icon .field-input {
  padding-right: 30px;
}

.input-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  pointer-events: none;
  opacity: 0.6;
}

/* ──── 资源网格 ──── */
.resource-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.resource-checkbox {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  padding: 5px 9px;
  border-radius: 7px;
  transition: background 0.15s;
  border: 1px solid transparent;
}

.resource-checkbox:hover {
  background: rgba(43, 107, 255, 0.06);
}

.resource-checkbox--checked {
  background: rgba(93, 140, 200, 0.09);
  border-color: rgba(93, 140, 200, 0.42);
}

.resource-checkbox input[type='checkbox'] {
  accent-color: #4a7dbd;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
}

.checkbox-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.15s;
}

.resource-checkbox--checked .checkbox-label {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

/* ──── Sticky 提交按钮 ──── */
.submit-area {
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 20, 35, 0.95);
  flex-shrink: 0;
}

.submit-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  border: none;
  border-radius: 8px;
  background: #3d6fb4;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  letter-spacing: 0.02em;
}

.submit-btn:hover:not(:disabled) {
  background: #35619f;
}

.submit-btn:active:not(:disabled) {
  background: #1e40af;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-text {
  font-size: 13px;
}
</style>
