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
  /* 文本层级（白系为主，弱化用不透明度而非发灰，保证深色底可读） */
  --sp-t1: rgb(255 255 255 / 97%);
  --sp-t2: rgb(255 255 255 / 88%);
  --sp-t3: rgb(255 255 255 / 75%);
  --sp-accent: #8db8ff;
  --sp-line: rgb(255 255 255 / 8%);
  --sp-line-2: rgb(255 255 255 / 13%);

  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 底部提交按钮区（固定在面板底部，不随内容滚动，同渡河工程方案面板） */
.submit-area {
  padding: 10px 14px 12px;
  border-top: 1px solid var(--sp-line);
  background: rgb(15 20 35 / 95%);
  flex-shrink: 0;
}

/* 标题栏（扁平，与 AI 助手面板一致） */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--sp-line);
  flex-shrink: 0;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--sp-t1);
}

.settings-title-icon {
  font-size: 16px;
  color: var(--sp-accent);
}

/* 滚动区 */
.settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(141 184 255 / 24%) transparent;
}

.settings-scroll::-webkit-scrollbar {
  width: 5px;
}

.settings-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(141 184 255 / 24%);
}

.settings-body {
  padding: 12px 14px 14px;
}

/* 分区 */
.section {
  margin-bottom: 16px;
  border: 1px solid var(--sp-line);
  border-radius: 10px;
  background: rgb(255 255 255 / 2%);
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.section:hover {
  border-color: var(--sp-line-2);
}

/* 分区标题（可点击折叠；小标题恒大于其下正文） */
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
  font-weight: 700;
  color: var(--sp-t1);
  transition: background 0.15s ease;
  text-align: left;
}

.section-title:hover {
  background: rgb(74 125 189 / 8%);
}

.section-name {
  flex: 1;
}

.section-chevron {
  font-size: 15px;
  color: var(--sp-t3);
  transition: transform 0.2s ease;
}

.section-title:hover .section-chevron {
  color: var(--sp-accent);
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
  background: rgb(74 125 189 / 22%);
  color: var(--sp-accent);
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
  border: 1px solid rgb(52 211 153 / 30%);
  border-radius: 6px;
  background: rgb(52 211 153 / 8%);
  color: #34d399;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.pick-btn:hover {
  background: rgb(52 211 153 / 18%);
  border-color: rgb(52 211 153 / 50%);
}

.pick-btn--waypoint {
  border-color: rgb(251 191 36 / 30%);
  background: rgb(251 191 36 / 8%);
  color: #fbbf24;
}

.pick-btn--waypoint:hover {
  background: rgb(251 191 36 / 18%);
  border-color: rgb(251 191 36 / 50%);
}

/* 表单（标签为字段小标题：加粗白字，恒大于输入内容可读层级） */
.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--sp-t1);
  margin-bottom: 5px;
  letter-spacing: 0.02em;
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
  color: var(--sp-t2);
  min-width: 52px;
  flex-shrink: 0;
}

.weight-item :deep(.n-slider) {
  flex: 1;
}

.weight-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--sp-accent);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 复选框网格 */
.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.checkbox-grid :deep(.n-checkbox) {
  --n-text-color: var(--sp-t2);
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
  box-shadow: 0 4px 20px rgb(74 125 189 / 35%);
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
  border: 1px solid var(--sp-line-2);
  border-radius: 8px;
  background: rgb(255 255 255 / 3%);
  color: var(--sp-t2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.priority-pill:hover {
  border-color: rgb(124 184 255 / 45%);
  color: var(--sp-t1);
}

.priority-pill--active {
  border-color: rgb(124 184 255 / 65%);
  background: rgb(74 125 189 / 16%);
  color: var(--sp-accent);
  font-weight: 600;
}
</style>
