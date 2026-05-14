<template>
  <div v-if="item" class="item-action-bar">
    <span
      v-if="canComplete"
      class="block__icon"
      :aria-label="t('todo').complete"
      @mouseenter="handleTooltipEnter($event, t('todo').complete)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleComplete"
    >
      <svg><use xlink:href="#iconCheck"></use></svg>
    </span>

    <span
      v-if="!pomodoroStore.isFocusing && canStartFocus"
      class="block__icon"
      :aria-label="t('todo').startFocusAria"
      @mouseenter="handleTooltipEnter($event, t('todo').startFocusAria)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleStartFocus"
    >
      <svg><use xlink:href="#iconClock"></use></svg>
    </span>

    <span
      v-if="canSetFocusPlan"
      class="block__icon"
      :aria-label="focusPlanLabel"
      @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleFocusPlan"
    >
      <svg><use xlink:href="#iconAttr"></use></svg>
    </span>

    <span
      v-if="canMigrate"
      class="block__icon"
      :aria-label="migrateLabel"
      @mouseenter="handleTooltipEnter($event, migrateLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleMigrate"
    >
      <svg><use xlink:href="#iconForward"></use></svg>
    </span>

    <span
      v-if="canAbandon"
      class="block__icon"
      :aria-label="t('todo').abandon"
      @mouseenter="handleTooltipEnter($event, t('todo').abandon)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleAbandon"
    >
      <svg><use xlink:href="#iconCloseRound"></use></svg>
    </span>

    <span
      class="block__icon"
      :aria-label="t('todo').openDoc"
      @mouseenter="handleTooltipEnter($event, t('todo').openDoc)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenDoc"
    >
      <svg><use xlink:href="#iconFile"></use></svg>
    </span>

    <span
      class="block__icon"
      :aria-label="t('todo').calendar"
      @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenCalendar"
    >
      <svg><use xlink:href="#iconCalendar"></use></svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePomodoroStore } from '@/stores';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import { hideIconTooltip, showFocusPlanDialog, showIconTooltip, showPomodoroTimerDialog } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';
import { openDocumentAtLine, updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import type { Item } from '@/types/models';

const props = defineProps<{
  item: Item | null;
}>();

const pomodoroStore = usePomodoroStore();
const plugin = usePlugin() as any;
const isProcessing = ref(false);

const canStartFocus = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned');
const canComplete = computed(() => !!props.item?.blockId && props.item.status !== 'completed');
const canAbandon = computed(() => !!props.item?.blockId && props.item.status !== 'abandoned');
const canSetFocusPlan = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned');
const canMigrate = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned');
const focusPlanLabel = computed(() => {
  return props.item?.focusPlan
    ? t('focusPlan').editAction
    : t('focusPlan').setAction;
});
const migrateLabel = computed(() => {
  if (!props.item) return '';
  return props.item.date < dayjs().format('YYYY-MM-DD')
    ? t('todo').migrateToToday
    : t('todo').migrateToTomorrow;
});

function getStatusTag(status: 'completed' | 'abandoned'): string {
  return t('statusTag')[status] || '';
}

function handleTooltipEnter(event: MouseEvent, text: string) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el || !text) return;
  showIconTooltip(el, text);
}

function handleTooltipLeave() {
  hideIconTooltip();
}

async function handleComplete() {
  if (!props.item?.blockId || isProcessing.value) return;
  isProcessing.value = true;
  try {
    await updateBlockContent(props.item.blockId, getStatusTag('completed'));
  } finally {
    isProcessing.value = false;
  }
}

async function handleAbandon() {
  if (!props.item?.blockId || isProcessing.value) return;
  isProcessing.value = true;
  try {
    await updateBlockContent(props.item.blockId, getStatusTag('abandoned'));
  } finally {
    isProcessing.value = false;
  }
}

function handleStartFocus() {
  if (!props.item?.blockId || isProcessing.value) return;
  showPomodoroTimerDialog(props.item.blockId);
}

function handleFocusPlan() {
  if (!props.item || isProcessing.value) return;
  showFocusPlanDialog(props.item);
}

async function handleMigrate() {
  if (!props.item?.blockId || isProcessing.value) return;
  isProcessing.value = true;
  try {
    const targetDate = props.item.date < dayjs().format('YYYY-MM-DD')
      ? dayjs().format('YYYY-MM-DD')
      : dayjs().add(1, 'day').format('YYYY-MM-DD');
    const completeSiblingItems = [
      ...(props.item.siblingItems || []),
      ...(props.item.date ? [{
        date: props.item.date,
        startDateTime: props.item.startDateTime,
        endDateTime: props.item.endDateTime,
      }] : []),
    ];
    await updateBlockDateTime(
      props.item.blockId,
      targetDate,
      props.item.startDateTime ? props.item.startDateTime.split(' ')[1] : undefined,
      props.item.endDateTime ? props.item.endDateTime.split(' ')[1] : undefined,
      !props.item.startDateTime,
      props.item.date,
      completeSiblingItems,
      props.item.status,
    );
  } finally {
    isProcessing.value = false;
  }
}

async function handleOpenDoc() {
  if (!props.item?.docId || isProcessing.value) return;
  await openDocumentAtLine(props.item.docId, props.item.lineNumber, props.item.blockId);
}

function handleOpenCalendar() {
  if (!props.item || isProcessing.value) return;
  if (plugin?.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: props.item.date });
  }
}
</script>

<style lang="scss" scoped>
.item-action-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--b3-border-color);
}

.block__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.2s, color 0.2s;

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }

  &:hover {
    color: var(--b3-theme-primary);
    opacity: 1;
  }
}
</style>
