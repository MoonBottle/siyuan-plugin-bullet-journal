import { Setting, showMessage } from 'siyuan';
import { t } from '@/i18n';
import { PROVIDER_PRESETS, type AIProviderConfig } from '@/types/ai';
import type { SettingsData } from './types';

export function addAiConfigItem(setting: Setting, settings: SettingsData): void {
  setting.addItem({
    title: (t('settings') as any).ai?.title ?? 'AI 服务配置',
    description: (t('settings') as any).ai?.description ?? '配置 AI 服务商，支持添加多个供应商配置',
    direction: 'row',
    createActionElement: () => {
      const container = document.createElement('div');
      container.className = 'fn__flex-column';
      container.style.gap = '12px';
      container.style.width = '100%';

      // 确保 ai 设置存在（新结构）
      if (!settings.ai) {
        settings.ai = {
          providers: [],
          activeProviderId: null
        };
      }
      // 兼容旧配置
      if (!settings.ai.providers) {
        settings.ai.providers = [];
      }
      if (!settings.ai.activeProviderId && settings.ai.providers.length > 0) {
        settings.ai.activeProviderId = settings.ai.providers[0].id;
      }

      // 供应商列表容器
      const providerListContainer = document.createElement('div');
      providerListContainer.className = 'fn__flex-column';
      providerListContainer.style.gap = '8px';

      // 当前正在编辑的供应商索引（-1 表示新增）
      let editingIndex = -1;

      // 渲染供应商列表
      const renderProviderList = () => {
        providerListContainer.innerHTML = '';

        if (settings.ai!.providers.length === 0 && editingIndex === -1) {
          const emptyMsg = document.createElement('div');
          emptyMsg.textContent = (t('settings') as any).ai?.emptyProviders ?? '暂无供应商配置，点击下方按钮添加';
          emptyMsg.style.color = 'var(--b3-theme-on-surface-light)';
          emptyMsg.style.fontSize = '13px';
          emptyMsg.style.padding = '12px';
          emptyMsg.style.textAlign = 'center';
          providerListContainer.appendChild(emptyMsg);
          return;
        }

        settings.ai!.providers.forEach((provider, index) => {
          const isEditing = editingIndex === index;

          // 卡片容器
          const card = document.createElement('div');
          card.className = 'fn__flex-column';
          card.style.background = 'var(--b3-theme-surface-lighter)';
          card.style.borderRadius = 'var(--b3-border-radius)';

          // 卡片头部（始终显示）
          const header = document.createElement('div');
          header.className = 'fn__flex';
          header.style.alignItems = 'center';
          header.style.gap = '8px';
          header.style.padding = '8px 12px';
          header.style.cursor = isEditing ? 'default' : 'pointer';
          header.style.transition = 'background 0.2s';

          // 名称和模型信息
          const info = document.createElement('div');
          info.className = 'fn__flex-column';
          info.style.flex = '1';
          info.style.gap = '2px';

          const name = document.createElement('span');
          name.textContent = provider.name;
          name.style.fontSize = '13px';
          name.style.fontWeight = '500';

          const model = document.createElement('span');
          model.textContent = `${PROVIDER_PRESETS[provider.provider]?.name || provider.provider} · ${provider.defaultModel}`;
          model.style.fontSize = '11px';
          model.style.color = 'var(--b3-theme-on-surface-light)';

          info.appendChild(name);
          info.appendChild(model);

          // 按钮容器
          const btnContainer = document.createElement('div');
          btnContainer.className = 'fn__flex';
          btnContainer.style.alignItems = 'center';
          btnContainer.style.gap = '4px';

          // 编辑/展开按钮
          const editBtn = document.createElement('span');
          editBtn.className = 'b3-tooltips b3-tooltips__nw';
          editBtn.setAttribute('aria-label', isEditing ? ((t('settings') as any).ai?.collapse ?? '收起') : ((t('settings') as any).ai?.edit ?? '编辑'));
          editBtn.style.display = 'inline-flex';
          editBtn.style.alignItems = 'center';
          editBtn.style.justifyContent = 'center';
          editBtn.style.width = '24px';
          editBtn.style.height = '24px';
          editBtn.style.cursor = 'pointer';
          editBtn.style.borderRadius = '4px';
          editBtn.style.color = 'var(--b3-theme-on-surface)';
          editBtn.innerHTML = `<svg style="width:14px;height:14px;fill:currentColor;display:block;"><use xlink:href="#${isEditing ? 'iconContract' : 'iconEdit'}"></use></svg>`;
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingIndex = isEditing ? -1 : index;
            renderProviderList();
          });

          // 删除按钮
          const deleteBtn = document.createElement('span');
          deleteBtn.className = 'b3-tooltips b3-tooltips__nw';
          deleteBtn.setAttribute('aria-label', (t('settings') as any).projectGroups?.deleteButton ?? '删除');
          deleteBtn.style.display = 'inline-flex';
          deleteBtn.style.alignItems = 'center';
          deleteBtn.style.justifyContent = 'center';
          deleteBtn.style.width = '24px';
          deleteBtn.style.height = '24px';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.borderRadius = '4px';
          deleteBtn.style.color = 'var(--b3-theme-on-surface)';
          deleteBtn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor;display:block;"><use xlink:href="#iconTrashcan"></use></svg>';
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(((t('settings') as any).ai?.confirmDeleteProvider ?? '确定要删除 "{{name}}" 吗？').replace('{{name}}', provider.name))) {
              settings.ai!.providers.splice(index, 1);
              // 如果删除的是 activeProvider，重置
              if (settings.ai!.activeProviderId === provider.id) {
                settings.ai!.activeProviderId = settings.ai!.providers.find(p => p.enabled)?.id || null;
              }
              if (editingIndex === index) {
                editingIndex = -1;
              }
              renderProviderList();
            }
          });

          btnContainer.appendChild(editBtn);
          btnContainer.appendChild(deleteBtn);

          // 启用开关
          const switchBtn = document.createElement('input');
          switchBtn.type = 'checkbox';
          switchBtn.className = 'b3-switch';
          switchBtn.checked = provider.enabled;
          switchBtn.addEventListener('change', (e) => {
            provider.enabled = (e.target as HTMLInputElement).checked;
          });

          header.appendChild(info);
          header.appendChild(btnContainer);
          header.appendChild(switchBtn);
          card.appendChild(header);

          // 编辑区域（展开时显示）
          if (isEditing) {
            const editArea = document.createElement('div');
            editArea.className = 'fn__flex-column';
            editArea.style.padding = '12px';
            editArea.style.gap = '12px';
            editArea.style.borderTop = '1px solid var(--b3-theme-surface)';
            editArea.style.background = 'var(--b3-theme-background)';

            // 配置名称
            const nameRow = document.createElement('div');
            nameRow.className = 'fn__flex';
            nameRow.style.alignItems = 'center';
            nameRow.style.gap = '8px';
            nameRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.configName ?? '配置名称'}</span>`;
            const nameInput = document.createElement('input');
            nameInput.className = 'b3-text-field fn__flex-center';
            nameInput.style.flex = '1';
            nameInput.placeholder = (t('settings') as any).ai?.namePlaceholder ?? '如：Kimi-个人';
            nameInput.value = provider.name;
            nameRow.appendChild(nameInput);
            editArea.appendChild(nameRow);

            // 供应商类型
            const typeRow = document.createElement('div');
            typeRow.className = 'fn__flex';
            typeRow.style.alignItems = 'center';
            typeRow.style.gap = '8px';
            typeRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.selectProvider ?? '选择供应商'}</span>`;
            const typeSelect = document.createElement('select');
            typeSelect.className = 'b3-select fn__flex-center';
            typeSelect.style.flex = '1';
            Object.entries(PROVIDER_PRESETS).forEach(([key, preset]) => {
              const option = document.createElement('option');
              option.value = key;
              option.textContent = preset.name;
              typeSelect.appendChild(option);
            });
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = (t('settings') as any).ai?.customProvider ?? '自定义';
            typeSelect.appendChild(customOption);
            typeSelect.value = provider.provider;
            typeRow.appendChild(typeSelect);
            editArea.appendChild(typeRow);

            // API 地址
            const urlRow = document.createElement('div');
            urlRow.className = 'fn__flex';
            urlRow.style.alignItems = 'center';
            urlRow.style.gap = '8px';
            urlRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.apiUrlLabel ?? 'API 地址'}</span>`;
            const urlInput = document.createElement('input');
            urlInput.className = 'b3-text-field fn__flex-center';
            urlInput.style.flex = '1';
            urlInput.placeholder = (t('settings') as any).ai?.apiUrlPlaceholder ?? 'https://api.example.com/v1/chat/completions';
            urlInput.value = provider.apiUrl;
            urlRow.appendChild(urlInput);
            editArea.appendChild(urlRow);

            // API Key
            const keyRow = document.createElement('div');
            keyRow.className = 'fn__flex';
            keyRow.style.alignItems = 'center';
            keyRow.style.gap = '8px';
            keyRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.apiKeyLabel ?? 'API Key'}</span>`;
            const keyInput = document.createElement('input');
            keyInput.className = 'b3-text-field fn__flex-center';
            keyInput.style.flex = '1';
            keyInput.type = 'password';
            keyInput.placeholder = (t('settings') as any).ai?.apiKeyPlaceholder ?? '输入 API Key';
            keyInput.value = provider.apiKey;
            keyRow.appendChild(keyInput);
            editArea.appendChild(keyRow);

            // 模型列表
            const modelsLabel = document.createElement('div');
            modelsLabel.textContent = (t('settings') as any).ai?.modelsLabel ?? '模型列表（勾选启用）';
            modelsLabel.style.fontSize = '13px';
            editArea.appendChild(modelsLabel);

            const modelsContainer = document.createElement('div');
            modelsContainer.className = 'fn__flex-column';
            modelsContainer.style.gap = '4px';
            modelsContainer.style.padding = '8px';
            modelsContainer.style.background = 'var(--b3-theme-surface-lighter)';
            modelsContainer.style.borderRadius = 'var(--b3-border-radius)';

            // 当前编辑的模型列表
            let currentModels = [...provider.models];

            const updateModelsList = () => {
              modelsContainer.innerHTML = '';
              currentModels.forEach((model, i) => {
                const row = document.createElement('div');
                row.className = 'fn__flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';

                // 可编辑的模型名称输入框
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'b3-text-field';
                nameInput.value = model;
                nameInput.style.flex = '1';
                nameInput.style.fontSize = '13px';
                nameInput.placeholder = (t('settings') as any).ai?.modelNamePlaceholder ?? '请输入模型名称';
                nameInput.addEventListener('change', () => {
                  const newName = nameInput.value.trim();
                  if (newName) {
                    currentModels[i] = newName;
                    updateDefaultModelSelect();
                  } else {
                    nameInput.value = currentModels[i];
                  }
                });

                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'b3-tooltips b3-tooltips__ne';
                deleteBtn.setAttribute('aria-label', (t('settings') as any).projectGroups?.deleteButton ?? '删除');
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
                  currentModels.splice(i, 1);
                  updateModelsList();
                  updateDefaultModelSelect();
                });

                // 启用开关
                const switchBtn = document.createElement('input');
                switchBtn.type = 'checkbox';
                switchBtn.className = 'b3-switch';
                switchBtn.checked = true;
                switchBtn.dataset.index = String(i);

                row.appendChild(nameInput);
                row.appendChild(deleteBtn);
                row.appendChild(switchBtn);
                modelsContainer.appendChild(row);
              });
            };

            // 更新默认模型下拉框
            const defaultModelSelect = document.createElement('select');
            defaultModelSelect.className = 'b3-select fn__flex-center';
            defaultModelSelect.style.flex = '1';

            const updateDefaultModelSelect = () => {
              const checkedIndices = Array.from(modelsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => parseInt((cb as HTMLInputElement).dataset.index!, 10))
                .filter(i => !isNaN(i) && currentModels[i]);
              const checkedModels = checkedIndices.map(i => currentModels[i]);

              const currentValue = defaultModelSelect.value;
              defaultModelSelect.innerHTML = '';
              checkedModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                defaultModelSelect.appendChild(option);
              });

              if (checkedModels.includes(currentValue)) {
                defaultModelSelect.value = currentValue;
              } else if (provider.defaultModel && checkedModels.includes(provider.defaultModel)) {
                defaultModelSelect.value = provider.defaultModel;
              } else if (checkedModels.length > 0) {
                defaultModelSelect.value = checkedModels[0];
              }
            };

            updateModelsList();
            updateDefaultModelSelect();
            modelsContainer.addEventListener('change', updateDefaultModelSelect);
            editArea.appendChild(modelsContainer);

            // 添加自定义模型按钮
            const addModelBtn = document.createElement('button');
            addModelBtn.className = 'b3-button b3-button--outline';
            addModelBtn.innerHTML = '<svg style="width:12px;height:12px;margin-right:4px"><use xlink:href="#iconAdd"></use></svg>' + ((t('settings') as any).ai?.addCustomModel ?? '添加自定义模型');
            addModelBtn.style.alignSelf = 'flex-start';
            addModelBtn.addEventListener('click', () => {
              currentModels.push('');
              updateModelsList();
              updateDefaultModelSelect();
              // 自动聚焦到新添加的输入框
              const inputs = modelsContainer.querySelectorAll('input[type="text"]');
              const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
              if (lastInput) {
                lastInput.focus();
              }
            });
            editArea.appendChild(addModelBtn);

            // 默认模型
            const defaultModelRow = document.createElement('div');
            defaultModelRow.className = 'fn__flex';
            defaultModelRow.style.alignItems = 'center';
            defaultModelRow.style.gap = '8px';
            defaultModelRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.defaultModelLabel ?? '默认模型'}</span>`;
            defaultModelRow.appendChild(defaultModelSelect);
            editArea.appendChild(defaultModelRow);

            // 保存和取消按钮
            const btnRow = document.createElement('div');
            btnRow.className = 'fn__flex';
            btnRow.style.gap = '8px';
            btnRow.style.justifyContent = 'flex-end';
            btnRow.style.marginTop = '8px';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'b3-button b3-button--cancel';
            cancelBtn.textContent = t('common').cancel;
            cancelBtn.addEventListener('click', () => {
              editingIndex = -1;
              renderProviderList();
            });

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'b3-button b3-button--primary';
            saveBtn.textContent = t('common').save;
            saveBtn.addEventListener('click', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              const name = nameInput.value.trim();
              if (!name) {
                showMessage((t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称', 3000, 'error');
                return;
              }

              // 过滤掉空名称的模型
              const validModels = currentModels.filter(m => m.trim() !== '');
              if (validModels.length === 0) {
                showMessage((t('settings') as any).ai?.messageAddOneModel ?? '请至少添加一个模型', 3000, 'error');
                return;
              }

              const checkedIndices = Array.from(modelsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => parseInt((cb as HTMLInputElement).dataset.index!, 10))
                .filter(i => !isNaN(i) && currentModels[i]?.trim() !== '');
              const checkedModels = checkedIndices.map(i => currentModels[i]);

              if (checkedModels.length === 0) {
                showMessage((t('settings') as any).ai?.messageSelectOneModel ?? '请至少选择一个模型', 3000, 'error');
                return;
              }

              // 更新供应商数据
              provider.name = name;
              provider.provider = typeSelect.value as any;
              provider.apiUrl = urlInput.value.trim();
              provider.apiKey = keyInput.value.trim();
              provider.models = validModels;
              provider.defaultModel = defaultModelSelect.value || checkedModels[0];

              editingIndex = -1;
              renderProviderList();
              showMessage((t('settings') as any).ai?.messageApplied ?? '已应用，点击下方「保存」写入配置', 3000);
            });

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(saveBtn);
            editArea.appendChild(btnRow);

            card.appendChild(editArea);

            // 供应商类型切换时自动填充预设数据
            typeSelect.addEventListener('change', () => {
              const type = typeSelect.value;
              if (type !== 'custom') {
                const preset = PROVIDER_PRESETS[type as keyof typeof PROVIDER_PRESETS];
                if (preset) {
                  urlInput.value = preset.defaultUrl;
                  currentModels = [...preset.models];
                  updateModelsList();
                  updateDefaultModelSelect();
                }
              }
            });
          }

          providerListContainer.appendChild(card);
        });

        // 新增供应商卡片（当 editingIndex 为 -2 时显示）
        if (editingIndex === -2) {
          const newCard = createNewProviderCard();
          providerListContainer.appendChild(newCard);
        }
      };

      // 创建新增供应商卡片
      const createNewProviderCard = () => {
        const card = document.createElement('div');
        card.className = 'fn__flex-column';
        card.style.background = 'var(--b3-theme-surface-lighter)';
        card.style.borderRadius = 'var(--b3-border-radius)';
        card.style.overflow = 'hidden';
        card.style.border = '2px dashed var(--b3-theme-primary)';

        const editArea = document.createElement('div');
        editArea.className = 'fn__flex-column';
        editArea.style.padding = '12px';
        editArea.style.gap = '12px';

        // 配置名称
        const nameRow = document.createElement('div');
        nameRow.className = 'fn__flex';
        nameRow.style.alignItems = 'center';
        nameRow.style.gap = '8px';
        nameRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.configName ?? '配置名称'}</span>`;
        const nameInput = document.createElement('input');
        nameInput.className = 'b3-text-field fn__flex-center';
        nameInput.style.flex = '1';
        nameInput.placeholder = (t('settings') as any).ai?.namePlaceholder ?? '如：Kimi-个人';
        nameRow.appendChild(nameInput);
        editArea.appendChild(nameRow);

        // 供应商类型
        const typeRow = document.createElement('div');
        typeRow.className = 'fn__flex';
        typeRow.style.alignItems = 'center';
        typeRow.style.gap = '8px';
        typeRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.selectProvider ?? '选择供应商'}</span>`;
        const typeSelect = document.createElement('select');
        typeSelect.className = 'b3-select fn__flex-center';
        typeSelect.style.flex = '1';
        Object.entries(PROVIDER_PRESETS).forEach(([key, preset]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = preset.name;
          typeSelect.appendChild(option);
        });
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = (t('settings') as any).ai?.customProvider ?? '自定义';
        typeSelect.appendChild(customOption);
        typeRow.appendChild(typeSelect);
        editArea.appendChild(typeRow);

        // API 地址
        const urlRow = document.createElement('div');
        urlRow.className = 'fn__flex';
        urlRow.style.alignItems = 'center';
        urlRow.style.gap = '8px';
        urlRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.apiUrlLabel ?? 'API 地址'}</span>`;
        const urlInput = document.createElement('input');
        urlInput.className = 'b3-text-field fn__flex-center';
        urlInput.style.flex = '1';
        urlInput.placeholder = (t('settings') as any).ai?.apiUrlPlaceholder ?? 'https://api.example.com/v1/chat/completions';
        urlRow.appendChild(urlInput);
        editArea.appendChild(urlRow);

        // API Key
        const keyRow = document.createElement('div');
        keyRow.className = 'fn__flex';
        keyRow.style.alignItems = 'center';
        keyRow.style.gap = '8px';
        keyRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.apiKeyLabel ?? 'API Key'}</span>`;
        const keyInput = document.createElement('input');
        keyInput.className = 'b3-text-field fn__flex-center';
        keyInput.style.flex = '1';
        keyInput.type = 'password';
        keyInput.placeholder = (t('settings') as any).ai?.apiKeyPlaceholder ?? '输入 API Key';
        keyRow.appendChild(keyInput);
        editArea.appendChild(keyRow);

        // 模型列表
        const modelsLabel = document.createElement('div');
        modelsLabel.textContent = (t('settings') as any).ai?.modelsLabel ?? '模型列表（勾选启用）';
        modelsLabel.style.fontSize = '13px';
        editArea.appendChild(modelsLabel);

        const modelsContainer = document.createElement('div');
        modelsContainer.className = 'fn__flex-column';
        modelsContainer.style.gap = '4px';
        modelsContainer.style.maxHeight = '200px';
        modelsContainer.style.overflowY = 'auto';
        modelsContainer.style.padding = '8px';
        modelsContainer.style.background = 'var(--b3-theme-surface-lighter)';
        modelsContainer.style.borderRadius = 'var(--b3-border-radius)';

        // 当前编辑的模型列表
        let currentModels: string[] = [];

        const updateModelsList = () => {
          modelsContainer.innerHTML = '';
          currentModels.forEach((model, i) => {
            const row = document.createElement('div');
            row.className = 'fn__flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';

            // 可编辑的模型名称输入框
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'b3-text-field';
            nameInput.value = model;
            nameInput.style.flex = '1';
            nameInput.style.fontSize = '13px';
            nameInput.placeholder = (t('settings') as any).ai?.modelNamePlaceholder ?? '请输入模型名称';
            nameInput.addEventListener('change', () => {
              const newName = nameInput.value.trim();
              if (newName) {
                currentModels[i] = newName;
                updateDefaultModelSelect();
              } else {
                nameInput.value = currentModels[i];
              }
            });

            // 删除按钮（与编辑部分统一样式）
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'b3-tooltips b3-tooltips__ne';
            deleteBtn.setAttribute('aria-label', (t('settings') as any).projectGroups?.deleteButton ?? '删除');
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
              currentModels.splice(i, 1);
              updateModelsList();
              updateDefaultModelSelect();
            });

            // 启用开关（与编辑部分统一样式）
            const switchBtn = document.createElement('input');
            switchBtn.type = 'checkbox';
            switchBtn.className = 'b3-switch';
            switchBtn.checked = true;
            switchBtn.dataset.index = String(i);

            row.appendChild(nameInput);
            row.appendChild(deleteBtn);
            row.appendChild(switchBtn);
            modelsContainer.appendChild(row);
          });
        };

        // 更新默认模型下拉框
        const defaultModelSelect = document.createElement('select');
        defaultModelSelect.className = 'b3-select fn__flex-center';
        defaultModelSelect.style.flex = '1';

        const updateDefaultModelSelect = () => {
          const checkedIndices = Array.from(modelsContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt((cb as HTMLInputElement).dataset.index!, 10))
            .filter(i => !isNaN(i) && currentModels[i]);
          const checkedModels = checkedIndices.map(i => currentModels[i]);

          const currentValue = defaultModelSelect.value;
          defaultModelSelect.innerHTML = '';
          checkedModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            defaultModelSelect.appendChild(option);
          });

          if (checkedModels.includes(currentValue)) {
            defaultModelSelect.value = currentValue;
          } else if (checkedModels.length > 0) {
            defaultModelSelect.value = checkedModels[0];
          }
        };

        // 供应商类型切换时自动填充预设数据
        typeSelect.addEventListener('change', () => {
          const type = typeSelect.value;
          if (type === 'custom') {
            urlInput.value = '';
            currentModels = [];
          } else {
            const preset = PROVIDER_PRESETS[type as keyof typeof PROVIDER_PRESETS];
            if (preset) {
              urlInput.value = preset.defaultUrl;
              currentModels = [...preset.models];
            }
          }
          updateModelsList();
          updateDefaultModelSelect();
        });
        // 触发一次以加载默认数据
        typeSelect.dispatchEvent(new Event('change'));

        editArea.appendChild(modelsContainer);

        // 添加自定义模型按钮
        const addModelBtn = document.createElement('button');
        addModelBtn.className = 'b3-button b3-button--outline';
        addModelBtn.innerHTML = '<svg style="width:12px;height:12px;margin-right:4px"><use xlink:href="#iconAdd"></use></svg>' + ((t('settings') as any).ai?.addCustomModel ?? '添加自定义模型');
        addModelBtn.style.alignSelf = 'flex-start';
        addModelBtn.addEventListener('click', () => {
          currentModels.push('');
          updateModelsList();
          updateDefaultModelSelect();
          // 自动聚焦到新添加的输入框
          const inputs = modelsContainer.querySelectorAll('input[type="text"]');
          const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
          if (lastInput) {
            lastInput.focus();
          }
        });
        editArea.appendChild(addModelBtn);
        modelsContainer.addEventListener('change', updateDefaultModelSelect);

        // 默认模型
        const defaultModelRow = document.createElement('div');
        defaultModelRow.className = 'fn__flex';
        defaultModelRow.style.alignItems = 'center';
        defaultModelRow.style.gap = '8px';
        defaultModelRow.innerHTML = `<span style="min-width:80px;font-size:13px">${(t('settings') as any).ai?.defaultModelLabel ?? '默认模型'}</span>`;
        defaultModelRow.appendChild(defaultModelSelect);
        editArea.appendChild(defaultModelRow);

        // 保存和取消按钮
        const btnRow = document.createElement('div');
        btnRow.className = 'fn__flex';
        btnRow.style.gap = '8px';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.marginTop = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'b3-button b3-button--cancel';
        cancelBtn.textContent = t('common').cancel;
        cancelBtn.addEventListener('click', () => {
          editingIndex = -1;
          renderProviderList();
        });

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'b3-button b3-button--primary';
        saveBtn.textContent = t('common').save;
        saveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const name = nameInput.value.trim();
          if (!name) {
            showMessage((t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称', 3000, 'error');
            return;
          }

          // 过滤掉空名称的模型
          const validModels = currentModels.filter(m => m.trim() !== '');
          if (validModels.length === 0) {
            showMessage((t('settings') as any).ai?.messageAddOneModel ?? '请至少添加一个模型', 3000, 'error');
            return;
          }

          const checkedIndices = Array.from(modelsContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => parseInt((cb as HTMLInputElement).dataset.index!, 10))
            .filter(i => !isNaN(i) && currentModels[i]?.trim() !== '');
          const checkedModels = checkedIndices.map(i => currentModels[i]);

          if (checkedModels.length === 0) {
            showMessage((t('settings') as any).ai?.messageSelectOneModel ?? '请至少选择一个模型', 3000, 'error');
            return;
          }

          const newProvider: AIProviderConfig = {
            id: `provider-${Date.now()}`,
            name: name,
            provider: typeSelect.value as any,
            apiUrl: urlInput.value.trim(),
            apiKey: keyInput.value.trim(),
            models: validModels,
            defaultModel: defaultModelSelect.value || checkedModels[0],
            enabled: true
          };

          settings.ai!.providers.push(newProvider);
          // 如果是第一个供应商，设为 active
          if (!settings.ai!.activeProviderId) {
            settings.ai!.activeProviderId = newProvider.id;
          }

          editingIndex = -1;
          renderProviderList();
          showMessage((t('settings') as any).ai?.messageAdded ?? '已添加，点击下方「保存」写入配置', 3000);
        });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        editArea.appendChild(btnRow);

        card.appendChild(editArea);
        return card;
      };

      container.appendChild(providerListContainer);

      // 添加供应商按钮
      const addBtn = document.createElement('button');
      addBtn.className = 'b3-button b3-button--outline';
      addBtn.innerHTML = '<svg style="width:14px;height:14px;margin-right:4px"><use xlink:href="#iconAdd"></use></svg>' + ((t('settings') as any).ai?.addProvider ?? '添加供应商');
      addBtn.addEventListener('click', () => {
        editingIndex = -2; // -2 表示新增
        renderProviderList();
      });
      container.appendChild(addBtn);

      // 初始渲染列表
      renderProviderList();

      return container;
    }
  });
}
