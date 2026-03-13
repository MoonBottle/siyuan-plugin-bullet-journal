<template>
  <div class="ai-provider-edit-form">
    <div class="form-row fn__flex">
      <span class="form-label">{{ (t('settings') as any).ai?.configName ?? '配置名称' }}</span>
      <input
        v-model="formData.name"
        type="text"
        class="b3-text-field fn__flex-center form-input"
        :placeholder="(t('settings') as any).ai?.namePlaceholder ?? '如：Kimi-个人'"
      />
    </div>
    <div class="form-row fn__flex">
      <span class="form-label">{{ (t('settings') as any).ai?.selectProvider ?? '选择供应商' }}</span>
      <SySelect
        v-model="formData.provider"
        :options="providerTypeOptions"
        class="form-input"
        @update:model-value="onProviderChange"
      />
    </div>
    <div class="form-row fn__flex">
      <span class="form-label">{{ (t('settings') as any).ai?.apiUrlLabel ?? 'API 地址' }}</span>
      <input
        v-model="formData.apiUrl"
        type="text"
        class="b3-text-field fn__flex-center form-input"
        :placeholder="(t('settings') as any).ai?.apiUrlPlaceholder ?? 'https://api.example.com/v1/chat/completions'"
      />
    </div>
    <div class="form-row fn__flex">
      <span class="form-label">{{ (t('settings') as any).ai?.apiKeyLabel ?? 'API Key' }}</span>
      <input
        v-model="formData.apiKey"
        type="password"
        class="b3-text-field fn__flex-center form-input"
        :placeholder="(t('settings') as any).ai?.apiKeyPlaceholder ?? '输入 API Key'"
      />
    </div>
    <div class="form-label-row">{{ (t('settings') as any).ai?.modelsLabel ?? '模型列表（勾选启用）' }}</div>
    <div class="models-list">
      <div v-for="(item, i) in formData.modelItems" :key="i" class="model-row fn__flex">
        <input
          v-model="item.name"
          type="text"
          class="b3-text-field form-input"
          :placeholder="(t('settings') as any).ai?.modelNamePlaceholder ?? '请输入模型名称'"
        />
        <SyButton icon="iconTrashcan" :aria-label="(t('settings') as any).projectGroups?.deleteButton ?? '删除'" @click="removeModel(i)" />
        <SySwitch v-model="item.enabled" />
      </div>
    </div>
    <button type="button" class="b3-button b3-button--outline" @click="addModel">
      <svg style="width:12px;height:12px;margin-right:4px"><use xlink:href="#iconAdd"></use></svg>
      {{ (t('settings') as any).ai?.addCustomModel ?? '添加自定义模型' }}
    </button>
    <div class="form-row fn__flex">
      <span class="form-label">{{ (t('settings') as any).ai?.defaultModelLabel ?? '默认模型' }}</span>
      <SySelect
        v-model="formData.defaultModel"
        :options="enabledModelsOptions"
        class="form-input"
      />
    </div>
    <div class="form-actions fn__flex">
      <button type="button" class="b3-button b3-button--cancel" @click="$emit('cancel')">
        {{ t('common').cancel }}
      </button>
      <button type="button" class="b3-button b3-button--primary" @click="handleSave">
        {{ t('common').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue';
import { showMessage } from 'siyuan';
import { PROVIDER_PRESETS, type AIProviderConfig, type AIProvider } from '@/types/ai';
import { t } from '@/i18n';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

const props = defineProps<{
  provider: AIProviderConfig;
  isNew?: boolean;
}>();

const emit = defineEmits<{
  save: [data: Partial<AIProviderConfig>];
  cancel: [];
}>();

const providerTypeOptions = Object.entries(PROVIDER_PRESETS).map(([value, preset]) => ({
  value,
  label: preset.name
})).concat([{ value: 'custom', label: (t('settings') as any).ai?.customProvider ?? '自定义' }]);

interface ModelItem { name: string; enabled: boolean }

const formData = reactive({
  name: props.provider.name,
  provider: props.provider.provider,
  apiUrl: props.provider.apiUrl,
  apiKey: props.provider.apiKey,
  modelItems: props.provider.models.map(m => ({ name: m, enabled: true })) as ModelItem[],
  defaultModel: props.provider.defaultModel
});

watch(() => props.provider, (p) => {
  formData.name = p.name;
  formData.provider = p.provider;
  formData.apiUrl = p.apiUrl;
  formData.apiKey = p.apiKey;
  formData.modelItems = p.models.map(m => ({ name: m, enabled: true }));
  formData.defaultModel = p.defaultModel;
}, { deep: true });

const enabledModelsOptions = computed(() => {
  return formData.modelItems
    .filter(item => item.name.trim() && item.enabled)
    .map(item => ({ value: item.name, label: item.name }));
});

function onProviderChange(val: string) {
  const type = val as AIProvider;
  if (type !== 'custom' && type in PROVIDER_PRESETS) {
    const preset = PROVIDER_PRESETS[type as keyof typeof PROVIDER_PRESETS];
    formData.apiUrl = preset.defaultUrl;
    formData.modelItems = preset.models.map(m => ({ name: m, enabled: true }));
    formData.defaultModel = preset.defaultModel;
  }
}

function addModel() {
  formData.modelItems.push({ name: '', enabled: true });
}

function removeModel(i: number) {
  formData.modelItems.splice(i, 1);
}

function handleSave() {
  const name = formData.name.trim();
  if (!name) {
    showMessage((t('settings') as any).ai?.messageEnterConfigName ?? '请输入配置名称', 3000, 'error');
    return;
  }
  const validModels = formData.modelItems.map(i => i.name.trim()).filter(Boolean);
  if (validModels.length === 0) {
    showMessage((t('settings') as any).ai?.messageAddOneModel ?? '请至少添加一个模型', 3000, 'error');
    return;
  }
  const checkedModels = formData.modelItems
    .filter(item => item.name.trim() && item.enabled)
    .map(item => item.name.trim());
  if (checkedModels.length === 0) {
    showMessage((t('settings') as any).ai?.messageSelectOneModel ?? '请至少选择一个模型', 3000, 'error');
    return;
  }
  emit('save', {
    name,
    provider: formData.provider as AIProvider,
    apiUrl: formData.apiUrl.trim(),
    apiKey: formData.apiKey.trim(),
    models: validModels,
    defaultModel: formData.defaultModel || checkedModels[0]
  });
  showMessage((t('settings') as any).ai?.messageApplied ?? '已应用，点击下方「保存」写入配置', 3000);
}
</script>

<style scoped>
.ai-provider-edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--b3-theme-background);
  border-top: 1px solid var(--b3-theme-surface);
}

.form-row {
  align-items: center;
  gap: 8px;
}

.form-label {
  min-width: 80px;
  font-size: 13px;
}

.form-input {
  flex: 1;
  min-width: 0;
}

.form-label-row {
  font-size: 13px;
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  max-height: 200px;
  overflow-y: auto;
}

.model-row {
  align-items: center;
  gap: 8px;
}

.form-actions {
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
