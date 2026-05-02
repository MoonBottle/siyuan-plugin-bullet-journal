import { Dialog } from 'siyuan';
import { createApp } from 'vue';
import HabitWidgetDetailDialog from '@/components/workbench/dialogs/HabitWidgetDetailDialog.vue';
import { t } from '@/i18n';
import { getSharedPinia } from '@/utils/sharedPinia';

export function openHabitWidgetDetailDialog(options: {
  habitId: string;
  habitName: string;
  groupId?: string;
}): Dialog {
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;

  const dialog = new Dialog({
    title: options.habitName || t('habit').title,
    content: '',
    width: '760px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  app = createApp(HabitWidgetDetailDialog, {
    habitId: options.habitId,
    groupId: options.groupId,
  });

  const pinia = getSharedPinia();
  if (pinia) {
    app.use(pinia);
  }
  app.mount(mountEl);

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
  return dialog;
}
