<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentDefinition, AgentRunTask, AgentStepStatus } from '@/mock/agent';

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
  waiting: 'text-[#94a3b8]',
  running: 'text-[#fbbf24]',
  success: 'text-[#34d399]',
  failed: 'text-[#fb7185]'
} as const;
</script>

<template>
  <NCard :bordered="false" class="stage-card">
    <template #header>
      <div class="flex items-center justify-between gap-12px">
        <div>
          <div class="text-16px font-700 text-[#f8fafc]">能力链路</div>
          <div class="mt-4px text-12px text-[#8ea3bd]">{{ agent.name }} 的标准执行流程与当前任务状态。</div>
        </div>
        <NTag size="small" round :bordered="false" type="info">{{ agent.version }}</NTag>
      </div>
    </template>

    <div class="grid gap-12px md:grid-cols-2 xl:grid-cols-4">
      <div v-for="stage in stages" :key="stage.key" class="stage-item">
        <div class="flex items-center justify-between gap-12px">
          <div class="stage-icon" :class="[colorMap[stage.status]]">
            <SvgIcon :icon="iconMap[stage.status]" />
          </div>
          <span class="text-12px text-[#7890ad]">{{ stage.duration }}</span>
        </div>
        <div class="mt-12px text-14px font-600 text-[#f8fafc]">{{ stage.label }}</div>
        <div class="mt-8px text-12px leading-20px text-[#94a3b8]">{{ stage.description }}</div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.stage-card {
  border-radius: 20px;
  background: var(
    --agent-card-bg,
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82))
  );
  border: 1px solid var(--agent-card-border, rgba(148, 163, 184, 0.12));
  box-shadow: var(--agent-card-shadow, none);
}

.stage-item {
  padding: 14px;
  border: 1px solid var(--agent-card-border, rgba(148, 163, 184, 0.12));
  border-radius: 18px;
  background: var(--agent-panel-bg, rgba(15, 23, 42, 0.4));
}

.stage-icon {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--agent-tag-bg, rgba(255, 255, 255, 0.05));
}

.stage-card :deep(.text-\[\#f8fafc\]) {
  color: var(--agent-title, #0f172a) !important;
}

.stage-card :deep(.text-\[\#8ea3bd\]),
.stage-card :deep(.text-\[\#7890ad\]),
.stage-card :deep(.text-\[\#94a3b8\]) {
  color: var(--agent-subtitle, #64748b) !important;
}
</style>
