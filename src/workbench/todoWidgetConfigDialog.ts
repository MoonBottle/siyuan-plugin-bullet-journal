import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import TodoWidgetConfigDialog from '@/components/workbench/dialogs/TodoWidgetConfigDialog.vue';
import type { WorkbenchTodoListWidgetConfig } from '@/types/workbench';
import { getSharedPinia } from '@/utils/sharedPinia';
import { t } from '@/i18n';

export function openTodoWidgetConfigDialog(options: {
  initialConfig: WorkbenchTodoListWidgetConfig;
  onConfirm: (config: WorkbenchTodoListWidgetConfig) => void | Promise<void>;
}): Dialog {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;
  let isConfirming = false;

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '560px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  const closeDialog = () => {
    dialog.destroy();
  };

  app = createApp(TodoWidgetConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchTodoListWidgetConfig) => {
      if (isConfirming) {
        return;
      }

      isConfirming = true;
      try {
        await options.onConfirm(config);
        closeDialog();
      }
      finally {
        isConfirming = false;
      }
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
