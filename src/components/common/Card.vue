<template>
  <div
    class="card"
    :class="cardClasses"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Header Slot -->
    <div v-if="showHeader" class="card-header">
      <slot name="header"></slot>
    </div>

    <!-- Content Slot -->
    <div class="card-content">
      <slot></slot>
    </div>

    <!-- Footer Slot -->
    <div v-if="showFooter" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type CardStatus = 'expired' | 'today' | 'tomorrow' | 'future' | 'completed' | 'abandoned' | 'pending';

interface Props {
  status?: CardStatus;
  showHeader?: boolean;
  showFooter?: boolean;
  clickable?: boolean;
  hoverEffect?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  status: undefined,
  showHeader: false,
  showFooter: false,
  clickable: true,
  hoverEffect: true
});

const emit = defineEmits<{
  click: [event: MouseEvent];
  contextmenu: [event: MouseEvent];
}>();

const cardClasses = computed(() => {
  const classes: string[] = [];
  if (props.status) {
    classes.push(`status-${props.status}`);
  }
  if (props.clickable) {
    classes.push('is-clickable');
  }
  if (props.hoverEffect) {
    classes.push('has-hover-effect');
  }
  return classes;
});

const handleClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event);
  }
};

const handleContextMenu = (event: MouseEvent) => {
  emit('contextmenu', event);
};
</script>

<style lang="scss" scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);
  transition: all 0.2s;

  &.is-clickable {
    cursor: pointer;
  }

  &.has-hover-effect {
    &:hover {
      background: var(--b3-theme-surface);
      border-color: var(--b3-theme-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  // 状态样式
  &.status-completed {
    opacity: 0.6;
    border-left: 3px solid var(--b3-theme-success);

    :deep(.card-content) {
      text-decoration: line-through;
    }
  }

  &.status-abandoned {
    opacity: 0.5;
    border-left: 3px solid var(--b3-theme-on-surface);

    :deep(.card-content) {
      text-decoration: line-through;
      color: var(--b3-theme-on-surface);
    }
  }

  &.status-expired {
    border-left: 3px solid #f44336;

    :deep(.card-time) {
      color: #f44336;
    }
  }

  &.status-today,
  &.status-tomorrow,
  &.status-future,
  &.status-pending {
    border-left: 3px solid var(--b3-theme-primary);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: -8px -12px 0 -12px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--b3-theme-surface-lighter);
  border-bottom: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius) var(--b3-border-radius) 0 0;
}

.card-content {
  width: 100%;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  margin-top: 4px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
