<script setup lang="ts">
import { ref } from 'vue';
import {
  planningAdvancePriorityOptions,
  planningArrivalDeadlineOptions,
  planningDifficultyOptions,
  planningFleetScaleOptions,
  planningRoadGradeOptions,
  planningRoutePrefOptions,
  planningTaskTypeOptions,
  planningVehicleModelOptions
} from '@/mock/planning';
import type { PlanningRouteSettingsForm } from './types';

defineOptions({
  name: 'PlanningRouteSettingsPanel'
});

interface Props {
  form: PlanningRouteSettingsForm;
  running: boolean;
  pickModeLabel: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  plan: [];
  updateForm: [value: PlanningRouteSettingsForm];
  pickStart: [];
  pickEnd: [];
  pickWaypoint: [];
}>();

function updateField<K extends keyof PlanningRouteSettingsForm>(key: K, value: PlanningRouteSettingsForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}

// ──── 分区折叠（每个步骤可收缩） ────
const sectionCollapsed = ref<Record<string, boolean>>({ s1: false, s2: false, s3: false, s4: false, s5: false });

function toggleSection(key: string) {
  sectionCollapsed.value[key] = !sectionCollapsed.value[key];
}
</script>

<template>
  <div class="route-settings">
    <!-- 标题栏（对标渡河工程方案设置面板：仅标题） -->
    <div class="settings-header">
      <div class="settings-title">
        <SvgIcon icon="mdi:routes" class="settings-title-icon" />
        <span>机动规划设置</span>
      </div>
    </div>

    <div class="settings-scroll">
      <div class="settings-body">
        <div class="section">
          <button type="button" class="section-title" @click="toggleSection('s1')">
            <span class="section-num">1</span>
            <span class="section-name">起点与途经点</span>
            <SvgIcon class="section-chevron" :icon="sectionCollapsed.s1 ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
          </button>
          <div v-show="!sectionCollapsed.s1" class="section-body">
            <div class="pick-group">
              <label class="form-label">起点</label>
              <div class="pick-input-row">
                <NInput
                  :value="form.startName"
                  size="small"
                  placeholder="输入或点选起点"
                  @update:value="updateField('startName', $event)"
                />
                <button type="button" class="pick-btn" @click="emit('pickStart')">
                  <SvgIcon icon="mdi:crosshairs-gps" />
                </button>
              </div>
            </div>
            <div class="pick-group">
              <label class="form-label">途经点</label>
              <div class="pick-input-row">
                <NInput
                  :value="form.waypointName"
                  size="small"
                  placeholder="可选途经点"
                  @update:value="updateField('waypointName', $event)"
                />
                <button type="button" class="pick-btn pick-btn--waypoint" @click="emit('pickWaypoint')">
                  <SvgIcon icon="mdi:crosshairs-gps" />
                </button>
              </div>
            </div>
            <div class="pick-group">
              <label class="form-label">终点</label>
              <div class="pick-input-row">
                <NInput
                  :value="form.endName"
                  size="small"
                  placeholder="输入或点选终点"
                  @update:value="updateField('endName', $event)"
                />
                <button type="button" class="pick-btn" @click="emit('pickEnd')">
                  <SvgIcon icon="mdi:crosshairs-gps" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- §2 规划偏好 -->
        <div class="section">
          <button type="button" class="section-title" @click="toggleSection('s2')">
            <span class="section-num">2</span>
            <span class="section-name">规划偏好</span>
            <SvgIcon class="section-chevron" :icon="sectionCollapsed.s2 ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
          </button>
          <div v-show="!sectionCollapsed.s2" class="section-body">
            <div class="form-group">
              <label class="form-label">路线偏好</label>
              <NSelect
                :value="form.routePreference"
                :options="[...planningRoutePrefOptions]"
                size="small"
                @update:value="updateField('routePreference', $event)"
              />
            </div>
            <div class="weight-row">
              <div class="weight-item">
                <label class="weight-label">时间权重</label>
                <NSlider
                  :value="form.timeWeight"
                  :min="0"
                  :max="100"
                  :step="5"
                  size="small"
                  @update:value="updateField('timeWeight', $event)"
                />
                <span class="weight-val">{{ form.timeWeight }}%</span>
              </div>
              <div class="weight-item">
                <label class="weight-label">距离权重</label>
                <NSlider
                  :value="form.distanceWeight"
                  :min="0"
                  :max="100"
                  :step="5"
                  size="small"
                  @update:value="updateField('distanceWeight', $event)"
                />
                <span class="weight-val">{{ form.distanceWeight }}%</span>
              </div>
              <div class="weight-item">
                <label class="weight-label">风险权重</label>
                <NSlider
                  :value="form.riskWeight"
                  :min="0"
                  :max="100"
                  :step="5"
                  size="small"
                  @update:value="updateField('riskWeight', $event)"
                />
                <span class="weight-val">{{ form.riskWeight }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- §3 推进区域 -->
        <div class="section">
          <button type="button" class="section-title" @click="toggleSection('s3')">
            <span class="section-num">3</span>
            <span class="section-name">推进区域</span>
            <SvgIcon class="section-chevron" :icon="sectionCollapsed.s3 ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
          </button>
          <div v-show="!sectionCollapsed.s3" class="section-body">
            <div class="form-group">
              <label class="form-label">推进优先级</label>
              <div class="priority-row">
                <button
                  v-for="opt in planningAdvancePriorityOptions"
                  :key="opt.value"
                  type="button"
                  class="priority-pill"
                  :class="{ 'priority-pill--active': form.advancePriority === opt.value }"
                  @click="updateField('advancePriority', opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- §4 道路与通行条件 -->
        <div class="section">
          <button type="button" class="section-title" @click="toggleSection('s4')">
            <span class="section-num">4</span>
            <span class="section-name">道路与通行条件</span>
            <SvgIcon class="section-chevron" :icon="sectionCollapsed.s4 ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
          </button>
          <div v-show="!sectionCollapsed.s4" class="section-body">
            <div class="form-group">
              <label class="form-label">道路等级</label>
              <NSelect
                :value="form.roadGrade"
                :options="[...planningRoadGradeOptions]"
                size="small"
                @update:value="updateField('roadGrade', $event)"
              />
            </div>
            <div class="form-group">
              <label class="form-label">难度等级</label>
              <NCheckboxGroup
                :value="form.difficultyLevels"
                :options="[...planningDifficultyOptions]"
                class="checkbox-grid"
                @update:value="updateField('difficultyLevels', $event as string[])"
              />
            </div>
          </div>
        </div>

        <!-- §5 任务车辆编组信息 -->
        <div class="section">
          <button type="button" class="section-title" @click="toggleSection('s5')">
            <span class="section-num">5</span>
            <span class="section-name">任务车辆编组信息</span>
            <SvgIcon class="section-chevron" :icon="sectionCollapsed.s5 ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
          </button>
          <div v-show="!sectionCollapsed.s5" class="section-body">
            <div class="form-group">
              <label class="form-label">任务类型</label>
              <NSelect
                :value="form.taskType"
                :options="[...planningTaskTypeOptions]"
                size="small"
                @update:value="updateField('taskType', $event)"
              />
            </div>
            <div class="form-row">
              <div class="form-group form-group--half">
                <label class="form-label">车队规模</label>
                <NSelect
                  :value="form.fleetScale"
                  :options="[...planningFleetScaleOptions]"
                  size="small"
                  @update:value="updateField('fleetScale', $event)"
                />
              </div>
              <div class="form-group form-group--half">
                <label class="form-label">车型类型</label>
                <NSelect
                  :value="form.vehicleModel"
                  :options="[...planningVehicleModelOptions]"
                  size="small"
                  @update:value="updateField('vehicleModel', $event)"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">到达时限</label>
              <NSelect
                :value="form.arrivalDeadline"
                :options="[...planningArrivalDeadlineOptions]"
                size="small"
                @update:value="updateField('arrivalDeadline', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部提交按钮（固定在面板底部，不随内容滚动，同渡河工程方案面板） -->
    <div class="submit-area">
      <button type="button" class="submit-btn" :disabled="running" @click="emit('plan')">
        <SvgIcon v-if="running" icon="mdi:loading" class="btn-spin" />
        <SvgIcon v-else icon="mdi:lightning-bolt" />
        {{ running ? '正在规划中...' : '提交给AI智能规划' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.route-settings {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 底部提交按钮区（固定在面板底部，不随内容滚动，同渡河工程方案面板） */
.submit-area {
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(15, 20, 35, 0.95);
  flex-shrink: 0;
}

/* 标题栏 */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(90deg, rgba(41, 163, 255, 0.08) 0%, rgba(43, 107, 255, 0.04) 100%);
  border-bottom: 1px solid rgba(41, 163, 255, 0.1);
  flex-shrink: 0;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.settings-title-icon {
  font-size: 16px;
  color: #4a7dbd;
}

/* 滚动区 */
.settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.24) transparent;
}

.settings-scroll::-webkit-scrollbar {
  width: 5px;
}

.settings-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.24);
}

