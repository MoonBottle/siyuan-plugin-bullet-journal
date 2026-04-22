<template>
  <div v-if="shouldRender" class="item-meta-panel">
    <div v-if="showLinks && visibleLinks.length > 0" class="item-meta-links">
      <SyButton
        v-for="link in visibleLinks"
        :key="`${link.name}-${link.url}-${link.type || 'default'}`"
        type="link"
        :text="link.name"
        :href="link.url"
        :class="['typed-link', `typed-link--${link.type || 'default'}`]"
      />
    </div>

    <div
      v-if="showReminderAndRecurring && (!isCompletedOrAbandoned || hasReminder || hasRecurring)"
      class="item-meta-actions"
    >
      <button
        v-if="!isCompletedOrAbandoned || hasReminder"
        class="item-meta-action b3-tooltips b3-tooltips__n"
        :class="{ active: hasReminder, readonly: isCompletedOrAbandoned }"
        :disabled="isCompletedOrAbandoned"
        :aria-label="reminderTooltip"
        @click.stop="openReminderSetting"
      >
        <span>⏰</span>
        <span>{{ reminderText }}</span>
      </button>

      <button
        v-if="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
        class="item-meta-action b3-tooltips b3-tooltips__n"
        :class="{ active: hasRecurring, readonly: isCompletedOrAbandoned }"
        :disabled="isCompletedOrAbandoned"
        :aria-label="recurringTooltip"
        @click.stop="openRecurringSetting"
      >
        <span>🔁</span>
        <span>{{ recurringText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Item, Link } from '@/types/models';
import { useSettingsStore } from '@/stores';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import { t } from '@/i18n';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { calculateReminderTime } from '@/parser/reminderParser';
import { generateEndConditionMarker, generateRepeatRuleMarker, getNextOccurrenceDate } from '@/parser/recurringParser';
import { showReminderSettingDialog, showRecurringSettingDialog } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';

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
</script>

<style scoped lang="scss">
.item-meta-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.item-meta-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.item-meta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.item-meta-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 999px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.readonly {
    cursor: default;
    opacity: 0.8;

    &:hover {
      color: var(--b3-theme-on-surface);
      border-color: var(--b3-border-color);
    }
  }

  &:disabled {
    cursor: not-allowed;
  }
}

:deep(.typed-link) {
  border: 1px solid var(--b3-border-color);
}

:deep(.typed-link--external) {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

:deep(.typed-link--siyuan) {
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, var(--b3-theme-surface) 88%);
  color: var(--b3-theme-on-surface);
}

:deep(.typed-link--block-ref) {
  background: color-mix(in srgb, var(--b3-theme-primary-light) 16%, var(--b3-theme-surface) 84%);
  color: var(--b3-theme-on-surface);
}
</style>
