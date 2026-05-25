<script setup lang="ts">
import { computed } from 'vue';
import type { PlanningOption, PlanningTaskForm } from './types';

defineOptions({
  name: 'PlanningTaskPanel'
});

interface Props {
  collapsed: boolean;
  form: PlanningTaskForm;
  running: boolean;
  pickModeLabel: string;
  preferenceOptions: readonly PlanningOption[];
  constraintOptions: readonly PlanningOption[];
}

const props = defineProps<Props>();

const selectOptions = computed(() => props.preferenceOptions.map(item => ({ ...item })));
const checkboxOptions = computed(() => props.constraintOptions.map(item => ({ ...item })));

const emit = defineEmits<{
  plan: [];
  toggleCollapse: [];
  updateForm: [value: PlanningTaskForm];
  pickStart: [];
  pickEnd: [];
}>();

function updateField<K extends keyof PlanningTaskForm>(key: K, value: PlanningTaskForm[K]) {
  emit('updateForm', {
    ...props.form,
    [key]: value
  });
}
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="task-panel"
    :class="[{ 'task-panel--collapsed': collapsed }]"
    :content-style="{ maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }"
  >
    <template #header>
      <div class="panel-title-wrap">
        <div class="title-group">
          <SvgIcon icon="mdi:file-document-edit-outline" class="panel-icon" />
          <span>任务输入</span>
        </div>
        <div class="header-actions">
          <NTag :bordered="false" size="small" :type="running ? 'warning' : 'info'">
            {{ running ? '规划中' : pickModeLabel }}
          </NTag>
          <NButton quaternary circle size="small" @click="emit('toggleCollapse')">
            <template #icon>
              <SvgIcon :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" />
            </template>
          </NButton>
        </div>
      </div>
    </template>

    <div v-if="!collapsed">
      <div class="panel-desc">先在左侧输入任务与约束，再在球上点选起终点，生成三条候选路线进行对比。</div>

      <NForm label-placement="top" size="small" class="task-form">
        <NFormItem label="任务名称">
          <NInput :value="form.taskName" @update:value="updateField('taskName', $event)" />
        </NFormItem>
        <NFormItem label="起点">
          <div class="pick-input-group">
            <NInput :value="form.startName" @update:value="updateField('startName', $event)" />
            <NButton secondary @click="emit('pickStart')">点选</NButton>
          </div>
        </NFormItem>
        <NFormItem label="终点">
          <div class="pick-input-group">
            <NInput :value="form.endName" @update:value="updateField('endName', $event)" />
            <NButton secondary @click="emit('pickEnd')">点选</NButton>
          </div>
        </NFormItem>
        <NFormItem label="路线偏好">
          <NSelect
            :value="form.routePreference"
            :options="selectOptions"
            @update:value="updateField('routePreference', $event)"
          />
        </NFormItem>
        <NFormItem label="约束条件">
          <NCheckboxGroup
            :value="form.constraints"
            :options="checkboxOptions"
            @update:value="updateField('constraints', $event as string[])"
          />
        </NFormItem>
        <div class="coord-grid">
          <div class="coord-item">
            <span class="coord-label">起点坐标</span>
            <span class="coord-value">
              {{ form.startLongitude?.toFixed(4) ?? '--' }}, {{ form.startLatitude?.toFixed(4) ?? '--' }}
            </span>
          </div>
          <div class="coord-item">
            <span class="coord-label">终点坐标</span>
            <span class="coord-value">
              {{ form.endLongitude?.toFixed(4) ?? '--' }}, {{ form.endLatitude?.toFixed(4) ?? '--' }}
            </span>
          </div>
        </div>
      </NForm>

      <NButton type="primary" block :loading="running" class="plan-btn" @click="emit('plan')">智能规划</NButton>
    </div>
  </NCard>
</template>

<style scoped>
.task-panel {
  width: 340px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(14px);
}

.task-panel :deep(.n-card__content) {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.56) rgba(255, 255, 255, 0.06);
}

.task-panel :deep(.n-card__content::-webkit-scrollbar) {
  width: 10px;
}

.task-panel :deep(.n-card__content::-webkit-scrollbar-thumb) {
  border: 2px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(141, 184, 255, 0.72), rgba(43, 107, 255, 0.42));
  background-clip: padding-box;
}

.task-panel :deep(.n-card__content::-webkit-scrollbar-thumb:hover) {
  background: linear-gradient(180deg, rgba(141, 184, 255, 0.9), rgba(43, 107, 255, 0.6));
}

.task-panel :deep(.n-card__content::-webkit-scrollbar-track) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.panel-icon {
  font-size: 16px;
  color: #2b6bff;
}

.panel-desc {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.66);
}

.task-form {
  margin-top: 14px;
}

.pick-input-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.coord-grid {
  display: grid;
  gap: 8px;
}

.coord-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}

.coord-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.52);
}

.coord-value {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.plan-btn {
  margin-top: 8px;
}

.task-panel--collapsed {
  width: 224px;
}
</style>