.settings-body {
  padding: 12px 14px 14px;
}

/* 分区 */
.section {
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

/* 分区标题（可点击折叠） */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  transition: background 0.15s ease;
  text-align: left;
}

.section-title:hover {
  background: rgba(41, 163, 255, 0.07);
}

.section-name {
  flex: 1;
}

.section-chevron {
  font-size: 15px;
  color: rgba(147, 196, 255, 0.55);
  transition: transform 0.2s ease;
}

.section-title:hover .section-chevron {
  color: rgba(41, 163, 255, 0.9);
}

/* 分区内容 */
.section-body {
  padding: 2px 12px 12px;
}

.section-num {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.18);
  color: #4a7dbd;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 输入组 */
.pick-group {
  margin-bottom: 8px;
}

.pick-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(46, 229, 157, 0.25);
  border-radius: 6px;
  background: rgba(46, 229, 157, 0.08);
  color: #2ee59d;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.pick-btn:hover {
  background: rgba(46, 229, 157, 0.18);
  border-color: rgba(46, 229, 157, 0.45);
}

.pick-btn--waypoint {
  border-color: rgba(251, 191, 36, 0.25);
  background: rgba(251, 191, 36, 0.08);
  color: #fbbf24;
}

.pick-btn--waypoint:hover {
  background: rgba(251, 191, 36, 0.18);
  border-color: rgba(251, 191, 36, 0.45);
}

