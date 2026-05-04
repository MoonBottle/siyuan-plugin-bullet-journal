<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopTodoDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlugin } from '@/main';
import MobileMainShell from '@/mobile/MobileMainShell.vue';
import DesktopTodoDock from './DesktopTodoDock.vue';

const props = defineProps<{
  plugin?: any;
}>();

// Use injected plugin or fallback to usePlugin()
const pluginInstance = computed(() => props.plugin || usePlugin());
const isMobile = computed(() => pluginInstance.value?.isMobile);
</script>
