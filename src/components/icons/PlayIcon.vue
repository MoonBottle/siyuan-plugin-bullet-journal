<template>
  <svg
    class="play-icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
  >
    <path
      d="M512 96C282.624 96 96 282.624 96 512s186.624 416 416 416 416-186.624 416-416S741.376 96 512 96z m0 768C317.92 864 160 706.08 160 512S317.92 160 512 160s352 157.92 352 352-157.92 352-352 352z"
      fill="currentColor"
    />
    <path
      d="M466.816 324.96a32 32 0 0 0-50.816 25.888v339.776a32 32 0 0 0 50.816 25.856l233.6-169.888a32 32 0 0 0 0-51.776l-233.6-169.856z"
      fill="currentColor"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: number | string;
    height?: number | string;
  }>(),
  {
    width: 16,
    height: 16,
  }
);
</script>

<style scoped>
.play-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
