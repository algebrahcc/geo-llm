<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';

defineOptions({ name: 'ThemeConfigButton' });

const appStore = useAppStore();
</script>

<template>
  <ButtonIcon
    icon="material-symbols:settings-outline"
    tooltip-content="布局设置"
    tooltip-placement="bottom"
    @click="appStore.openThemeDrawer"
  />
</template>

<style scoped></style>
