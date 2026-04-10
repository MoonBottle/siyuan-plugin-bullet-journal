<template>
  <MobileTodoDock v-if="isMobile" />
  <DesktopTodoDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlugin } from '@/main';
import DesktopTodoDock from './DesktopTodoDock.vue';
import MobileTodoDock from './mobile/MobileTodoDock.vue';

const plugin = usePlugin() as any;
const isMobile = computed(() => plugin.isMobile);
</script>
