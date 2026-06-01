<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { AgentDefinition, AgentTestRecord } from '@/mock/agent';

const props = defineProps<{
  agent: AgentDefinition;
  latestRecord?: AgentTestRecord | null;
}>();

const emit = defineEmits<{
  run: [prompt: string];
}>();

const prompt = ref(props.agent.defaultInput);

watch(
  () => props.agent.key,
  () => {
    prompt.value = props.agent.defaultInput;
  },
  { immediate: true }
);

const quickPrompts = computed(() => props.agent.recommendedPrompts);

function handleRun(target?: string) {
  emit('run', (target || prompt.value).trim());
}
</script>

<template>
  <div class="grid gap-10px xl:grid-cols-[1.1fr_0.9fr]">
    <div class="panel-surface">
      <div class="panel-head">
        <SvgIcon icon="mdi:play-circle-outline" class="panel-head__icon" />
        <span class="panel-head__title">智能体测试</span>
      </div>
      <div class="panel-body">
        <div class="section-desc">直接输入 Prompt，验证当前智能体配置和输出效果。</div>
        <NInput v-model:value="prompt" type="textarea" :autosize="{ minRows: 6, maxRows: 10 }" class="mt-10px" />
        <div class="mt-10px flex flex-wrap gap-4px">
          <NTag
            v-for="item in quickPrompts"
            :key="item"
            size="small"
            round
            :bordered="false"
            class="quick-tag"
            @click="handleRun(item)"
          >
            {{ item }}
          </NTag>
        </div>
        <div class="mt-14px flex justify-end">
          <NButton type="primary" @click="handleRun()">开始测试</NButton>
        </div>
      </div>
    </div>

    <div class="panel-surface">
      <div class="panel-head">
        <SvgIcon icon="mdi:text-box-check-outline" class="panel-head__icon" />
        <span class="panel-head__title">最近结果</span>
      </div>
      <div class="panel-body">
        <div v-if="latestRecord" class="flex flex-col gap-10px">
          <div class="result-block">{{ latestRecord.response }}</div>
          <div class="flex flex-col gap-6px">
            <div v-for="step in latestRecord.steps" :key="step.label" class="step-card">
              <div class="step-label">{{ step.label }}</div>
              <div class="step-detail">{{ step.detail }}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-4px">
            <NTag v-for="item in latestRecord.references" :key="item" size="small" round :bordered="false">
              {{ item }}
            </NTag>
          </div>
        </div>

        <NEmpty v-else description="暂无测试结果" class="py-20px" />
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

.quick-tag {
  cursor: pointer;
  background: rgba(41, 163, 255, 0.1);
  border: 1px solid rgba(41, 163, 255, 0.22);
  color: rgba(203, 227, 255, 0.82);
}

.result-block {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(6, 20, 38, 0.5);
  border: 1px solid rgba(25, 95, 176, 0.18);
  color: rgba(41, 163, 255, 0.85);
  font-size: 13px;
  line-height: 22px;
}

.step-card {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(12, 38, 72, 0.4);
  border: 1px solid rgba(25, 95, 176, 0.12);
}

.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #eaf5ff;
}

.step-detail {
  margin-top: 4px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(203, 227, 255, 0.55);
}
</style>
