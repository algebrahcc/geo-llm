<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentDefinition, AgentRunTask, AgentStepStatus } from './types';

const props = defineProps<{
  agent: AgentDefinition;
  task?: AgentRunTask | null;
}>();

type StageItem = {
  key: string;
  label: string;
  description: string;
  status: AgentStepStatus;
  duration: string;
};

const stages = computed<StageItem[]>(() => {
  const fallback: StageItem[] = [
    { key: 'intent', label: '输入理解', description: '解析任务、时间和空间范围', status: 'waiting', duration: '--' },
    { key: 'retrieve', label: '知识检索', description: '关联知识、模板和上下文', status: 'waiting', duration: '--' },
    { key: 'reason', label: '智能推理', description: '形成判断、方案或结论', status: 'waiting', duration: '--' },
    { key: 'output', label: '结果输出', description: '输出结构化文本与引用', status: 'waiting', duration: '--' }
  ];

  if (!props.task) return fallback;

  return props.task.steps.map(step => ({
    ...step,
    description: step.description
  }));
});

const iconMap = {
  waiting: 'mdi:clock-outline',
  running: 'mdi:progress-clock',
  success: 'mdi:check-circle-outline',
  failed: 'mdi:close-circle-outline'
} as const;

const colorMap = {
  waiting: 'rgba(147, 196, 255, 0.5)',
  running: '#ffb020',
  success: '#00d4aa',
  failed: '#ff5c5c'
} as const;
</script>

<template>
  <div class="panel-surface">
    <div class="panel-head">
      <SvgIcon icon="mdi:link-variant" class="panel-head__icon" />
      <span class="panel-head__title">能力链路</span>
      <NTag size="small" round :bordered="false" type="info" class="ml-auto">{{ agent.version }}</NTag>
    </div>
    <div class="panel-body">
      <div class="section-desc">{{ agent.name }} 的标准执行流程与当前任务状态。</div>
      <div class="grid gap-10px md:grid-cols-2 xl:grid-cols-4 mt-10px">
        <div v-for="stage in stages" :key="stage.key" class="stage-item">
          <div class="flex items-center justify-between gap-8px">
            <div class="stage-icon" :style="{ color: colorMap[stage.status] }">
              <SvgIcon :icon="iconMap[stage.status]" />
            </div>
            <span class="stage-duration">{{ stage.duration }}</span>
          </div>
          <div class="stage-label">{{ stage.label }}</div>
          <div class="stage-desc">{{ stage.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stage-item {
  padding: 14px;
  border: 1px solid rgba(25, 95, 176, 0.2);
  border-radius: var(--agent-radius-sm);
  background: rgba(6, 20, 38, 0.5);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.stage-item:hover {
  border-color: rgba(61, 166, 255, 0.32);
  background: rgba(10, 32, 58, 0.6);
  box-shadow: 0 6px 20px rgba(2, 10, 22, 0.4);
  transform: translateY(-1px);
}

.stage-icon {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: var(--agent-radius-sm);
  background: rgba(41, 163, 255, 0.1);
  box-shadow: 0 0 12px rgba(52, 168, 255, 0.15);
  font-size: 15px;
}

.stage-duration {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.45);
}

.stage-label {
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #eaf5ff;
}

.stage-desc {
  margin-top: 4px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
}
</style>
