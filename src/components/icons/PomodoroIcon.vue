<template>
  <svg
    class="tomato-icon"
    viewBox="0 0 1024 1024"
    :width="width"
    :height="height"
  >
    <use xlink:href="#iconTaTomato" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: number | string
    height?: number | string
  }>(),
  {
    width: 20,
    height: 20,
  },
)
</script>

<style scoped>
.tomato-icon {
  display: inline-block;
  vertical-align: middle;
  color: var(--b3-theme-primary);
}
</style>