/* 表单 */
.form-label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.56);
  margin-bottom: 5px;
}

.form-group {
  margin-bottom: 10px;
}

.form-group--half {
  flex: 1;
  min-width: 0;
}

.form-row {
  display: flex;
  gap: 10px;
}

/* 权重滑块 */
.weight-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weight-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weight-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
  min-width: 52px;
  flex-shrink: 0;
}

.weight-item :deep(.n-slider) {
  flex: 1;
}

.weight-val {
  font-size: 12px;
  font-weight: 600;
  color: #4a7dbd;
  min-width: 32px;
  text-align: right;
}

/* 复选框网格 */
.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.checkbox-grid :deep(.n-checkbox) {
  --n-text-color: rgba(255, 255, 255, 0.78);
}

/* 提交按钮 */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4a7dbd 0%, #3d6fb4 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(41, 163, 255, 0.35);
  transform: translateY(-1px);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ──── 推进优先级 ──── */
.priority-row {
  display: flex;
  gap: 8px;
}

.priority-pill {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(203, 227, 255, 0.75);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.priority-pill:hover {
  border-color: rgba(41, 163, 255, 0.45);
  color: rgba(255, 255, 255, 0.92);
}

.priority-pill--active {
  border-color: rgba(41, 163, 255, 0.65);
  background: rgba(41, 163, 255, 0.14);
  color: #8db8ff;
  font-weight: 600;
}
</style>
