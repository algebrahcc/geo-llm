<script setup lang="ts">
import { ref, watch } from 'vue';
import { NButton, NInput, NDynamicInput, NSpin, NSwitch, NTag, useMessage } from 'naive-ui';
import { fetchDifyAppOrchestration, updateDifyAppOrchestration } from '@/service/api/difyApp';
import { fetchDifyParameters } from '@/service/api/dify';

const props = defineProps<{ appId: string | number | null }>();

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const proxyMissing = ref(false);

const promptTemplate = ref('');
const openingStatement = ref('');
const suggestedQuestions = ref<string[]>([]);
const variableForm = ref<Array<Record<string, unknown>>>([]);

/** 高级变量（Dify 编排中常用占位符），点击插入到系统提示词 */
const ADVANCED_VARIABLES: Array<{ label: string; token: string }> = [
  { label: '知识库上下文', token: '{{#context#}}' },
  { label: '当前问题', token: '{{#query#}}' },
  { label: '系统问题', token: '{{#sys.query#}}' },
  { label: '最近对话', token: '{{#conversation#}}' },
  { label: '文件内容', token: '{{#file#}}' }
];

/** 系统提示词输入框 DOM 引用，用于在光标处插入变量 */
const promptTextareaRef = ref<HTMLTextAreaElement | null>(null);

/** 用于在模板中展示的字面占位符（避免在模板文本中直接书写 {{ }} 触发编译器歧义） */
const contextToken = '{{#context#}}';

function varType(v: Record<string, unknown>) {
  return String(Object.keys(v)[0] ?? '');
}
function varSchema(v: Record<string, unknown>): Record<string, unknown> {
  const inner = Object.values(v)[0];
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {};
}

