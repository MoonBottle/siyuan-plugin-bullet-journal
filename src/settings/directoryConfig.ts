import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { ProjectDirectory } from '@/types/models';
import type { SettingsData } from './types';
import { renderDirectoriesList } from './utils';

export function addDirectoryConfigItem(
  setting: Setting,
  settings: SettingsData,
  populateGroupSelectFn: (select: HTMLSelectElement, selectedId?: string) => void
): void {
  setting.addItem({
    title: t('settings').dirConfig.title,
    description: t('settings').dirConfig.description,
    direction: 'row',
    createActionElement: () => {
      const container = document.createElement('div');
      container.className = 'fn__flex-column';
      container.style.gap = '8px';

      // 顶部操作栏：添加目录按钮
      const topBar = document.createElement('div');
      topBar.className = 'fn__flex';
      topBar.style.alignItems = 'center';
      topBar.style.justifyContent = 'flex-end';

      const addDirBtn = document.createElement('button');
      addDirBtn.className = 'b3-button b3-button--outline fn__flex-center';
      addDirBtn.textContent = '+ ' + t('settings').projectDirectories.addButton;
      addDirBtn.addEventListener('click', () => {
        const newDir: ProjectDirectory = {
          id: 'dir-' + Date.now(),
          path: '',
          enabled: true,
          groupId: settings.defaultGroup || undefined
        };
        settings.directories.push(newDir);
        renderDirectoriesList(container, settings, populateGroupSelectFn);
      });
      topBar.appendChild(addDirBtn);

      container.appendChild(topBar);

      // 目录列表容器
      const listContainer = document.createElement('div');
      listContainer.id = 'directory-list';
      listContainer.className = 'fn__flex-column';
      listContainer.style.gap = '4px';
      container.appendChild(listContainer);

      // 初始渲染目录列表
      renderDirectoriesList(container, settings, populateGroupSelectFn);

      return container;
    }
  });
}
