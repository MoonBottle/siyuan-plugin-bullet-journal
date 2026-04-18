<template>
  <div class="habit-dock">
    <div class="habit-dock__placeholder">
      <span>🎯 {{ t('habit')?.title || '习惯打卡' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  plugin: any;
}>();
</script>

<style scoped>
.habit-dock {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.habit-dock__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--b3-theme-on-surface-light);
}
</style>
