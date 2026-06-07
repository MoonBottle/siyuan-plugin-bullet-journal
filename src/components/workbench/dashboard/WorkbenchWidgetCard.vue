<template>
  <article
    class="workbench-widget-card"
    data-testid="workbench-widget-card"
  >
    <span
      class="workbench-widget-card__drag"
      aria-hidden="true"
    ><svg><use xlink:href="#iconTaGripHorizontal"></use></svg></span>
    <header class="workbench-widget-card__header">
      <div class="workbench-widget-card__title-wrap">
        <span class="workbench-widget-card__title">{{ title }}</span>
        <span
          v-if="subtitle"
          class="workbench-widget-card__subtitle"
        >{{ subtitle }}</span>
      </div>
      <div class="workbench-widget-card__controls">
        <button
          class="workbench-widget-card__menu-trigger block__icon b3-tooltips b3-tooltips__sw"
          data-testid="workbench-widget-menu-trigger"
          type="button"
          :aria-label="t('common').more"
          @click.stop="handleMenuClick"
        >
          <svg><use xlink:href="#iconMore"></use></svg>
        </button>
      </div>
    </header>
    <div class="workbench-widget-card__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { Menu } from 'siyuan'
import { t } from '@/i18n'

const props = defineProps<{
  title: string
  subtitle?: string
  showConfigure?: boolean
}>()

const emit = defineEmits<{
  (event: 'configure'): void
  (event: 'rename'): void
  (event: 'delete'): void
}>()

function handleMenuClick(event: MouseEvent) {
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const menu = new Menu('workbench-widget-card-menu')
  if (props.showConfigure) {
    menu.addItem({
      icon: 'iconSettings',
      label: t('workbench').configure,
      click: () => emit('configure'),
    })
  }
  menu.addItem({
    icon: 'iconEdit',
    label: t('workbench').rename,
    click: () => emit('rename'),
  })
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('workbench').delete,
    click: () => emit('delete'),
  })
  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  })
}
</script>

<style lang="scss" scoped>
.workbench-widget-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  overflow: hidden;
}

.workbench-widget-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workbench-widget-card__title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.workbench-widget-card__title {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.workbench-widget-card__subtitle {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}

.workbench-widget-card__controls {
  display: flex;
  align-items: center;
}

.workbench-widget-card__drag {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  width: 16px;
  height: 16px;
  padding: 2px;
  color: var(--b3-theme-on-surface);
  opacity: 0;
  pointer-events: none;
  cursor: move;
  user-select: none;
  transition: opacity 0.18s ease;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.workbench-widget-card:hover .workbench-widget-card__drag,
.workbench-widget-card:focus-within .workbench-widget-card__drag {
  opacity: 1;
  pointer-events: auto;
}

.workbench-widget-card__menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  line-height: 1;
  opacity: 1;

  svg {
    display: block;
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
}

.workbench-widget-card__body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--b3-theme-on-background);
}
</style>
