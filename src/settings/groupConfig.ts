import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { ProjectGroup } from '@/types/models';
import type { SettingsData } from './types';
import { renderGroupsList, updateDefaultGroupSelect } from './utils';

export function addGroupConfigItem(
  setting: Setting,
  settings: SettingsData,
  updateDefaultGroupSelectFn: (select: HTMLSelectElement) => void,
  updateAllGroupSelectsFn: () => void
): void {
  setting.addItem({
    title: t('settings').groupManage.title,
    description: t('settings').groupManage.description,
    direction: 'row',
    createActionElement: () => {
      const container = document.createElement('div');
      container.className = 'fn__flex-column';
      container.style.gap = '8px';

      // 顶部操作栏：默认分组选择器 + 添加分组按钮
      const topBar = document.createElement('div');
      topBar.className = 'fn__flex';
      topBar.style.alignItems = 'center';
      topBar.style.gap = '8px';

      const defaultGroupLabel = document.createElement('span');
      defaultGroupLabel.textContent = t('settings').groupManage.defaultLabel;
      defaultGroupLabel.style.fontSize = '12px';
      defaultGroupLabel.style.color = 'var(--b3-theme-on-surface)';
      topBar.appendChild(defaultGroupLabel);

      const defaultGroupSelect = document.createElement('select');
      defaultGroupSelect.className = 'b3-select fn__flex-center';
      defaultGroupSelect.id = 'default-group-select';
      updateDefaultGroupSelect(defaultGroupSelect, settings);
      defaultGroupSelect.addEventListener('change', (e) => {
        settings.defaultGroup = (e.target as HTMLSelectElement).value;
      });
      topBar.appendChild(defaultGroupSelect);

      // 弹性空间，将添加按钮推到右侧
      const spacer = document.createElement('div');
      spacer.style.flex = '1';
      topBar.appendChild(spacer);

      const addGroupBtn = document.createElement('button');
      addGroupBtn.className = 'b3-button b3-button--outline fn__flex-center';
      addGroupBtn.textContent = '+ ' + t('settings').projectGroups.addButton;
      addGroupBtn.addEventListener('click', () => {
        const newGroup: ProjectGroup = {
          id: 'group-' + Date.now(),
          name: ''
        };
        settings.groups.push(newGroup);
        renderGroupsList(container, settings, updateDefaultGroupSelectFn, updateAllGroupSelectsFn);
      });
      topBar.appendChild(addGroupBtn);

      container.appendChild(topBar);

      // 分组列表容器
      const listContainer = document.createElement('div');
      listContainer.id = 'group-list';
      listContainer.className = 'fn__flex-column';
      listContainer.style.gap = '4px';
      container.appendChild(listContainer);

      // 初始渲染分组列表
      renderGroupsList(container, settings, updateDefaultGroupSelectFn, updateAllGroupSelectsFn);

      return container;
    }
  });
}
