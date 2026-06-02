<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SelectMixedOption } from 'naive-ui';
import {
  planningAvoidanceOptions,
  planningFormationOptions,
  planningPriorityOptions,
  planningRoadTypeOptions,
  planningTerrainOptions,
  planningVehicleTypeOptions
} from '@/mock/planning';
import type { PlanningMissionForm, PlanningWaypoint } from './types';

defineOptions({
  name: 'PlanningMissionPanel'
});

interface Props {
  form: PlanningMissionForm;
  running: boolean;
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
});

const emit = defineEmits<{
  updateForm: [value: PlanningMissionForm];
  plan: [];
  addWaypoint: [];
  removeWaypoint: [id: string];
  reorderWaypoints: [fromIndex: number, toIndex: number];
  toggleCollapse: [];
}>();

// 途经点拖拽状态
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function handleDragStart(index: number) {
  dragIndex.value = index;
}

function handleDragOver(index: number, event: DragEvent) {
  event.preventDefault();
  dragOverIndex.value = index;
}

function handleDragLeave() {
  dragOverIndex.value = null;
}

function handleDrop(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    emit('reorderWaypoints', dragIndex.value, index);
  }
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function handleDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function updateFormField<K extends keyof PlanningMissionForm>(key: K, value: PlanningMissionForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}

function updateWaypointName(id: string, name: string) {
  const newWaypoints = props.form.waypoints.map(wp =>
    wp.id === id ? { ...wp, name } : wp
  );
  emit('updateForm', { ...props.form, waypoints: newWaypoints });
}

const priorityLabel = computed(() => {
  const opt = planningPriorityOptions.find(o => o.value === props.form.priorityCondition);
  return opt?.label || props.form.priorityCondition;
});

const vehicleLabel = computed(() => {
  const opt = planningVehicleTypeOptions.find(o => o.value === props.form.vehicleType);
  return opt?.label || props.form.vehicleType;
});

const formationLabel = computed(() => {
  const opt = planningFormationOptions.find(o => o.value === props.form.formationType);
  return opt?.label || props.form.formationType;
});
</script>

<template>
  <div class="mission-panel" :class="{ 'mission-panel--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="mission-panel__header">
      <div class="mission-panel__title">
        <SvgIcon icon="mdi:map-marker-radius-outline" class="mission-panel__title-icon" />
        机动方案设置
      </div>
      <button type="button" class="mission-panel__collapse-btn" @click="emit('toggleCollapse')">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>
    </div>

    <!-- 折叠时只显示标题 -->
    <template v-if="!collapsed">
      <div class="mission-panel__scroll">
        <div class="mission-panel__body">
          <!-- 起点与终点 -->
          <div class="section">
          <div class="section-title">起点与终点</div>
          <div class="point-item point-item--start">
            <div class="point-icon point-icon--start">
              <SvgIcon icon="mdi:map-marker" />
            </div>
            <div class="point-info">
              <span class="point-label">起点</span>
              <span class="point-name">{{ form.startName }}</span>
            </div>
          </div>
          <div class="point-item point-item--end">
            <div class="point-icon point-icon--end">
              <SvgIcon icon="mdi:map-marker" />
            </div>
            <div class="point-info">
              <span class="point-label">终点</span>
              <span class="point-name">{{ form.endName }}</span>
            </div>
          </div>
        </div>

        <!-- 途经点 -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">途经点（可拖拽排序）</span>
          </div>
          <div class="waypoint-list">
            <div
              v-for="(wp, index) in form.waypoints"
              :key="wp.id"
              class="waypoint-item"
              :class="{
                'waypoint-item--dragging': dragIndex === index,
                'waypoint-item--dragover': dragOverIndex === index
              }"
              draggable="true"
              @dragstart="handleDragStart(index)"
              @dragover="handleDragOver(index, $event)"
              @dragleave="handleDragLeave"
              @drop="handleDrop(index)"
              @dragend="handleDragEnd"
            >
              <div class="waypoint-order">{{ index + 1 }}</div>
              <div class="waypoint-name-wrap">
                <NInput
                  :value="wp.name"
                  size="small"
                  :bordered="false"
                  placeholder="输入途经点名称"
                  class="waypoint-name-input"
                  @update:value="updateWaypointName(wp.id, $event)"
                />
              </div>
              <button
                type="button"
                class="waypoint-remove"
                @click="emit('removeWaypoint', wp.id)"
              >
                <SvgIcon icon="mdi:close" />
              </button>
            </div>
          </div>
          <button type="button" class="add-waypoint-btn" @click="emit('addWaypoint')">
            <SvgIcon icon="mdi:plus" />
            添加途经点
          </button>
        </div>

        <!-- 路线偏好 -->
        <div class="section">
          <div class="section-title">路线偏好</div>
          <div class="form-group">
            <label class="form-label">优先条件</label>
            <NSelect
              :value="form.priorityCondition"
              :options="planningPriorityOptions as SelectMixedOption[]"
              size="small"
              class="form-select"
              @update:value="updateFormField('priorityCondition', $event)"
            />
          </div>
          <div class="form-group">
            <label class="form-label">道路类型偏好</label>
            <NCheckboxGroup
              :value="form.roadTypePreferences"
              :options="planningRoadTypeOptions as SelectMixedOption[]"
              class="form-checkbox-group"
              @update:value="updateFormField('roadTypePreferences', $event as string[])"
            />
          </div>
          <div class="form-group">
            <label class="form-label">地形偏好</label>
            <NSelect
              :value="form.terrainPreference"
              :options="planningTerrainOptions as SelectMixedOption[]"
              size="small"
              class="form-select"
              @update:value="updateFormField('terrainPreference', $event)"
            />
          </div>
        </div>

        <!-- 避让条件 -->
        <div class="section">
          <div class="section-title">避让条件</div>
          <NCheckboxGroup
            :value="form.avoidanceConditions"
            :options="planningAvoidanceOptions as SelectMixedOption[]"
            class="form-checkbox-group"
            @update:value="updateFormField('avoidanceConditions', $event as string[])"
          />
        </div>

        <!-- 车辆与编组 -->
        <div class="section">
          <div class="section-title">车辆与编组</div>
          <div class="form-row">
            <div class="form-group form-group--half">
              <label class="form-label">车辆类型</label>
              <NSelect
                :value="form.vehicleType"
                :options="planningVehicleTypeOptions as SelectMixedOption[]"
                size="small"
                class="form-select"
                @update:value="updateFormField('vehicleType', $event)"
              />
            </div>
            <div class="form-group form-group--half">
              <label class="form-label">车辆数量</label>
              <div class="input-with-suffix">
                <NInputNumber
                  :value="form.vehicleCount"
                  :min="1"
                  :max="500"
                  size="small"
                  class="form-input-number"
                  @update:value="updateFormField('vehicleCount', $event ?? 1)"
                />
                <span class="input-suffix">辆</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">编组方式</label>
            <NSelect
              :value="form.formationType"
              :options="planningFormationOptions as SelectMixedOption[]"
              size="small"
              class="form-select"
              @update:value="updateFormField('formationType', $event)"
            />
          </div>
        </div>

          <!-- 智能规划按钮 -->
          <NButton
            type="primary"
            block
            :loading="running"
            class="plan-btn"
            @click="emit('plan')"
          >
            <template #icon>
              <SvgIcon icon="mdi:auto-fix" />
            </template>
            智能规划
          </NButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mission-panel {
  width: 100%;
  border: none;
  background: transparent;
  backdrop-filter: none;
  border-radius: 0;
}

