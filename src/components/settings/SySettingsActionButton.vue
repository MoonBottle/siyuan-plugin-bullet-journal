<template>
  <button
    type="button"
    class="sy-settings-action-btn b3-button b3-button--outline fn__flex-center"
    @click="$emit('click', $event)"
  >
    <svg v-if="icon" class="sy-settings-action-btn__icon">
      <use :xlink:href="`#${icon}`"></use>
    </svg>
    <span>{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  text: string;
}>()
defineEmits<{
  click: [event: MouseEvent];
}>()
</script>

<style scoped>
.sy-settings-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  margin-top: 12px;
}

.sy-settings-action-btn__icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
</style>
