<template>
  <MobileHabitDock v-if="isMobile" />
  <DesktopHabitDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlugin } from '@/main';
import DesktopHabitDock from './DesktopHabitDock.vue';
import MobileHabitDock from '@/mobile/MobileHabitDock.vue';

const props = defineProps<{
  plugin?: any;
}>();

const pluginInstance = computed(() => props.plugin || usePlugin());
const isMobile = computed(() => pluginInstance.value?.isMobile);
</script>