.mission-panel--collapsed .mission-panel__scroll {
  display: none;
}

.mission-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(41, 163, 255, 0.06);
  border-bottom: 1px solid rgba(41, 163, 255, 0.1);
  cursor: pointer;
}

.mission-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.mission-panel__title-icon {
  font-size: 16px;
  color: #29b6ff;
}

.mission-panel__collapse-btn {
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

.mission-panel__collapse-btn:hover {
  background: rgba(41, 163, 255, 0.15);
  color: #29b6ff;
}

.mission-panel__scroll {
  overflow: visible;
}

.mission-panel__body {
  padding: 16px;
}

.section {
  margin-bottom: 18px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  margin-bottom: 8px;
}

.section-header .section-title {
  margin-bottom: 0;
}

/* 起终点 */
.point-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(41, 163, 255, 0.1);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.04);
  margin-bottom: 6px;
}

.point-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
}

.point-icon--start {
  background: rgba(46, 229, 157, 0.15);
  color: #2ee59d;
}

.point-icon--end {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
}

.point-info {
  display: flex;
  flex-direction: column;
}

.point-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
}

.point-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

/* 途经点 */
.waypoint-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.waypoint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(41, 163, 255, 0.1);
  border-radius: 6px;
  background: rgba(41, 163, 255, 0.04);
  cursor: grab;
  transition: all 0.2s ease;
}

.waypoint-item:active {
  cursor: grabbing;
}

.waypoint-item--dragging {
  opacity: 0.5;
  border-color: rgba(41, 163, 255, 0.4);
  background: rgba(41, 163, 255, 0.1);
}

.waypoint-item--dragover {
  border-color: #29b6ff;
  border-style: dashed;
}

.waypoint-order {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(41, 163, 255, 0.15);
  color: #29b6ff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.waypoint-name-wrap {
  flex: 1;
  min-width: 0;
}

.waypoint-name-input :deep(.n-input__input-el),
.waypoint-name-input :deep(.n-input__content-el) {
  color: rgba(255, 255, 255, 0.92) !important;
}

.waypoint-remove {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.waypoint-remove:hover {
  background: rgba(251, 113, 133, 0.15);
  color: #fb7185;
}

.add-waypoint-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border: 1px dashed rgba(41, 163, 255, 0.25);
  border-radius: 6px;
  background: transparent;
  color: rgba(41, 163, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-waypoint-btn:hover {
  border-color: rgba(41, 163, 255, 0.5);
  background: rgba(41, 163, 255, 0.08);
  color: #29b6ff;
}

/* 表单 */
.form-group {
  margin-bottom: 12px;
}

.form-group--half {
  flex: 1;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.56);
  margin-bottom: 6px;
}

.form-select {
  width: 100%;
}

.form-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form-checkbox-group :deep(.n-checkbox) {
  --n-text-color: rgba(255, 255, 255, 0.78);
}

.input-with-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-suffix {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.56);
  flex-shrink: 0;
}

.plan-btn {
  margin-top: 8px;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #29b6ff 0%, #2b6bff 100%);
  border: none;
}
</style>
