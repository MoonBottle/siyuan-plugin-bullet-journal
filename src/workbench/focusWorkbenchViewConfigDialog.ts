import type { WorkbenchFocusWorkbenchViewConfig } from '@/types/workbench'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import FocusWorkbenchViewConfigDialog from '@/components/workbench/dialogs/FocusWorkbenchViewConfigDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openFocusWorkbenchViewConfigDialog(options: {
  initialConfig: WorkbenchFocusWorkbenchViewConfig
  onConfirm: (config: WorkbenchFocusWorkbenchViewConfig) => void | Promise<void>
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

  app = createApp(FocusWorkbenchViewConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchFocusWorkbenchViewConfig) => {
      if (isConfirming) {
        return
      }

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
  if (pinia) {
    app.use(pinia)
  }
  app.mount(mountEl)

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl)
  return dialog
}
