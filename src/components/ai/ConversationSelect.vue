<template>
  <div class="conversation-select" v-click-outside="closeDropdown">
    <span
      ref="triggerRef"
      class="block__icon b3-tooltips b3-tooltips__sw"
      :aria-label="t('aiChat').conversations"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
    >
      <svg>
        <use xlink:href="#iconHistory"></use>
      </svg>
    </span>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="conversation-select__menu"
        :style="menuStyle"
      >
        <div class="conversation-select__header">
          <span class="conversation-select__title">{{ t('aiChat').conversations }}</span>
        </div>
        <div class="conversation-select__list">
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-select__item"
            :class="{ 
              'is-active': conversation.id === currentConversationId,
              'is-weixin': conversation.source === 'weixin'
            }"
            @click="selectConversation(conversation.id)"
          >
            <span class="conversation-select__source-icon" v-if="conversation.source === 'weixin'">
              📱
            </span>
            <span class="conversation-select__item-title">{{ conversation.title }}</span>
            <button
              class="conversation-select__delete-btn"
              @click.stop="deleteConversation(conversation.id)"
            >
              <svg>
                <use xlink:href="#iconTrashcan"></use>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { t } from '@/i18n';

interface ConversationListItem {
  id: string;
  title: string;
  source?: 'local' | 'weixin';
  weixinUserName?: string;
}

interface Props {
  conversations: ConversationListItem[];
  currentConversationId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [conversationId: string];
  delete: [conversationId: string];
  create: [];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});

// 当前对话标题
const currentConversationTitle = computed(() => {
  const current = props.conversations.find(c => c.id === props.currentConversationId);
  return current?.title || t('aiChat').newConversation;
});

// 切换下拉
async function toggleDropdown() {
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

// 选择对话
function selectConversation(conversationId: string) {
  emit('select', conversationId);
  isOpen.value = false;
}

// 删除对话
function deleteConversation(conversationId: string) {
  emit('delete', conversationId);
}

// 创建新对话
function createNewConversation() {
  emit('create');
  isOpen.value = false;
}

// 更新菜单位置
function updateMenuPosition() {
  const trigger = triggerRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const menuHeight = 300;
  const menuWidth = 280;

  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - 4;
  }

  // 菜单右对齐到触发器
  let left = rect.right - menuWidth;
  // 确保不超出左边界
  if (left < 4) {
    left = 4;
  }

  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${menuWidth}px`,
    maxHeight: `${menuHeight}px`,
    zIndex: '9999'
  };
}

// 窗口大小改变时更新位置
watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
  } else {
    window.removeEventListener('scroll', updateMenuPosition, true);
    window.removeEventListener('resize', updateMenuPosition);
  }
});

// 点击外部指令
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    (el as any)._clickOutside = (event: Event) => {
      const menuEl = menuRef.value;
      const target = event.target as Node;
      // 检查点击目标是否在触发器内或下拉菜单内
      if (el.contains(target) || (menuEl && menuEl.contains(target))) {
        return;
      }
      binding.value();
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
.conversation-select {
  display: inline-block;

  // 使用思源标准的 block__icon 样式
  .block__icon {
    opacity: 1;

    &.is-open {
      color: var(--b3-theme-primary);
    }
  }

  &__menu {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &__header {
    padding: 8px 12px;
  }

  &__title {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  &__list {
    overflow-y: auto;
    max-height: 240px;
    padding-bottom: 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 4px;
    margin: 0 4px;

    &:hover {
      background: var(--b3-theme-surface-light);

      .conversation-select__delete-btn {
        opacity: 1;
      }
    }

    &.is-active {
      color: var(--b3-theme-primary);
    }
  }

  &__item-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }

  &__source-icon {
    margin-right: 4px;
    font-size: 12px;
  }

  &__item.is-weixin {
    .conversation-select__item-title {
      color: #07c160;
    }
  }

  &__delete-btn {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.2s;

    svg {
      width: 22px;
      height: 22px;
      color: var(--b3-theme-error);
    }
  }
}
</style>
