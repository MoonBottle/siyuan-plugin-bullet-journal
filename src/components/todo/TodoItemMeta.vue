<template>
  <div v-if="shouldRender" class="item-meta-panel">
    <TodoTypedLinks v-if="showLinks && visibleLinks.length > 0" :links="visibleLinks" @link-click="handleLinkClick" />

    <TodoItemActionButtons
      v-if="showReminderAndRecurring && (!isCompletedOrAbandoned || hasReminder || hasRecurring)"
      :has-reminder="hasReminder"
      :has-recurring="hasRecurring"
      :is-readonly="isCompletedOrAbandoned"
      :show-reminder="!isCompletedOrAbandoned || hasReminder"
      :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
      :reminder-text="reminderText"
      :recurring-text="recurringText"
      :reminder-tooltip="reminderTooltip"
      :recurring-tooltip="recurringTooltip"
      @set-reminder="openReminderSetting"
      @set-recurring="openRecurringSetting"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { showMessage } from 'siyuan';
import type { Item, Link } from '@/types/models';
import { useSettingsStore } from '@/stores';
import { t } from '@/i18n';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { calculateReminderTime } from '@/parser/reminderParser';
import { generateEndConditionMarker, generateRepeatRuleMarker, getNextOccurrenceDate } from '@/parser/recurringParser';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';
import { showReminderSettingDialog, showRecurringSettingDialog } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';
import TodoItemActionButtons from './TodoItemActionButtons.vue';
import TodoTypedLinks from './TodoTypedLinks.vue';

const props = defineProps<{
  item: Item;
}>();

const settingsStore = useSettingsStore();

const showLinks = computed(() => settingsStore.todoDock.showLinks);
const showReminderAndRecurring = computed(() => settingsStore.todoDock.showReminderAndRecurring);
const isCompletedOrAbandoned = computed(() => props.item.status === 'completed' || props.item.status === 'abandoned');
const hasReminder = computed(() => !!props.item.reminder?.enabled);
const hasRecurring = computed(() => !!props.item.repeatRule);
const canSetRecurring = computed(() => !props.item.siblingItems?.length);

const visibleLinks = computed<Link[]>(() => {
  const merged = [...(props.item.links || []), ...(props.item.task?.links || [])];
  const deduped = new Map<string, Link>();
  for (const link of merged) {
    deduped.set(`${link.name}|${link.url}|${link.type || ''}`, link);
  }
  return [...deduped.values()];
});

const reminderText = computed(() => {
  if (!hasReminder.value) return t('reminder.setReminder');
  return formatReminderDisplay(props.item.reminder, t);
});

const recurringText = computed(() => {
  if (!hasRecurring.value) return t('recurring.setRecurring');
  const ruleMarker = generateRepeatRuleMarker(props.item.repeatRule);
  const endMarker = generateEndConditionMarker(props.item.endCondition);
  const compactRuleMarker = ruleMarker.replace(/^🔁\s*/, '');
  return endMarker ? `${compactRuleMarker} ${endMarker}` : compactRuleMarker;
});

const reminderTooltip = computed(() => {
  if (!hasReminder.value || !props.item.reminder) return reminderText.value;
  const reminderTime = calculateReminderTime(
    props.item.date,
    props.item.startDateTime,
    props.item.endDateTime,
    undefined,
    undefined,
    props.item.reminder,
  );
  if (!reminderTime) return reminderText.value;
  const formattedTime = dayjs(reminderTime).format('YYYY-MM-DD HH:mm');
  return reminderTime < Date.now()
    ? t('reminder.lastReminder', { time: formattedTime })
    : t('reminder.nextReminder', { time: formattedTime });
});

const recurringTooltip = computed(() => {
  if (!hasRecurring.value || !props.item.repeatRule) return recurringText.value;
  const nextDate = getNextOccurrenceDate(props.item.date, props.item.repeatRule);
  return t('recurring.nextOccurrence', { date: nextDate });
});

const shouldRender = computed(() => {
  return (
    (showLinks.value && visibleLinks.value.length > 0)
    || (
      showReminderAndRecurring.value
      && (!isCompletedOrAbandoned.value || hasReminder.value || hasRecurring.value)
    )
  );
});

function openReminderSetting() {
  if (isCompletedOrAbandoned.value) return;
  showReminderSettingDialog(props.item);
}

function openRecurringSetting() {
  if (isCompletedOrAbandoned.value || !canSetRecurring.value) return;
  showRecurringSettingDialog(props.item);
}

async function handleLinkClick(link: Link) {
  if (link.type !== 'attachment') {
    return;
  }

  const targetBlockId = resolveAttachmentTargetBlockId(link, props.item.blockId);
  if (!props.item.docId || !targetBlockId) {
    showMessage(t('common').blockIdError, 'error');
    return;
  }

  const opened = await openDocumentAtLine(props.item.docId, undefined, targetBlockId);
  if (!opened) {
    showMessage(t('common').blockIdError, 'error');
  }
}
</script>

<style scoped lang="scss">
.item-meta-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
</style>
