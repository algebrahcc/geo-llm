<script setup lang="ts">
import {
  planningFuelTypeOptions,
  planningMissionCauseOptions,
  planningSupportConstraintOptions,
  planningVehicleTypeOptions
} from '@/mock/planning';
import type { PlanningSupportSettingsForm } from './types';

defineOptions({
  name: 'PlanningSupportSettingsPanel'
});

interface Props {
  form: PlanningSupportSettingsForm;
  running: boolean;
  collapsed: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  plan: [];
  toggleCollapse: [];
  updateForm: [value: PlanningSupportSettingsForm];
}>();

function updateField<K extends keyof PlanningSupportSettingsForm>(key: K, value: PlanningSupportSettingsForm[K]) {
  emit('updateForm', { ...props.form, [key]: value });
}
</script>

<template>
  <div class="support-settings" :class="{ 'support-settings--collapsed': collapsed }">
    <!-- 标题栏 -->
    <div class="settings-header">
      <div class="settings-title">
        <SvgIcon icon="mdi:shield-check-outline" class="settings-title-icon" />
        <span>机动保障方案设置</span>
        <span class="settings-subtitle">(作为AI输入)</span>
      </div>
      <button type="button" class="collapse-btn" @click="emit('toggleCollapse')">
        <SvgIcon :icon="collapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>
    </div>

    <template v-if="!collapsed">
      <div class="settings-scroll">
        <div class="settings-body">
          <!-- §1 机动任务信息 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">1</span>
              机动任务信息
            </div>
            <div class="form-group">
              <label class="form-label">任务名称</label>
              <NInput :value="form.missionName" size="small" placeholder="输入任务名称" @update:value="updateField('missionName', $event)" />
            </div>
            <div class="form-group">
              <label class="form-label">任务起因</label>
              <NSelect
                :value="form.missionCause"
                :options="[...planningMissionCauseOptions]"
                size="small"
                @update:value="updateField('missionCause', $event)"
              />
            </div>
            <div class="form-group">
              <label class="form-label">任务描述</label>
              <NInput
                :value="form.missionDesc"
                type="textarea"
                size="small"
                :rows="2"
                placeholder="简要描述任务目标"
                @update:value="updateField('missionDesc', $event)"
              />
            </div>
            <div class="form-row">
              <div class="form-group form-group--half">
                <label class="form-label">人员数量</label>
                <NInputNumber
                  :value="form.personnelCount"
                  :min="1"
                  :max="10000"
                  size="small"
                  style="width: 100%"
                  @update:value="updateField('personnelCount', $event ?? 1)"
                />
              </div>
              <div class="form-group form-group--half">
                <label class="form-label">车辆数量</label>
                <NInputNumber
                  :value="form.vehicleCount"
                  :min="1"
                  :max="1000"
                  size="small"
                  style="width: 100%"
                  @update:value="updateField('vehicleCount', $event ?? 1)"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">预计完成时限</label>
              <NInput :value="form.deadline" size="small" placeholder="如：24小时" @update:value="updateField('deadline', $event)" />
            </div>
          </div>

          <!-- §2 车辆与油料信息 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">2</span>
              车辆与油料信息
            </div>
            <div class="form-group">
              <label class="form-label">车辆类型</label>
              <NSelect
                :value="form.vehicleType"
                :options="[...planningVehicleTypeOptions]"
                size="small"
                @update:value="updateField('vehicleType', $event)"
              />
            </div>
            <div class="form-row">
              <div class="form-group form-group--half">
                <label class="form-label">平均油耗 (L/100km)</label>
                <NInputNumber
                  :value="form.avgFuelConsumption"
                  :min="1"
                  :max="200"
                  size="small"
                  style="width: 100%"
                  @update:value="updateField('avgFuelConsumption', $event ?? 30)"
                />
              </div>
              <div class="form-group form-group--half">
                <label class="form-label">油料类型</label>
                <NSelect
                  :value="form.fuelType"
                  :options="[...planningFuelTypeOptions]"
                  size="small"
                  @update:value="updateField('fuelType', $event)"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">油料量 (L)</label>
              <NInputNumber
                :value="form.fuelAmount"
                :min="0"
                :max="100000"
                :step="100"
                size="small"
                style="width: 100%"
                @update:value="updateField('fuelAmount', $event ?? 0)"
              />
            </div>
          </div>

          <!-- §3 保障需求 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">3</span>
              保障需求
            </div>
            <div class="form-group">
              <label class="form-label">保障等级</label>
              <div class="slider-row">
                <NSlider :value="form.supportLevel" :min="0" :max="100" :step="5" size="small" @update:value="updateField('supportLevel', $event)" />
                <span class="slider-val">{{ form.supportLevel }}%</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">保障项目</label>
              <div class="checkbox-group">
                <label class="custom-checkbox">
                  <input type="checkbox" :checked="form.needRepair" @change="updateField('needRepair', ($event.target as HTMLInputElement).checked)" />
                  <span class="check-mark" />
                  维修保障
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" :checked="form.needRushRepair" @change="updateField('needRushRepair', ($event.target as HTMLInputElement).checked)" />
                  <span class="check-mark" />
                  抢修保障
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">其他需求</label>
              <NInput :value="form.otherNeeds" size="small" placeholder="如有其他保障需求请输入" @update:value="updateField('otherNeeds', $event)" />
            </div>
          </div>

          <!-- §4 时间与约束 -->
          <div class="section">
            <div class="section-title">
              <span class="section-num">4</span>
              时间与约束
            </div>
            <div class="form-row">
              <div class="form-group form-group--half">
                <label class="form-label">出发时间</label>
                <NInput :value="form.departTime" size="small" placeholder="如：06:00" @update:value="updateField('departTime', $event)" />
              </div>
              <div class="form-group form-group--half">
                <label class="form-label">到达时间</label>
                <NInput :value="form.arriveTime" size="small" placeholder="如：18:00" @update:value="updateField('arriveTime', $event)" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">机动时长要求</label>
              <NInput :value="form.durationLimit" size="small" placeholder="如：12小时" @update:value="updateField('durationLimit', $event)" />
            </div>
            <div class="form-group">
              <label class="form-label">约束条件</label>
              <NCheckboxGroup
                :value="form.constraints"
                :options="[...planningSupportConstraintOptions]"
                class="checkbox-grid"
                @update:value="updateField('constraints', $event as string[])"
              />
            </div>
          </div>

          <!-- 底部提交按钮 -->
          <button type="button" class="submit-btn" :disabled="running" @click="emit('plan')">
            <SvgIcon v-if="running" icon="mdi:loading" class="btn-spin" />
            <SvgIcon v-else icon="mdi:lightning-bolt" />
            {{ running ? '正在分析中...' : '提交给AI智能分析' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.support-settings {
  display: flex;
  flex-direction: column;
}

.support-settings--collapsed .settings-scroll {
  display: none;
}

/* 标题栏 */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(90deg, rgba(46, 229, 157, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%);
  border-bottom: 1px solid rgba(46, 229, 157, 0.1);
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
  color: #2ee59d;
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
  background: rgba(46, 229, 157, 0.15);
  color: #2ee59d;
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
  background: rgba(46, 229, 157, 0.18);
  color: #2ee59d;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
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

/* 滑块行 */
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-row :deep(.n-slider) {
  flex: 1;
}

.slider-val {
  font-size: 12px;
  font-weight: 600;
  color: #2ee59d;
  min-width: 36px;
  text-align: right;
}

/* 自定义复选框 */
.checkbox-group {
  display: flex;
  gap: 16px;
}

.custom-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  user-select: none;
}

.custom-checkbox input {
  display: none;
}

.check-mark {
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(46, 229, 157, 0.35);
  border-radius: 4px;
  background: rgba(46, 229, 157, 0.06);
  transition: all 0.2s ease;
  position: relative;
}

.custom-checkbox input:checked + .check-mark {
  background: rgba(46, 229, 157, 0.2);
  border-color: #2ee59d;
}

.custom-checkbox input:checked + .check-mark::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #2ee59d;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
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
  background: linear-gradient(135deg, #2ee59d 0%, #34d399 100%);
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.02em;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(46, 229, 157, 0.35);
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
  to { transform: rotate(360deg); }
}
</style>
