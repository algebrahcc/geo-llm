<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import { useThemeStore } from '@/store/modules/theme';

defineOptions({ name: 'ThemeDrawer' });

const appStore = useAppStore();
const themeStore = useThemeStore();

const layoutMode = computed({
  get: () => themeStore.layout.mode,
  set: (val: UnionKey.ThemeLayoutMode) => {
    themeStore.setThemeLayout(val);
  }
});

const scrollMode = computed({
  get: () => themeStore.layout.scrollMode,
  set: (val: UnionKey.ThemeScrollMode) => {
    themeStore.layout.scrollMode = val;
  }
});

const layoutModeOptions: { label: string; value: UnionKey.ThemeLayoutMode }[] = [
  { label: '垂直', value: 'vertical' },
  { label: '水平', value: 'horizontal' },
  { label: '垂直混合', value: 'vertical-mix' },
  { label: '垂直-混合（顶栏一级）', value: 'vertical-hybrid-header-first' },
  { label: '顶部混合（侧栏一级）', value: 'top-hybrid-sidebar-first' },
  { label: '顶部混合（顶栏一级）', value: 'top-hybrid-header-first' }
];

const scrollModeOptions: { label: string; value: UnionKey.ThemeScrollMode }[] = [
  { label: '外层滚动', value: 'wrapper' },
  { label: '内容区滚动', value: 'content' }
];

const themeColor = computed({
  get: () => themeStore.themeColor,
  set: (val: string) => {
    themeStore.updateThemeColors('primary', val);
  }
});

const themeRadius = computed({
  get: () => themeStore.themeRadius,
  set: (val: number | null) => {
    themeStore.themeRadius = val ?? 0;
  }
});

const siderWidth = computed({
  get: () => themeStore.sider.width,
  set: (val: number | null) => {
    themeStore.sider.width = val ?? 0;
  }
});

const siderCollapsedWidth = computed({
  get: () => themeStore.sider.collapsedWidth,
  set: (val: number | null) => {
    themeStore.sider.collapsedWidth = val ?? 0;
  }
});

const tabHeight = computed({
  get: () => themeStore.tab.height,
  set: (val: number | null) => {
    themeStore.tab.height = val ?? 0;
  }
});

const headerHeight = computed({
  get: () => themeStore.header.height,
  set: (val: number | null) => {
    themeStore.header.height = val ?? 0;
  }
});
</script>

<template>
  <NDrawer v-model:show="appStore.themeDrawerVisible" placement="right" :width="360">
    <NDrawerContent title="布局与主题" closable @close="appStore.closeThemeDrawer">
      <NTabs type="line" animated>
        <NTabPane name="layout" tab="布局">
          <NSpace vertical size="large">
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">布局模式</span>
              <NSelect v-model:value="layoutMode" class="w-220px" :options="layoutModeOptions" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">滚动模式</span>
              <NSelect v-model:value="scrollMode" class="w-220px" :options="scrollModeOptions" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">固定顶栏与标签</span>
              <NSwitch v-model:value="themeStore.fixedHeaderAndTab" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">显示标签栏</span>
              <NSwitch v-model:value="themeStore.tab.visible" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">标签栏高度</span>
              <NInputNumber v-model:value="tabHeight" class="w-220px" :min="32" :max="64" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">顶栏高度</span>
              <NInputNumber v-model:value="headerHeight" class="w-220px" :min="44" :max="72" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">侧栏反色</span>
              <NSwitch v-model:value="themeStore.sider.inverted" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">侧栏宽度</span>
              <NInputNumber v-model:value="siderWidth" class="w-220px" :min="160" :max="320" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">侧栏收起宽度</span>
              <NInputNumber v-model:value="siderCollapsedWidth" class="w-220px" :min="48" :max="100" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">显示底部栏</span>
              <NSwitch v-model:value="themeStore.footer.visible" />
            </div>
          </NSpace>
        </NTabPane>
        <NTabPane name="appearance" tab="外观">
          <NSpace vertical size="large">
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">主色</span>
              <NColorPicker v-model:value="themeColor" :modes="['hex']" class="w-220px" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">启用推荐色阶</span>
              <NSwitch v-model:value="themeStore.recommendColor" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">圆角</span>
              <NInputNumber v-model:value="themeRadius" class="w-220px" :min="0" :max="16" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">灰度模式</span>
              <NSwitch v-model:value="themeStore.grayscale" />
            </div>
            <div class="flex-y-center justify-between gap-12px">
              <span class="text-14px">色弱模式</span>
              <NSwitch v-model:value="themeStore.colourWeakness" />
            </div>
          </NSpace>
        </NTabPane>
      </NTabs>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
