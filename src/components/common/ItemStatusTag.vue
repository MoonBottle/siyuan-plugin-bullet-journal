<template>
  <span
    class="item-status-tag"
    :class="`status-${statusInfo.class}`"
  >{{ statusInfo.text }}</span>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'

import { computed } from 'vue'

import { t } from '@/i18n'
import {
  getDateRangeStatus,
  getTimeRangeStatus,
} from '@/utils/dateRangeUtils'
import dayjs from '@/utils/dayjs'

const props = defineProps<{
  item: Item
}>()

function getEffectiveDate(item: Item): string {
  return item.dateRangeEnd || item.date
}

const itemStatus = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD')
  if (props.item.status === 'completed') return 'completed'
  if (props.item.status === 'abandoned') return 'abandoned'
  if (props.item.dateRangeStart && props.item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(props.item, todayStr)
    return rangeStatus ?? (getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending')
  }
  const timeStatus = getTimeRangeStatus(props.item, dayjs().format('YYYY-MM-DD HH:mm:ss'))
  if (timeStatus) return timeStatus
  return getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending'
})

const statusInfo = computed(() => {
  const statusMap: Record<string, { text: string, class: string }> = {
    pending: {
      text: t('todo').pending,
      class: 'pending',
    },
    in_progress: {
      text: t('todo').inProgress,
      class: 'in-progress',
    },
    completed: {
      text: t('todo').completed,
      class: 'completed',
    },
    abandoned: {
      text: t('todo').abandoned,
      class: 'abandoned',
    },
    expired: {
      text: t('todo').expired,
      class: 'expired',
    },
  }
  return statusMap[itemStatus.value] || statusMap.pending
})
</script>

<style lang="scss" scoped>
.item-status-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  height: 16px;
  white-space: nowrap;

  &.status-pending {
    background: color-mix(in srgb, var(--b3-theme-primary-lightest) 50%, transparent);
    color: var(--b3-theme-primary);
  }

  &.status-in-progress {
    background: color-mix(in srgb, var(--b3-card-warning-background) 50%, transparent);
    color: var(--b3-card-warning-color);
  }

  &.status-completed {
    background: color-mix(in srgb, var(--b3-card-success-background) 50%, transparent);
    color: var(--b3-card-success-color);
  }

  &.status-abandoned {
    background: color-mix(in srgb, var(--b3-theme-surface-lighter) 50%, transparent);
    color: var(--b3-theme-on-surface);
  }

  &.status-expired {
    background: color-mix(in srgb, var(--b3-card-error-background) 50%, transparent);
    color: var(--b3-card-error-color);
  }
}
</style>
