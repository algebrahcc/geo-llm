<script setup lang="ts">
import {
  planningAdvanceAreaOptions,
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
  collapsed: boolean;
  pickModeLabel: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  plan: [];
  toggleCollapse: [];
  updateForm: [value: PlanningRouteSettingsForm];
  pickStart: [];
  pickEnd: [];
  pickWaypoint: [];
}>();

function updateField<K extends keyof PlanningRouteSettingsForm>(key: K, value: PlanningRouteSettingsForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}
</script>

<template>
  <div class="route-settings" :class="{ 'route-settings--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="settings-header">
      <div class="settings-title">
        <SvgIcon icon="mdi:routes" class="settings-title-icon" />
        <span>机动规划设置</span>
        <span class="settings-subtitle">(作为AI输入)</span>
      </div>
      <button type="button" class="collapse-btn" @click="emit('toggleCollapse')">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>
    </div>

    <template v-if="!collapsed">
      <div class="settings-scroll">
        <div class="settings-body">
          <div class="section">
            <div class="section-title">
              <span class="section-num">1</span>
              起点与途经点
            </div>
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

          <!-- §2 规划偏好 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">2</span>
              规划偏好
            </div>
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

          <!-- §3 推进区域 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">3</span>
              推进区域
            </div>
            <NCheckboxGroup
              :value="form.advanceAreas"
              :options="[...planningAdvanceAreaOptions]"
              class="checkbox-grid"
              @update:value="updateField('advanceAreas', $event as string[])"
            />
          </div>

          <!-- §4 道路与通行条件 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">4</span>
              道路与通行条件
            </div>
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

          <!-- §5 任务车辆编组信息 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">5</span>
              任务车辆编组信息
            </div>
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

          <!-- 底部提交按钮 -->
          <button type="button" class="submit-btn" :disabled="running" @click="emit('plan')">
            <SvgIcon v-if="running" icon="mdi:loading" class="btn-spin" />
            <SvgIcon v-else icon="mdi:lightning-bolt" />
            {{ running ? '正在规划中...' : '提交给AI智能规划' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.route-settings {
  display: flex;
  flex-direction: column;
}

.route-settings--collapsed .settings-scroll {
  display: none;
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
  color: #29b6ff;
}

.settings-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.45);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: rgba(41, 163, 255, 0.15);
  color: #29b6ff;
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
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  margin-bottom: 10px;
}

.section-num {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.18);
  color: #29b6ff;
  font-size: 11px;
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
  font-size: 12px;
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
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
  min-width: 52px;
  flex-shrink: 0;
}

.weight-item :deep(.n-slider) {
  flex: 1;
}

.weight-val {
  font-size: 11px;
  font-weight: 600;
  color: #29b6ff;
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
  margin-top: 4px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #29b6ff 0%, #2b6bff 100%);
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
</style>
