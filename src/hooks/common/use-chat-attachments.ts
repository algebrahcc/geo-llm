import { ref } from 'vue';

/** 聊天消息附件元数据（随消息展示，离线场景保留原始 File 供下载） */
export interface ChatAttachment {
  id: string;
  name: string;
  /** 字节数 */
  size: number;
  /** MIME 类型 */
  type: string;
  /** 原始文件引用（用于本地下载；历史消息或流式场景可能缺省） */
  file?: File;
}

interface UseChatAttachmentsOptions {
  /** 单条消息最多附件数 */
  maxCount?: number;
  /** 单文件大小上限（MB） */
  maxSizeMB?: number;
}

const DEFAULT_MAX_COUNT = 5;
const DEFAULT_MAX_SIZE_MB = 20;

/** 格式化附件大小（B / KB / MB） */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 按扩展名 / MIME 类型返回附件展示图标（mdi 名称） */
export function attachmentIcon(name: string, type: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('image/')) return 'mdi:image-outline';
  if (type.startsWith('video/')) return 'mdi:file-video-outline';
  if (type.startsWith('audio/')) return 'mdi:file-music-outline';
  if (ext === 'pdf') return 'mdi:file-pdf-outline';
  if (['doc', 'docx'].includes(ext)) return 'mdi:file-word-outline';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'mdi:file-excel-outline';
  if (['ppt', 'pptx'].includes(ext)) return 'mdi:file-powerpoint-outline';
  if (['zip', 'rar', '7z'].includes(ext)) return 'mdi:folder-zip-outline';
  if (['txt', 'md', 'log', 'json'].includes(ext)) return 'mdi:file-document-outline';
  return 'mdi:file-outline';
}

/**
 * 聊天输入附件能力：选择 / 待发送预览 / 移除 / 随消息带走 / 本地下载。
 * 渡河方案助手与机动路线规划助手两个面板共用。
 */
export function useChatAttachments(options: UseChatAttachmentsOptions = {}) {
  const { maxCount = DEFAULT_MAX_COUNT, maxSizeMB = DEFAULT_MAX_SIZE_MB } = options;

  /** 待发送附件 */
  const pendingAttachments = ref<ChatAttachment[]>([]);
  /** 隐藏的文件选择 input 引用 */
  const fileInputRef = ref<HTMLInputElement | null>(null);

  function openFilePicker() {
    fileInputRef.value?.click();
  }

  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    addFiles(files);
  }

  function addFiles(files: File[]) {
    for (const file of files) {
      if (pendingAttachments.value.length >= maxCount) {
        window.$message?.warning(`单条消息最多附加 ${maxCount} 个文件`);
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        window.$message?.warning(`「${file.name}」超过 ${maxSizeMB}MB，未添加`);
        continue;
      }
      const duplicated = pendingAttachments.value.some(item => item.name === file.name && item.size === file.size);
      if (duplicated) continue;
      pendingAttachments.value.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file
      });
    }
  }

  function removePendingAttachment(id: string) {
    pendingAttachments.value = pendingAttachments.value.filter(item => item.id !== id);
  }

  /** 发送时取走全部待发送附件（并清空待发送区） */
  function takePendingAttachments(): ChatAttachment[] {
    const list = pendingAttachments.value;
    pendingAttachments.value = [];
    return list;
  }

  /** 下载附件（离线演示：用本地对象 URL 触发浏览器下载） */
  function downloadAttachment(attachment: ChatAttachment) {
    if (!attachment.file) return;
    const url = URL.createObjectURL(attachment.file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return {
    pendingAttachments,
    fileInputRef,
    openFilePicker,
    handleFileInputChange,
    removePendingAttachment,
    takePendingAttachments,
    downloadAttachment
  };
}
