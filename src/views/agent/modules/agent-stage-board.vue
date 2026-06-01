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
.panel-surface {
  background: linear-gradient(180deg, rgba(3, 19, 41, 0.94) 0%, rgba(2, 15, 32, 0.96) 100%);
  border: 1px solid rgba(43, 131, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(32, 111, 202, 0.22), 0 18px 40px rgba(1, 8, 18, 0.45);
  border-radius: 4px;
  position: relative;
}

.panel-surface::before,
.panel-surface::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 2;
  opacity: 0.35;
}

.panel-surface::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid #29a3ff;
  border-left: 2px solid #29a3ff;
  border-radius: 4px 0 0 0;
}

.panel-surface::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid #29a3ff;
  border-right: 2px solid #29a3ff;
  border-radius: 0 0 4px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(25, 95, 176, 0.35);
  background: linear-gradient(180deg, rgba(10, 38, 72, 0.96) 0%, rgba(5, 25, 47, 0.96) 100%);
  position: relative;
}

.panel-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(180deg, transparent, #29a3ff, transparent);
  opacity: 0.5;
}

.panel-head__icon {
  font-size: 16px;
  color: #29a3ff;
  filter: drop-shadow(0 0 4px rgba(41, 163, 255, 0.25));
}

.panel-head__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #eaf5ff;
  text-shadow: 0 0 8px rgba(41, 163, 255, 0.12);
}

.panel-body {
  padding: 14px;
}

.section-desc {
  font-size: 11px;
  color: rgba(147, 196, 255, 0.5);
}

.stage-item {
  padding: 12px;
  border: 1px solid rgba(25, 95, 176, 0.18);
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
}

.stage-icon {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(41, 163, 255, 0.08);
  font-size: 14px;
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
