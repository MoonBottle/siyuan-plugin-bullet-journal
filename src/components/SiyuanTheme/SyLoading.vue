<template>
  <div class="sy-loading" :class="{ inline }">
    <div class="loading-spinner">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
    <span v-if="text" class="loading-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text?: string;
  inline?: boolean;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
.sy-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--b3-theme-on-surface);

  &.inline {
    display: inline-flex;
    flex-direction: row;
    padding: 0;
    gap: 8px;
  }
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.7;
}
</style>
