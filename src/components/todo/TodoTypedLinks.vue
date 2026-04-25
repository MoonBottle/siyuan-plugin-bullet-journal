<template>
  <div v-if="links.length > 0" class="typed-link-list" :class="{ 'is-right-aligned': align === 'right' }">
    <SyButton
      v-for="link in links"
      :key="`${link.name}-${link.url}-${link.type || 'default'}`"
      type="link"
      :text="link.name"
      :href="link.url"
      :class="['typed-link', `typed-link--${link.type || 'default'}`]"
      @click="emit('linkClick', link.url)"
    />
  </div>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import type { Link } from '@/types/models';

withDefaults(defineProps<{
  links: Link[];
  align?: 'left' | 'right';
}>(), {
  align: 'left',
});

const emit = defineEmits<{
  linkClick: [url: string];
}>();
</script>

<style lang="scss" scoped>
.typed-link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  &.is-right-aligned {
    justify-content: flex-end;
  }
}

:deep(.typed-link) {
  position: relative;
  padding-left: 22px;
  border: 1px solid color-mix(in srgb, var(--b3-theme-primary) 55%, var(--b3-border-color) 45%);
  background: color-mix(in srgb, var(--b3-theme-primary) 6%, var(--b3-theme-surface) 94%);
  color: var(--b3-theme-on-surface);
  font-weight: 500;
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--b3-theme-primary) 70%, transparent 30%);
}

:deep(.typed-link--external::before),
:deep(.typed-link--siyuan::before),
:deep(.typed-link--block-ref::before) {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  line-height: 1;
  opacity: 0.8;
  color: var(--b3-theme-primary);
}

:deep(.typed-link--external::before) {
  content: '↗';
}

:deep(.typed-link--siyuan::before) {
  content: 'S';
}

:deep(.typed-link--block-ref::before) {
  content: '❝';
}
</style>
