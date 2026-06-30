import type { QuadrantPanelConfig } from '@/types/quadrant'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import QuadrantRuleDialog from '@/components/quadrant/QuadrantRuleDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openQuadrantRuleDialog(options: {
  panel: QuadrantPanelConfig
  onSave: (panel: QuadrantPanelConfig) => void | Promise<void>
  onResetDefaults: () => void | Promise<void>
}): Dialog {
  const mountEl = document.createElement('div')
  mountEl.className = 'quadrant-rule-dialog-host'
  let app: ReturnType<typeof createApp> | null = null
  let isSaving = false

  const dialog = new Dialog({
    title: t('quadrant').editPanel,
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

  app = createApp(QuadrantRuleDialog, {
    panel: options.panel,
    onClose: closeDialog,
    onSave: async (panel: QuadrantPanelConfig) => {
      if (isSaving) return
      isSaving = true
      try {
        await options.onSave(panel)
        closeDialog()
      }
      finally {
        isSaving = false
      }
    },
    onResetDefaults: async () => {
      await options.onResetDefaults()
      closeDialog()
    },
  })

  const pinia = getSharedPinia()
  if (pinia) {
    app.use(pinia)
  }
  app.mount(mountEl)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body') as HTMLElement | null
  if (bodyEl) {
    bodyEl.style.padding = '0'
    bodyEl.style.overflow = 'hidden'
    bodyEl.appendChild(mountEl)
  }
  return dialog
}
