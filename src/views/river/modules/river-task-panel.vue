<script setup lang="ts">
import { computed } from 'vue';
import type { RiverTaskForm } from './types';

defineOptions({
  name: 'RiverTaskPanel'
});

interface Props {
  collapsed: boolean;
  form: RiverTaskForm;
  running: boolean;
  taskTypeOptions: ReadonlyArray<{ label: string; value: string }>;
}

const props = defineProps<Props>();
const selectOptions = computed(() => props.taskTypeOptions.map(item => ({ ...item })));

const emit = defineEmits<{
  analyze: [];
  toggleCollapse: [];
  updateForm: [value: RiverTaskForm];
}>();

function updateField<K extends keyof RiverTaskForm>(key: K, value: RiverTaskForm[K]) {
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
            {{ running ? '分析中' : '待发起' }}
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
      <div class="panel-desc">围绕渡河任务配置范围、兵力与时限，启动智能分析生成候选方案。</div>

      <NForm label-placement="top" size="small" class="task-form">
        <NFormItem label="任务名称">
          <NInput :value="form.taskName" @update:value="updateField('taskName', $event)" />
        </NFormItem>
        <NFormItem label="任务类型">
          <NSelect :value="form.taskType" :options="selectOptions" @update:value="updateField('taskType', $event)" />
        </NFormItem>
        <NFormItem label="任务范围">
          <NInput :value="form.taskRange" @update:value="updateField('taskRange', $event)" />
        </NFormItem>
        <div class="field-grid">
          <NFormItem label="部队规模">
            <NInput :value="form.troopScale" @update:value="updateField('troopScale', $event)" />
          </NFormItem>
          <NFormItem label="车辆数量">
            <NInput :value="form.vehicleCount" @update:value="updateField('vehicleCount', $event)" />
          </NFormItem>
        </div>
        <NFormItem label="主要装备">
          <NInput :value="form.mainEquipment" @update:value="updateField('mainEquipment', $event)" />
        </NFormItem>
        <NFormItem label="时间要求">
          <NInput :value="form.timeRequirement" @update:value="updateField('timeRequirement', $event)" />
        </NFormItem>
      </NForm>

      <NButton type="primary" block :loading="running" class="analyze-btn" @click="emit('analyze')">智能分析</NButton>
    </div>
  </NCard>
</template>

<style scoped>
.task-panel {
  width: 336px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(14px);
}

.task-panel :deep(.n-card__content) {
  scrollbar-width: thin;
  scrollbar-color: rgba(141, 184, 255, 0.38) rgba(255, 255, 255, 0.05);
}

.task-panel :deep(.n-card__content::-webkit-scrollbar) {
  width: 8px;
}

.task-panel :deep(.n-card__content::-webkit-scrollbar-thumb) {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(141, 184, 255, 0.38);
  background-clip: padding-box;
}

.task-panel :deep(.n-card__content::-webkit-scrollbar-track) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
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

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.analyze-btn {
  margin-top: 8px;
}

.task-panel--collapsed {
  width: 224px;
}
</style>
