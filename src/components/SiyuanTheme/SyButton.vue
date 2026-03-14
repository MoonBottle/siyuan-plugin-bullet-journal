<template>
  <!-- 图标按钮 -->
  <span
    v-if="type === 'icon'"
    ref="btnRef"
    class="sy-icon-btn"
    :aria-label="ariaLabel"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
    @mouseenter="handleIconMouseEnter"
    @mouseleave="handleIconMouseLeave"
  >
    <svg class="sy-icon-btn__svg">
      <use :xlink:href="`#${icon}`"></use>
    </svg>
  </span>

  <!-- 链接按钮 -->
  <a
    v-else-if="type === 'link'"
    ref="linkRef"
    class="sy-link-btn"
    :href="href"
    target="_blank"
    :aria-label="tooltip || text"
    :style="linkStyle"
    @click.prevent.stop="handleLinkClick"
    @mouseenter="handleLinkMouseEnter"
    @mouseleave="handleLinkMouseLeave"
  >
    {{ displayText }}
  </a>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { showIconTooltip, hideIconTooltip, showLinkTooltip, hideLinkTooltip, formatLinkForDisplay } from '@/utils/dialog';

const props = withDefaults(defineProps<{
  // 通用
  type?: 'icon' | 'link';
  ariaLabel?: string;
  // 图标按钮专用
  icon?: string;
  // 链接按钮专用
  text?: string;
  href?: string;
  maxWidth?: number;
  tooltip?: string;
}>(), {
  type: 'icon',
  maxWidth: 150,
});

const emit = defineEmits<{
  click: [event: MouseEvent | KeyboardEvent];
}>();

const btnRef = ref<HTMLElement | null>(null);
const linkRef = ref<HTMLElement | null>(null);

// 链接按钮样式
const linkStyle = computed(() => ({
  maxWidth: `${props.maxWidth}px`,
}));

// 链接按钮显示文本（截断后）
const displayText = computed(() => {
  if (!props.text) return '';
  const result = formatLinkForDisplay(props.text);
  return result.display;
});

// 链接按钮是否需要显示 tooltip（文本被截断时）
const needsTooltip = computed(() => {
  if (!props.text) return false;
  return props.text.length > 12;
});

// 图标按钮点击
function handleClick(event: MouseEvent | KeyboardEvent) {
  emit('click', event);
}

// 链接按钮点击
function handleLinkClick() {
  if (props.href) {
    window.open(props.href, '_blank');
  }
}

// 图标按钮 hover tooltip
function handleIconMouseEnter() {
  const el = btnRef.value;
  if (el && props.ariaLabel) {
    showIconTooltip(el, props.ariaLabel);
  }
}

function handleIconMouseLeave() {
  hideIconTooltip();
}

// 链接按钮 hover tooltip
function handleLinkMouseEnter() {
  const el = linkRef.value;
  if (el && needsTooltip.value) {
    showLinkTooltip(el, props.text!);
  }
}

function handleLinkMouseLeave() {
  hideLinkTooltip();
}
</script>

<style scoped>
/* 图标按钮样式 */
.sy-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--b3-theme-on-surface);
  transition: background-color 0.2s;
}

.sy-icon-btn:hover {
  background-color: var(--b3-theme-surface);
}

.sy-icon-btn:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

.sy-icon-btn__svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
  display: block;
}

/* 链接按钮样式 */
.sy-link-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--b3-theme-primary);
  background: var(--b3-theme-surface-lighter);
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.sy-link-btn:hover {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  z-index: 1;
}
</style>