/** 在系统提示词中插入高级变量占位符（优先光标位置，否则追加到末尾） */
function insertVariable(token: string) {
  const textarea = promptTextareaRef.value;
  if (textarea && typeof textarea.selectionStart === 'number') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    promptTemplate.value = promptTemplate.value.slice(0, start) + token + promptTemplate.value.slice(end);
    // 光标移到插入内容之后
    requestAnimationFrame(() => {
      const pos = start + token.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  } else {
    promptTemplate.value += (promptTemplate.value ? '\n' : '') + token;
  }
}

async function load() {
  if (props.appId == null) return;
  loading.value = true;
  proxyMissing.value = false;
  try {
    const [orchRes, paramRes] = await Promise.all([
      fetchDifyAppOrchestration(props.appId),
      fetchDifyParameters(props.appId)
    ]);
    const cfg = (orchRes?.data ?? null) as Api.Dify.OrchestrationConfig | null;
    promptTemplate.value = String(cfg?.prompt_template ?? cfg?.pre_prompt ?? '');
    openingStatement.value = String(cfg?.opening_statement ?? '');
    suggestedQuestions.value = Array.isArray(cfg?.suggested_questions)
      ? (cfg!.suggested_questions as unknown[]).map(String)
      : [];
    // 优先取 model-config 中的 user_input_form，其次回退 /parameters
    if (Array.isArray(cfg?.user_input_form) && cfg!.user_input_form!.length) {
      variableForm.value = cfg!.user_input_form as Array<Record<string, unknown>>;
    } else {
      const params = (paramRes?.data ?? null) as Api.Dify.AppParameters | null;
      variableForm.value = Array.isArray(params?.user_input_form)
        ? (params!.user_input_form as Array<Record<string, unknown>>)
        : [];
    }
  } catch {
    proxyMissing.value = true;
    message.warning('加载提示词编排失败（后端可能未代理 /apps/{id}/model-config）');
  } finally {
    loading.value = false;
  }
}

watch(() => props.appId, load, { immediate: true });

async function save() {
  if (props.appId == null) return;
  saving.value = true;
  try {
    await updateDifyAppOrchestration(props.appId, {
      prompt_template: promptTemplate.value,
      opening_statement: openingStatement.value,
      suggested_questions: suggestedQuestions.value.filter(q => q.trim()),
      user_input_form: variableForm.value.filter(v => Object.keys(v).length > 0)
    });
    message.success('提示词编排已保存');
  } catch {
    message.error('保存失败，请确认后端已代理 /apps/{id}/model-config');
  } finally {
    saving.value = false;
  }
}

/** 更新某个变量的 schema 字段（label / required / default） */
function updateVarField(index: number, field: string, value: unknown) {
  const item = variableForm.value[index];
  const type = varType(item);
  const schema = varSchema(item);
  schema[field] = value;
  variableForm.value[index] = { [type]: schema };
}

/** 删除某个变量 */
function removeVar(index: number) {
  variableForm.value.splice(index, 1);
}
</script>

<template>
  <div class="prompt-editor">
    <div class="section-desc">
      编辑系统提示词（System Prompt）、开场白与追问问题，并可插入 Dify 高级变量占位符、维护输入变量表单。
    </div>

    <NSpin :show="loading">
      <div v-if="proxyMissing" class="section-desc warn">
        后端尚未代理「提示词编排」接口（/apps/{id}/model-config），暂无法读写。
      </div>

      <template v-else>
        <div class="field">
          <div class="field__head">
            <div class="field__label">系统提示词（System Prompt）</div>
            <div class="field__actions">
              <button
                v-for="v in ADVANCED_VARIABLES"
                :key="v.token"
                type="button"
                class="var-insert-btn"
                @click="insertVariable(v.token)"
              >
                {{ v.label }}
              </button>
            </div>
          </div>
          <NInput
            ref="promptTextareaRef"
            v-model:value="promptTemplate"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="例如：你是一名地理空间分析助手，回答需引用知识库中的地理数据……"
          />
          <div class="field__hint">
            点击上方按钮在光标处插入高级变量；知识库检索结果会注入
            <code>{{ contextToken }}</code>
            。
          </div>
        </div>

        <div class="field">
          <div class="field__label">开场白</div>
          <NInput
            v-model:value="openingStatement"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            placeholder="对话开始时向用户展示的引导语"
          />
        </div>

        <div class="field">
          <div class="field__label">追问问题</div>
          <NDynamicInput v-model:value="suggestedQuestions" :min="0" placeholder="输入一个建议追问">
            <template #default="{ value }">
              <NInput v-model:value="suggestedQuestions[suggestedQuestions.indexOf(value)]" />
            </template>
          </NDynamicInput>
        </div>

        <div class="field">
          <div class="field__label">输入变量表单</div>
          <div v-if="variableForm.length === 0" class="section-desc">该智能体未定义输入变量。</div>
          <div v-else class="var-form-list">
            <div v-for="(v, i) in variableForm" :key="i" class="var-form-item">
              <NTag size="small" round class="var-type">{{ varType(v) }}</NTag>
              <div class="var-form-grid">
                <div class="var-form-col">
                  <span class="var-form-sub">变量名（只读）</span>
                  <span class="var-form-readonly">{{ varSchema(v).variable ?? '' }}</span>
                </div>
                <div class="var-form-col">
                  <span class="var-form-sub">显示名称</span>
                  <NInput
                    :value="String(varSchema(v).label ?? '')"
                    size="small"
                    placeholder="显示名称"
                    @update:value="val => updateVarField(i, 'label', val)"
                  />
                </div>
                <div class="var-form-col">
                  <span class="var-form-sub">默认值</span>
                  <NInput
                    :value="String(varSchema(v).default ?? '')"
                    size="small"
                    placeholder="默认值（可选）"
                    @update:value="val => updateVarField(i, 'default', val)"
                  />
                </div>
                <div class="var-form-col">
                  <span class="var-form-sub">必填</span>
                  <NSwitch
                    :value="Boolean(varSchema(v).required)"
                    size="small"
                    @update:value="val => updateVarField(i, 'required', val)"
                  />
                </div>
              </div>
              <NButton text size="small" type="error" class="var-remove" @click="removeVar(i)">移除</NButton>
            </div>
          </div>
          <div class="field__hint">变量表单修改后会随编排一并保存到 Dify model-config 的 user_input_form。</div>
        </div>

        <div class="actions">
          <NButton type="primary" :loading="saving" @click="save">保存编排</NButton>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.prompt-editor {
  color: #eaf5ff;
}
.section-desc {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.65);
  margin-bottom: 12px;
}
.section-desc.warn {
  color: #ffce8a;
}
.field {
  margin-bottom: 16px;
}
.field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.field__label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(203, 227, 255, 0.85);
}
.field__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field__hint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(203, 227, 255, 0.5);
}
.field__hint code {
  color: var(--agent-accent, #34a8ff);
}
.var-insert-btn {
  appearance: none;
  background: rgba(25, 95, 176, 0.18);
  border: 1px solid rgba(61, 166, 255, 0.3);
  color: rgba(203, 227, 255, 0.85);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.var-insert-btn:hover {
  border-color: var(--agent-accent, #34a8ff);
  color: #eaf5ff;
  background: rgba(25, 95, 176, 0.3);
}
.var-form-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.var-form-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(25, 95, 176, 0.35);
  border-radius: var(--agent-radius-sm, 8px);
  background: rgba(7, 28, 52, 0.5);
}
.var-type {
  flex-shrink: 0;
}
.var-form-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 0.5fr;
  gap: 10px;
  flex: 1;
  align-items: end;
}
.var-form-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.var-form-sub {
  font-size: 11px;
  color: rgba(203, 227, 255, 0.5);
}
.var-form-readonly {
  font-size: 12px;
  color: rgba(203, 227, 255, 0.85);
  word-break: break-all;
  padding: 3px 0;
}
.var-remove {
  flex-shrink: 0;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
@media (max-width: 900px) {
  .var-form-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
