import type { WorkbenchQuadrantViewConfig } from '@/types/workbench'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import QuadrantViewConfigDialog from '@/components/workbench/dialogs/QuadrantViewConfigDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openQuadrantViewConfigDialog(options: {
  initialConfig: WorkbenchQuadrantViewConfig
  onConfirm: (config: WorkbenchQuadrantViewConfig) => void | Promise<void>
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

  app = createApp(QuadrantViewConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchQuadrantViewConfig) => {
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
