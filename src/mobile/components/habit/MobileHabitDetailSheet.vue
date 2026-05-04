<template>
  <Teleport to="body">
    <Transition name="mobile-habit-sheet-fade">
      <div
        v-if="open"
        class="mobile-habit-detail-sheet"
        data-testid="habit-detail-sheet"
      >
        <div
          class="mobile-habit-detail-sheet__scrim"
          data-testid="habit-detail-sheet-scrim"
          @click="emit('close')"
        ></div>

        <div class="mobile-habit-detail-sheet__panel" @click.stop>
          <div class="mobile-habit-detail-sheet__handle" aria-hidden="true"></div>

          <div class="mobile-habit-detail-sheet__header">
            <div
              class="mobile-habit-detail-sheet__title"
              data-testid="habit-detail-sheet-title"
            >
              {{ habit?.name || '' }}
            </div>

            <button
              v-if="habit"
              class="mobile-habit-detail-sheet__icon"
              :data-testid="habit.archivedAt ? 'mobile-habit-unarchive' : 'mobile-habit-archive'"
              :aria-label="habit.archivedAt ? t('habit').unarchive : t('habit').archive"
              @click="handleArchiveAction"
            >
              <svg
                @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, habit.archivedAt ? t('habit').unarchive : t('habit').archive)"
                @mouseleave="hideIconTooltip"
              ><use :xlink:href="habit.archivedAt ? '#iconRestore' : '#iconInbox'"></use></svg>
            </button>

            <button
              class="mobile-habit-detail-sheet__close"
              data-testid="habit-detail-sheet-close"
              :aria-label="t('common').close || 'Close'"
              @click="handleClose"
            >
              <svg
                @mouseenter="showIconTooltip($event.currentTarget as HTMLElement, t('common').close || 'Close')"
                @mouseleave="hideIconTooltip"
              ><use xlink:href="#iconCloseRound"></use></svg>
            </button>
          </div>

          <div class="mobile-habit-detail-sheet__body">
            <slot></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import type { Habit, HabitStats } from '@/types/models';
import { hideIconTooltip, showIconTooltip } from '@/utils/dialog';

const props = defineProps<{
  open: boolean;
  habit: Habit | null;
  selectedDate: string;
  viewMonth: string;
  stats: HabitStats | null | undefined;
}>();

const emit = defineEmits<{
  archive: [];
  close: [];
  unarchive: [];
}>();

function handleArchiveAction() {
  hideIconTooltip();
  if (props.habit?.archivedAt) {
    emit('unarchive');
    return;
  }

  emit('archive');
}

function handleClose() {
  hideIconTooltip();
  emit('close');
}
</script>

<style lang="scss" scoped>
.mobile-habit-detail-sheet {
  position: fixed;
  inset: 0;
  z-index: 1002;
}

.mobile-habit-detail-sheet__scrim {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.44);
}

.mobile-habit-detail-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  max-height: min(86vh, 760px);
  flex-direction: column;
  border-radius: 16px 16px 0 0;
  background: var(--b3-theme-surface);
  box-shadow: 0 -16px 40px rgba(15, 23, 42, 0.18);
}

.mobile-habit-detail-sheet__handle {
  width: 44px;
  height: 5px;
  margin: 10px auto 6px;
  border-radius: 999px;
  background: var(--b3-theme-surface-lighter);
}

.mobile-habit-detail-sheet__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.mobile-habit-detail-sheet__title {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-habit-detail-sheet__close,
.mobile-habit-detail-sheet__icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
}

.mobile-habit-detail-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 20px;
  -webkit-overflow-scrolling: touch;
}

.mobile-habit-sheet-fade-enter-active,
.mobile-habit-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-habit-sheet-fade-enter-from,
.mobile-habit-sheet-fade-leave-to {
  opacity: 0;
}
</style>
