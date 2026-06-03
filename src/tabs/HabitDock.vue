<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopHabitDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileMainShell from '@/mobile/MobileMainShell.vue'
import { isMobileDevice } from '@/utils/isMobile'
import DesktopHabitDock from './DesktopHabitDock.vue'

const isMobile = computed(() => isMobileDevice())
</script>
