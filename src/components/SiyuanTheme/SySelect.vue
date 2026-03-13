<template>
  <div class="sy-select" v-click-outside="closeDropdown">
    <button
      ref="triggerRef"
      class="sy-select__trigger"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <slot name="prefix"></slot>
      <span class="sy-select__label">{{ displayLabel }}</span>
      <svg
        v-if="!disabled"
        class="sy-select__arrow"
        :class="{ 'is-open': isOpen }"
      >
        <use xlink:href="#iconDown"></use>
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="sy-select__menu"
        :style="menuStyle"
      >
        <div
          v-for="option in options"
          :key="getOptionValue(option)"
          class="sy-select__option"
          :class="{ 'is-active': isOptionActive(option) }"
          @click="selectOption(option)"
        >
          {{ getOptionLabel(option) }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';

export interface SySelectOption {
  value: string;
  label: string;
}

interface Props {
  modelValue: string;
  options: SySelectOption[];
  placeholder?: string;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  disabled: false,
  placement: 'bottom'
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  change: [value: string];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});

function getOptionLabel(option: SySelectOption): string {
  return option.label || '';
}

function getOptionValue(option: SySelectOption): string {
  return option.value || '';
}

function isOptionActive(option: SySelectOption): boolean {
  return getOptionValue(option) === props.modelValue;
}

const displayLabel = computed(() => {
  const selected = props.options.find(opt => isOptionActive(opt));
  return selected ? getOptionLabel(selected) : props.placeholder;
});

async function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updateMenuPosition();
  }
}

function closeDropdown() {
  isOpen.value = false;
}

function selectOption(option: SySelectOption) {
  const value = getOptionValue(option);
  emit('update:modelValue', value);
  emit('change', value);
  isOpen.value = false;
}

function getElementViewportRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

function calculateMenuPosition(
  triggerRect: DOMRect,
  menuHeight: number,
  menuWidth: number
): { top: number; left: number } {
  const gap = 4;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top: number;
  let placement = props.placement;

  if (placement === 'top') {
    top = triggerRect.top - menuHeight - gap;
    if (top < 0) {
      top = triggerRect.bottom + gap;
    }
  } else {
    top = triggerRect.bottom + gap;
    if (top + menuHeight > viewportHeight) {
      top = triggerRect.top - menuHeight - gap;
    }
  }

  if (top < 0) top = gap;
  if (top + menuHeight > viewportHeight) {
    top = Math.max(gap, viewportHeight - menuHeight - gap);
  }

  let left = triggerRect.left;
  if (left + menuWidth > viewportWidth) {
    left = Math.max(gap, viewportWidth - menuWidth - gap);
  }
  if (left < 0) left = gap;

  return { top, left };
}

function updateMenuPosition() {
  const trigger = triggerRef.value;
  const menu = menuRef.value;
  if (!trigger) return;

  const triggerRect = getElementViewportRect(trigger);
  let menuHeight = 200;
  if (menu) {
    const menuRect = menu.getBoundingClientRect();
    menuHeight = Math.min(menuRect.height || 200, 200);
  }

  const menuWidth = Math.max(triggerRect.width, 160);
  const { top, left } = calculateMenuPosition(triggerRect, menuHeight, menuWidth);

  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${menuWidth}px`,
    maxHeight: '200px',
    zIndex: '9999'
  };
}

let resizeObserver: ResizeObserver | null = null;
let scrollListeners: { element: Element; listener: EventListener }[] = [];

function getScrollableAncestors(element: HTMLElement): Element[] {
  const ancestors: Element[] = [];
  let current = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflow = style.overflow + style.overflowX + style.overflowY;
    if (overflow.includes('auto') || overflow.includes('scroll')) {
      ancestors.push(current);
    }
    current = current.parentElement;
  }
  ancestors.push(document);
  return ancestors;
}

function addScrollListeners() {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const scrollableAncestors = getScrollableAncestors(trigger);
  scrollableAncestors.forEach(ancestor => {
    const listener = () => updateMenuPosition();
    ancestor.addEventListener('scroll', listener, true);
    scrollListeners.push({ element: ancestor, listener });
  });
}

function removeScrollListeners() {
  scrollListeners.forEach(({ element, listener }) => {
    element.removeEventListener('scroll', listener, true);
  });
  scrollListeners = [];
}

watch(isOpen, (open) => {
  if (open) {
    if (typeof ResizeObserver !== 'undefined' && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => updateMenuPosition());
      resizeObserver.observe(document.body);
    } else {
      window.addEventListener('resize', updateMenuPosition);
    }
    addScrollListeners();
  } else {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener('resize', updateMenuPosition);
    removeScrollListeners();
  }
});

const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    (el as any)._clickOutside = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value();
      }
    };
    document.addEventListener('click', (el as any)._clickOutside, true);
  },
  unmounted(el: HTMLElement) {
    if ((el as any)._clickOutside) {
      document.removeEventListener('click', (el as any)._clickOutside, true);
    }
  }
};
</script>

<style lang="scss" scoped>
.sy-select {
  display: inline-block;

  &__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
    font-size: 13px;
    padding: 0 8px;
    height: 28px;
    min-width: 60px;
    border-radius: 6px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    outline: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover:not(:disabled) {
      background: var(--b3-theme-surface);
      border-color: var(--b3-theme-surface-lighter);
    }

    &.is-open {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
    }

    &:disabled,
    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__label {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--b3-theme-on-background);
  }

  &__arrow {
    width: 10px;
    height: 10px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.6;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;

    &.is-open {
      transform: rotate(180deg);
      opacity: 1;
      fill: var(--b3-theme-primary);
    }
  }

  &__menu {
    overflow-y: auto;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 4px;
    min-width: 100px;
  }

  &__option {
    padding: 6px 12px;
    margin: 2px 0;
    font-size: 13px;
    border-radius: 6px;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
    }

    &.is-active {
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
      font-weight: 500;
    }

    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
