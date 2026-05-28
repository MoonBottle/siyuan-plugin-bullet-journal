import type {
  WorkbenchDatePickerWidgetConfig,
  WorkbenchWidgetInstance,
} from '@/types/workbench'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import DatePickerWidgetConfigDialog from '@/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openDatePickerWidgetConfigDialog(options: {
  initialConfig: WorkbenchDatePickerWidgetConfig
  dashboardWidgets: WorkbenchWidgetInstance[]
  onConfirm: (config: WorkbenchDatePickerWidgetConfig) => void | Promise<void>
}): Dialog {
  const mountEl = document.createElement('div')
  let app: ReturnType<typeof createApp> | null = null
  let isConfirming = false

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount()
      app = null
    },
  })

  const closeDialog = () => {
    dialog.destroy()
  }

  app = createApp(DatePickerWidgetConfigDialog, {
    initialConfig: options.initialConfig,
    dashboardWidgets: options.dashboardWidgets,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchDatePickerWidgetConfig) => {
      if (isConfirming) return
      isConfirming = true
      try {
        await options.onConfirm(config)
        closeDialog()
      }
      finally {
        isConfirming = false
      }
    },
  })

  const pinia = getSharedPinia()
  if (pinia) app.use(pinia)
  app.mount(mountEl)

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl)
  return dialog
}
