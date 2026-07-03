<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 5.94 2 10.8c0 2.77 1.48 5.24 3.82 6.85L5 22l4.2-2.3c.88.2 1.8.3 2.8.3 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"
      :fill="isConnected ? '#07c160' : 'currentColor'"
    />
    <text
      x="12"
      y="14"
      text-anchor="middle"
      font-size="8"
      fill="#fff"
      font-weight="bold"
    >企</text>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number
  isConnected?: boolean
}>(), {
  size: 16,
  isConnected: false,
})
</script>
