<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from '@/components/custom/svg-icon.vue';
import { renameDifyConversation } from '@/service/api/dify';

defineOptions({ name: 'AgentConversationSidebar' });

/**
 * 会话侧栏组件（仅对话型应用）：
 * 新对话 / 会话列表（切换 / 重命名 / 删除），重命名弹窗自包含，成功后通过 renamed 事件通知父级更新列表。
 */

const props = defineProps<{
  list: Api.Dify.ConversationItem[];
  loading: boolean;
  /** 当前会话 id（高亮态） */
  activeId: string;
  /** 当前智能体 dify app 主键 id（雪花 Long 字符串，可空） */
  appId?: string;
  userId?: string;
}>();

const emit = defineEmits<{
  new: [];
  select: [id: string];
  remove: [id: string];
  renamed: [conv: Api.Dify.ConversationItem, name: string];
}>();

/** 会话标题：name → introduction → 兜底文案 */
function convTitle(conv: Api.Dify.ConversationItem) {
  return conv.name || conv.introduction || '未命名会话';
}

/** 会话时间：updated_at → created_at（Dify 返回秒级时间戳） */
function convTime(conv: Api.Dify.ConversationItem) {
  const t = conv.updated_at || conv.created_at;
  if (!t) return '';
  return new Date(t * 1000).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** 重命名弹窗状态（自包含） */
const renameTarget = ref<Api.Dify.ConversationItem | null>(null);
const renameValue = ref('');
const renameLoading = ref(false);

function openRenameDialog(conv: Api.Dify.ConversationItem) {
  renameTarget.value = conv;
  renameValue.value = conv.name || conv.introduction || '';
}

/** 关闭重命名弹窗：清空目标与输入值 */
function closeRenameDialog() {
  renameTarget.value = null;
  renameValue.value = '';
}

async function submitRename() {
  const target = renameTarget.value;
  if (!target || !props.appId || !props.userId) return;
  const name = renameValue.value.trim();
  if (!name) {
    window.$message?.warning('请输入会话名称');
    return;
  }
  renameLoading.value = true;
  try {
    await renameDifyConversation({
      appId: props.appId,
      userId: props.userId,
      conversationId: target.id,
      name,
      autoGenerateName: false
    });
    closeRenameDialog();
    emit('renamed', target, name);
    window.$message?.success('会话已重命名');
  } catch {
    // 后端已提示错误
  } finally {
    renameLoading.value = false;
  }
}
</script>

<template>
  <div class="conversation-pane">
    <div class="conversation-pane__head">
      <NButton text size="small" class="conversation-pane__new" @click="emit('new')">
        <template #icon>
          <SvgIcon icon="mdi:plus" />
        </template>
        新对话
      </NButton>
    </div>
    <div v-if="loading" class="conversation-pane__loading">加载中…</div>
    <div v-else-if="!list.length" class="conversation-pane__loading">暂无历史会话</div>
    <div v-else class="conversation-pane__list">
      <button
        v-for="conv in list"
        :key="conv.id"
        type="button"
        class="conversation-item"
        :class="{ 'conversation-item--active': conv.id === activeId }"
        @click="emit('select', conv.id)"
      >
        <span class="conversation-item__title">{{ convTitle(conv) }}</span>
        <span v-if="convTime(conv)" class="conversation-item__time">{{ convTime(conv) }}</span>
        <span class="conversation-item__actions">
          <span class="conversation-item__action" title="重命名会话" @click.stop="openRenameDialog(conv)">
            <SvgIcon icon="mdi:pencil-outline" />
          </span>
          <span
            class="conversation-item__action conversation-item__action--danger"
            title="删除会话"
            @click.stop="emit('remove', conv.id)"
          >
            <SvgIcon icon="mdi:trash-can-outline" />
          </span>
        </span>
      </button>
    </div>

    <!-- 会话重命名弹窗 -->
    <NModal
      :show="!!renameTarget"
      preset="card"
      title="重命名会话"
      style="max-width: 420px"
      :bordered="false"
      @update:show="
        val => {
          if (!val) closeRenameDialog();
        }
      "
    >
      <NInput
        v-model:value="renameValue"
        placeholder="请输入新的会话名称"
        maxlength="80"
        clearable
        autofocus
        @keyup.enter="submitRename"
      />
      <template #footer>
        <div class="flex justify-end gap-8px">
          <NButton size="small" @click="closeRenameDialog">取消</NButton>
          <NButton type="primary" size="small" :loading="renameLoading" @click="submitRename">确定</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
/* 历史会话列 */
.conversation-pane {
  flex: 0 0 212px;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--agent-line);

  &__head {
    flex-shrink: 0;
    padding: 10px;
    border-bottom: 1px solid var(--agent-line);
  }

  &__new {
    color: rgba(41, 163, 255, 0.9);
  }

  &__loading {
    padding: 14px 12px;
    font-size: 12px;
    color: rgba(203, 227, 255, 0.45);
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
}

.conversation-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(203, 227, 255, 0.72);
  text-align: left;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: rgba(41, 163, 255, 0.1);
  }

  &--active {
    background: rgba(41, 163, 255, 0.16);
    color: #29a3ff;
  }

  &__title {
    width: 100%;
    padding-right: 22px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__time {
    font-size: 10px;
    color: rgba(203, 227, 255, 0.35);
  }

  &__actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &__action {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: rgba(203, 227, 255, 0.45);
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: rgba(41, 163, 255, 0.18);
      color: #29a3ff;
    }

    &--danger:hover {
      background: rgba(255, 90, 120, 0.16);
      color: #ff7a95;
    }
  }

  &:hover &__actions,
  &--active &__actions {
    opacity: 1;
  }
}

@media (max-width: 1199px) {
  .conversation-pane {
    flex-basis: 168px;
  }
}
</style>
