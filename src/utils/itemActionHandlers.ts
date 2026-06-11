import type { Ref } from 'vue'
import type { Item } from '@/types/models'
import { ref } from 'vue'
import { TAB_TYPES } from '@/constants'
import { writeBlock } from '@/utils/blockWriter'
import {
  showDatePickerDialog,
  showFocusPlanDialog,
  showItemDetailModal,
  showPomodoroTimerDialog,
} from '@/utils/dialog'
import { openDocumentAtLine } from '@/utils/fileUtils'
import {
  abandonItem,
  completeItem,
  migrateItem,
  migrateItemToDate,
  migrateItemToToday,
  skipOccurrenceItem,
} from '@/utils/itemActions'
import { toggleItemPinned } from '@/utils/itemSettingUtils'

export interface ItemActionHandlers {
  isProcessing: Readonly<Ref<boolean>>
  complete: () => Promise<void>
  abandon: () => Promise<void>
  migrate: () => Promise<void>
  migrateToToday: () => Promise<void>
  migrateCustom: () => void
  startFocus: () => void
  focusPlan: () => void
  openDoc: () => void
  openDetail: () => void
  openCalendar: () => void
  togglePinned: () => Promise<void>
  skipOccurrence: () => Promise<void>
  setPriority: (priority: Item['priority']) => Promise<void>
}

export function getItemActionHandlers(
  item: Item,
  plugin: any,
  options?: {
    afterAction?: () => void
  },
): ItemActionHandlers {
  const isProcessing = ref(false)
  const afterAction = options?.afterAction

  async function withProcessing<T>(fn: () => Promise<T>): Promise<void> {
    if (isProcessing.value) return
    isProcessing.value = true
    try {
      await fn()
      afterAction?.()
    } finally {
      isProcessing.value = false
    }
  }

  return {
    isProcessing,

    async complete() {
      await withProcessing(() => completeItem(item))
    },

    async abandon() {
      await withProcessing(() => abandonItem(item))
    },

    async migrate() {
      await withProcessing(() => migrateItem(item))
    },

    async migrateToToday() {
      await withProcessing(() => migrateItemToToday(item))
    },

    migrateCustom() {
      if (isProcessing.value || !item.blockId) return
      showDatePickerDialog('', item.date, async (newDate) => {
        if (isProcessing.value) return
        isProcessing.value = true
        try {
          await migrateItemToDate(item, newDate)
          afterAction?.()
        } finally {
          isProcessing.value = false
        }
      })
    },

    startFocus() {
      if (isProcessing.value || !item.blockId) return
      showPomodoroTimerDialog(item.blockId)
    },

    focusPlan() {
      if (isProcessing.value) return
      showFocusPlanDialog(item)
    },

    openDoc() {
      if (isProcessing.value || !item.docId) return
      openDocumentAtLine(item.docId, item.lineNumber, item.blockId)
      afterAction?.()
    },

    openDetail() {
      if (isProcessing.value) return
      showItemDetailModal(item, { showAllDates: true })
    },

    openCalendar() {
      if (isProcessing.value) return
      if (plugin?.openCustomTab) {
        plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date })
      }
      afterAction?.()
    },

    async togglePinned() {
      await withProcessing(() => toggleItemPinned(item))
    },

    async skipOccurrence() {
      await withProcessing(() => skipOccurrenceItem(plugin, item))
    },

    async setPriority(priority: Item['priority']) {
      if (isProcessing.value || !item.blockId) return
      isProcessing.value = true
      try {
        await writeBlock(
          { blockId: item.blockId },
          {
            type: 'setPriority',
            priority,
          },
        )
        afterAction?.()
      } finally {
        isProcessing.value = false
      }
    },
  }
}
