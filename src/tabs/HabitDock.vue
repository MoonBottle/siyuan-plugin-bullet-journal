<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopHabitDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlugin } from '@/main';
import MobileMainShell from '@/mobile/MobileMainShell.vue';
import DesktopHabitDock from './DesktopHabitDock.vue';

const props = defineProps<{
  plugin?: any;
}>();

const pluginInstance = computed(() => props.plugin || usePlugin());
const isMobile = computed(() => pluginInstance.value?.isMobile);
</script>
