<template>
  <div class="dropdown-select" v-click-outside="closeDropdown">
    <button
      ref="triggerRef"
      class="dropdown-select__trigger"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <slot name="prefix"></slot>
      <span class="dropdown-select__label">{{ displayLabel }}</span>
      <svg
        v-if="!disabled"
        class="dropdown-select__arrow"
        :class="{ 'is-open': isOpen }"
      >
        <use xlink:href="#iconDown"></use>
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="dropdown-select__menu"
        :style="menuStyle"
      >
        <div
          v-for="option in options"
          :key="getOptionKey(option)"
          class="dropdown-select__option"
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

interface Props {
  modelValue: string;
  options: any[];
  labelKey?: string;
  valueKey?: string;
  placeholder?: string;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  labelKey: 'label',
  valueKey: 'value',
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

// 获取选项的显示文本
function getOptionLabel(option: any): string {
  if (typeof option === 'string') return option;
  return option[props.labelKey] || '';
}

// 获取选项的值
function getOptionValue(option: any): string {
  if (typeof option === 'string') return option;
  return option[props.valueKey] || '';
}

// 获取选项的key
function getOptionKey(option: any): string {
  return getOptionValue(option);
}

// 判断选项是否选中
function isOptionActive(option: any): boolean {
  return getOptionValue(option) === props.modelValue;
}

// 显示的标签
const displayLabel = computed(() => {
  const selected = props.options.find(opt => isOptionActive(opt));
  return selected ? getOptionLabel(selected) : props.placeholder;
});

// 切换下拉
async function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updateMenuPosition();
  }
}

// 关闭下拉
function closeDropdown() {
  isOpen.value = false;
}

// 选择选项
function selectOption(option: any) {
  const value = getOptionValue(option);
  emit('update:modelValue', value);
  emit('change', value);
  isOpen.value = false;
}

// 获取元素相对于视口的位置（考虑所有 offsetParent）
function getElementViewportRect(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  return rect;
}

// 计算菜单位置，确保在视口内
function calculateMenuPosition(
  triggerRect: DOMRect,
  menuHeight: number,
  menuWidth: number
): { top: number; left: number; placement: 'top' | 'bottom' } {
  const gap = 4;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top: number;
  let placement: 'top' | 'bottom' = props.placement;

  // 根据 placement 计算初始位置
  if (placement === 'top') {
    top = triggerRect.top - menuHeight - gap;
    // 如果上方空间不足，切换到下方
    if (top < 0) {
      top = triggerRect.bottom + gap;
      placement = 'bottom';
    }
  } else {
    top = triggerRect.bottom + gap;
    // 如果下方空间不足，切换到上方
    if (top + menuHeight > viewportHeight) {
      top = triggerRect.top - menuHeight - gap;
      placement = 'top';
    }
  }

  // 确保不超出视口顶部
  if (top < 0) {
    top = gap;
  }

  // 确保不超出视口底部
  if (top + menuHeight > viewportHeight) {
    top = Math.max(gap, viewportHeight - menuHeight - gap);
  }

  // 计算 left 位置，确保不超出视口
  let left = triggerRect.left;
  if (left + menuWidth > viewportWidth) {
    left = Math.max(gap, viewportWidth - menuWidth - gap);
  }
  if (left < 0) {
    left = gap;
  }

  return { top, left, placement };
}

// 更新菜单位置
function updateMenuPosition() {
  const trigger = triggerRef.value;
  const menu = menuRef.value;
  if (!trigger) return;

  const triggerRect = getElementViewportRect(trigger);

  // 获取菜单实际高度（如果菜单已渲染）
  let menuHeight = 200; // 默认最大高度
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

// 窗口大小改变时更新位置
let resizeObserver: ResizeObserver | null = null;
let scrollListeners: { element: Element; listener: EventListener }[] = [];

// 获取所有需要监听滚动的祖先元素
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

  // 始终包含 window/document 滚动
  ancestors.push(document);

  return ancestors;
}

// 添加滚动监听
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

// 移除滚动监听
function removeScrollListeners() {
  scrollListeners.forEach(({ element, listener }) => {
    element.removeEventListener('scroll', listener, true);
  });
  scrollListeners = [];
}

watch(isOpen, (open) => {
  if (open) {
    // 使用 ResizeObserver 监听窗口大小变化
    if (typeof ResizeObserver !== 'undefined' && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateMenuPosition();
      });
      resizeObserver.observe(document.body);
    } else {
      // 降级方案：使用 resize 事件
      window.addEventListener('resize', updateMenuPosition);
    }

    // 添加滚动监听
    addScrollListeners();
  } else {
    // 清理 ResizeObserver
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    // 移除 resize 事件（降级方案）
    window.removeEventListener('resize', updateMenuPosition);

    // 移除滚动监听
    removeScrollListeners();
  }
});

// 点击外部指令
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
.dropdown-select {
  display: inline-block;

  &__trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 4px 10px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    outline: none;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: var(--b3-theme-primary-light);
    }

    &.is-open {
      border-color: var(--b3-theme-primary);
    }

    &:disabled,
    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__label {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    width: 12px;
    height: 12px;
    fill: var(--b3-theme-on-surface);
    transition: transform 0.2s;
    flex-shrink: 0;

    &.is-open {
      transform: rotate(180deg);
    }
  }

  &__menu {
    overflow-y: auto;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &__option {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.2s;
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
      border-radius: 8px 8px 0 0;
    }

    &:last-child {
      border-radius: 0 0 8px 8px;
      margin-bottom: 8px;
    }
  }
}
</style>
