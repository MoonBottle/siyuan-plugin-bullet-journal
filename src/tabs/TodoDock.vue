<template>
  <MobileTodoDock v-if="isMobile" />
  <DesktopTodoDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlugin } from '@/main';
import DesktopTodoDock from './DesktopTodoDock.vue';
import MobileTodoDock from '@/mobile/MobileTodoDock.vue';

const props = defineProps<{
  plugin?: any;
}>();

// Use injected plugin or fallback to usePlugin()
const pluginInstance = computed(() => props.plugin || usePlugin());
const isMobile = computed(() => pluginInstance.value?.isMobile);
</script>
