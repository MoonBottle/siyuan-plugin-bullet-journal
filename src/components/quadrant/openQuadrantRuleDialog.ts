import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import QuadrantRuleDialog from '@/components/quadrant/QuadrantRuleDialog.vue';
import { t } from '@/i18n';
import type { QuadrantPanelConfig } from '@/types/quadrant';
import { getSharedPinia } from '@/utils/sharedPinia';

export function openQuadrantRuleDialog(options: {
  panel: QuadrantPanelConfig;
  onSave: (panel: QuadrantPanelConfig) => void | Promise<void>;
  onResetDefaults: () => void | Promise<void>;
}): Dialog {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;
  let isSaving = false;

  const dialog = new Dialog({
    title: t('quadrant').editPanel,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  const closeDialog = () => {
    dialog.destroy();
  };

  app = createApp(QuadrantRuleDialog, {
    panel: options.panel,
    onClose: closeDialog,
    onSave: async (panel: QuadrantPanelConfig) => {
      if (isSaving) return;
      isSaving = true;
      try {
        await options.onSave(panel);
        closeDialog();
      }
      finally {
        isSaving = false;
      }
    },
    onResetDefaults: async () => {
      await options.onResetDefaults();
      closeDialog();
    },
  });

  const pinia = getSharedPinia();
  if (pinia) {
    app.use(pinia);
  }
  app.mount(mountEl);

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
  return dialog;
}
