<template>
  <MobileMainShell v-if="isMobile" />
  <DesktopTodoDock v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileMainShell from '@/mobile/MobileMainShell.vue'
import { isMobileDevice } from '@/utils/isMobile'
import DesktopTodoDock from './DesktopTodoDock.vue'

const isMobile = computed(() => isMobileDevice())
</script>
