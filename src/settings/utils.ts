import { t } from '@/i18n';
import type { SettingsData } from './types';

/**
 * 更新默认分组下拉框
 */
export function updateDefaultGroupSelect(
  select: HTMLSelectElement,
  settings: SettingsData
): void {
  const currentValue = settings.defaultGroup;
  select.innerHTML = '<option value="">' + t('settings').projectGroups.noGroup + '</option>';
  settings.groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name || t('settings').projectGroups.unnamed;
    if (group.id === currentValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * 填充分组下拉框
 */
export function populateGroupSelect(
  select: HTMLSelectElement,
  settings: SettingsData,
  selectedId?: string
): void {
  select.innerHTML = '<option value="">' + t('settings').projectGroups.noGroup + '</option>';
  settings.groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name || t('settings').projectGroups.unnamed;
    if (group.id === selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

/**
 * 更新所有分组下拉框（分组名称变化时调用）
 */
export function updateAllGroupSelects(settings: SettingsData): void {
  const selects = document.querySelectorAll('[data-dir-id]');
  selects.forEach((selectEl) => {
    const select = selectEl as HTMLSelectElement;
    const dirId = select.dataset.dirId;
    const dir = settings.directories.find(d => d.id === dirId);
    populateGroupSelect(select, settings, dir?.groupId);
  });
}

/**
 * 渲染分组列表
 */
export function renderGroupsList(
  container: HTMLElement,
  settings: SettingsData,
  updateDefaultGroupSelectFn: (select: HTMLSelectElement) => void,
  updateAllGroupSelectsFn: () => void
): void {
  const listContainer = container.querySelector('#group-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  settings.groups.forEach((group, index) => {
    const item = document.createElement('div');
    item.className = 'fn__flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.padding = '4px 0';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'b3-text-field fn__flex-center';
    nameInput.style.flex = '1';
    nameInput.value = group.name;
    nameInput.placeholder = t('settings').projectGroups.namePlaceholder;
    nameInput.addEventListener('input', (e) => {
      settings.groups[index].name = (e.target as HTMLInputElement).value;
      // 更新默认分组下拉框
      const defaultSelect = container.querySelector('#default-group-select') as HTMLSelectElement;
      if (defaultSelect) {
        updateDefaultGroupSelectFn(defaultSelect);
      }
      // 更新目录列表中的分组下拉框
      updateAllGroupSelectsFn();
    });

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'b3-tooltips b3-tooltips__nw';
    deleteBtn.setAttribute('aria-label', t('settings').projectGroups.deleteButton);
    deleteBtn.style.display = 'inline-flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    deleteBtn.style.width = '24px';
    deleteBtn.style.height = '24px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.color = 'var(--b3-theme-on-surface)';
    deleteBtn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor;display:block;"><use xlink:href="#iconTrashcan"></use></svg>';
    deleteBtn.addEventListener('click', () => {
      const deletedGroupId = settings.groups[index].id;
      settings.groups.splice(index, 1);
      // 删除分组后，将关联该分组的目录和默认分组自动清空
      if (settings.defaultGroup === deletedGroupId) {
        settings.defaultGroup = '';
      }
      settings.directories.forEach(d => {
        if (d.groupId === deletedGroupId) {
          d.groupId = undefined;
        }
      });
      renderGroupsList(container, settings, updateDefaultGroupSelectFn, updateAllGroupSelectsFn);
      const defaultSelect = container.querySelector('#default-group-select') as HTMLSelectElement | null;
      if (defaultSelect) updateDefaultGroupSelectFn(defaultSelect);
      updateAllGroupSelectsFn();
    });

    item.appendChild(nameInput);
    item.appendChild(deleteBtn);
    listContainer.appendChild(item);
  });
}

/**
 * 渲染目录列表
 */
export function renderDirectoriesList(
  container: HTMLElement,
  settings: SettingsData,
  populateGroupSelectFn: (select: HTMLSelectElement, selectedId?: string) => void
): void {
  const listContainer = container.querySelector('#directory-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  settings.directories.forEach((dir, index) => {
    const item = document.createElement('div');
    item.className = 'fn__flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.padding = '8px 0';
    item.style.borderBottom = '1px solid var(--b3-theme-surface-lighter)';

    // 路径输入框
    const pathInput = document.createElement('input');
    pathInput.type = 'text';
    pathInput.className = 'b3-text-field fn__flex-center';
    pathInput.style.flex = '1';
    pathInput.value = dir.path;
    pathInput.placeholder = t('settings').projectDirectories.pathPlaceholder;
    pathInput.addEventListener('input', (e) => {
      settings.directories[index].path = (e.target as HTMLInputElement).value;
    });
    // 第一个输入框：避免弹框打开时被自动聚焦
    if (index === 0) {
      const created = Date.now();
      pathInput.addEventListener(
        'focus',
        function onFirstFocus() {
          if (Date.now() - created < 300) {
            requestAnimationFrame(() => pathInput.blur());
          }
          pathInput.removeEventListener('focus', onFirstFocus);
        },
        { once: true }
      );
    }

    // 分组选择器
    const groupSelect = document.createElement('select');
    groupSelect.className = 'b3-select fn__flex-center';
    groupSelect.style.minWidth = '100px';
    groupSelect.dataset.dirId = dir.id;
    populateGroupSelectFn(groupSelect, dir.groupId);
    groupSelect.addEventListener('change', (e) => {
      settings.directories[index].groupId = (e.target as HTMLSelectElement).value || undefined;
    });

    // 删除按钮
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'b3-tooltips b3-tooltips__nw';
    deleteBtn.setAttribute('aria-label', t('settings').projectGroups.deleteButton);
    deleteBtn.style.display = 'inline-flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    deleteBtn.style.width = '24px';
    deleteBtn.style.height = '24px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.color = 'var(--b3-theme-on-surface)';
    deleteBtn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor;display:block;"><use xlink:href="#iconTrashcan"></use></svg>';
    deleteBtn.addEventListener('click', () => {
      settings.directories.splice(index, 1);
      renderDirectoriesList(container, settings, populateGroupSelectFn);
    });

    // 启用开关
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'b3-switch fn__flex-center';
    checkbox.checked = dir.enabled;
    checkbox.addEventListener('change', (e) => {
      settings.directories[index].enabled = (e.target as HTMLInputElement).checked;
    });

    item.appendChild(pathInput);
    item.appendChild(groupSelect);
    item.appendChild(deleteBtn);
    item.appendChild(checkbox);
    listContainer.appendChild(item);
  });
}
