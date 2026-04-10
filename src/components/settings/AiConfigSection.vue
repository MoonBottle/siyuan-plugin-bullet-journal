<template>
  <!-- Desktop Version -->
  <template v-if="!isMobile">
    <SySettingsSection
    icon="iconSparkles"
    :title="(t('settings') as any).ai?.title ?? 'AI 服务配置'"
    :description="(t('settings') as any).ai?.description ?? '配置 AI 服务商，支持添加多个供应商配置'"
  >
    <!-- 工具调用展示配置 -->
    <SySettingItemList>
      <SySettingItem
        :label="(t('settings') as any).ai?.showToolCalls ?? '显示工具调用详情'"
        :description="(t('settings') as any).ai?.showToolCallsDesc ?? '在对话中展示 AI 工具调用的详细信息和执行结果'"
      >
        <SySwitch
          :model-value="props.ai.showToolCalls !== false"
          @update:model-value="handleShowToolCallsChange"
        />
      </SySettingItem>
    </SySettingItemList>

    <!-- 供应商列表 -->
    <div class="ai-provider-list">
      <div v-if="aiData.providers.length === 0" class="ai-provider-empty">
        {{ (t('settings') as any).ai?.emptyProviders ?? '暂无供应商配置，点击下方按钮添加' }}
      </div>
      <div v-else class="custom-list">
        <div v-for="provider in aiData.providers" :key="provider.id" class="custom-item">
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">{{ provider.name }}</span>
              <span class="custom-item-model">{{ getProviderLabel(provider.provider) }} · {{ provider.defaultModel }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton
                icon="iconEdit"
                :aria-label="(t('settings') as any).ai?.edit ?? '编辑'"
                @click="editProvider(provider)"
              />
              <SyButton
                icon="iconTrashcan"
                :aria-label="(t('settings') as any).projectGroups?.deleteButton ?? '删除'"
                @click="removeProvider(provider.id)"
              />
              <SySwitch
                :model-value="provider.enabled"
                @update:model-value="(val) => toggleProviderEnabled(provider.id, val)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <SySettingsActionButton
      icon="iconAdd"
      :text="(t('settings') as any).ai?.addProvider ?? '添加供应商'"
      @click="showAddDialog"
    />
  </SySettingsSection>

  <!-- 添加/编辑对话框 -->
  <div v-if="dialogVisible" class="b3-dialog">
    <div class="b3-dialog__scrim" @click="closeDialog"></div>
    <div class="b3-dialog__container">
      <div class="b3-dialog__header">
        <div class="b3-dialog__title">{{ isEditing ? ((t('settings') as any).ai?.editProvider ?? '编辑供应商') : ((t('settings') as any).ai?.addProvider ?? '添加供应商') }}</div>
        <svg class="b3-dialog__close" @click="closeDialog"><use xlink:href="#iconCloseRound"></use></svg>
      </div>
      <div class="b3-dialog__content">
        <AiProviderEditForm
          ref="formRef"
          :provider="formProvider"
          :is-new="!isEditing"
          @save="handleFormSave"
        />
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="closeDialog">
          {{ t('common').cancel }}
        </button>
        <button class="b3-button b3-button--text form-save-btn" @click="saveProvider">
          {{ t('common').save }}
        </button>
      </div>
    </div>
  </div>
  </template>

  <!-- iOS Mobile Version -->
  <template v-else>
    <div class="ios-settings-content">
      <div class="ios-group-header">
        <div class="header-icon">🤖</div>
        <div class="header-info">
          <div class="header-title">{{ (t('settings') as any).ai?.title ?? 'AI 服务配置' }}</div>
          <div class="header-desc">{{ (t('settings') as any).ai?.description ?? '配置 AI 服务商，支持添加多个供应商配置' }}</div>
        </div>
      </div>

      <div class="ios-group">
        <div class="ios-cell" @click="handleShowToolCallsChange(!props.ai.showToolCalls !== false)">
          <div class="cell-content">
            <div class="cell-title">{{ (t('settings') as any).ai?.showToolCalls ?? '显示工具调用详情' }}</div>
            <div class="cell-subtitle">{{ (t('settings') as any).ai?.showToolCallsDesc ?? '在对话中展示 AI 工具调用的详细信息和执行结果' }}</div>
          </div>
          <div class="cell-accessory">
            <div class="ios-switch" :class="{ on: props.ai.showToolCalls !== false }" @click.stop>
              <div class="switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ios-group">
        <div class="ios-cell-header">
          {{ (t('settings') as any).ai?.providers ?? '供应商' }}
          <span class="header-count">({{ aiData.providers.length }})</span>
        </div>
        <div v-if="aiData.providers.length === 0" class="ios-empty">
          {{ (t('settings') as any).ai?.emptyProviders ?? '暂无供应商配置' }}
        </div>
        <div v-else class="ios-card">
          <div v-for="provider in aiData.providers" :key="provider.id" class="ios-cell ios-cell-provider">
            <div class="provider-icon">{{ provider.name.charAt(0) }}</div>
            <div class="provider-info">
              <div class="provider-name">{{ provider.name }}</div>
              <div class="provider-meta">{{ getProviderLabel(provider.provider) }} · {{ provider.defaultModel }}</div>
            </div>
            <div class="provider-actions">
              <div class="ios-switch-small" :class="{ on: provider.enabled }" @click="toggleProviderEnabled(provider.id, !provider.enabled)">
                <div class="switch-thumb"></div>
              </div>
              <button class="action-btn" @click="editProvider(provider)">
                <svg><use xlink:href="#iconEdit"></use></svg>
              </button>
              <button class="action-btn delete" @click="removeProvider(provider.id)">
                <svg><use xlink:href="#iconTrashcan"></use></svg>
              </button>
            </div>
          </div>
        </div>
        <button class="ios-add-btn" @click="showAddDialog">
          <span class="add-icon">+</span>
          {{ (t('settings') as any).ai?.addProvider ?? '添加供应商' }}
        </button>
      </div>

      <!-- Dialog -->
      <div v-if="dialogVisible" class="ios-dialog-overlay" @click="closeDialog">
        <div class="ios-dialog" @click.stop>
          <div class="dialog-header">
            <button class="cancel-btn" @click="closeDialog">{{ t('common').cancel }}</button>
            <span class="dialog-title">{{ isEditing ? ((t('settings') as any).ai?.editProvider ?? '编辑供应商') : ((t('settings') as any).ai?.addProvider ?? '添加供应商') }}</span>
            <button class="save-btn" @click="saveProvider">{{ t('common').save }}</button>
          </div>
          <div class="dialog-content">
            <AiProviderEditForm ref="formRef" :provider="formProvider" :is-new="!isEditing" @save="handleFormSave" />
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import type { AIProviderConfig, AIProvider } from '@/types/ai';
import { PROVIDER_PRESETS } from '@/types/ai';
import { t } from '@/i18n';
import { showMessage } from 'siyuan';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import AiProviderEditForm from './AiProviderEditForm.vue';

const props = defineProps<{
  isMobile?: boolean;
  ai: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
  };
}>();

const emit = defineEmits<{
  'update:ai': [value: { providers: AIProviderConfig[]; activeProviderId: string | null; showToolCalls?: boolean }];
}>();

const aiData = computed(() => props.ai);

// 对话框状态
const dialogVisible = ref(false);
const isEditing = ref(false);
const editingProviderId = ref<string | null>(null);
const formRef = ref<InstanceType<typeof AiProviderEditForm> | null>(null);

// 表单数据
const formProvider = reactive<AIProviderConfig>({
  id: '',
  name: '',
  provider: 'openai',
  apiUrl: '',
  apiKey: '',
  models: [],
  defaultModel: '',
  enabled: true
});

function getProviderLabel(provider: string): string {
  const p = PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS];
  return p?.name || provider;
}

function toggleProviderEnabled(providerId: string, enabled: boolean) {
  const providers = props.ai.providers.map(p =>
    p.id === providerId ? { ...p, enabled } : p
  );
  let activeProviderId = props.ai.activeProviderId;
  if (!enabled && activeProviderId === providerId) {
    activeProviderId = providers.find(p => p.enabled)?.id || null;
  }
  emit('update:ai', { ...props.ai, providers, activeProviderId });
}

function showAddDialog() {
  isEditing.value = false;
  editingProviderId.value = null;
  formProvider.id = `provider-${Date.now()}`;
  formProvider.name = '';
  formProvider.provider = 'openai';
  formProvider.apiUrl = 'https://api.openai.com/v1/chat/completions';
  formProvider.apiKey = '';
  formProvider.models = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  formProvider.defaultModel = 'gpt-4o-mini';
  formProvider.enabled = true;
  dialogVisible.value = true;
}

function editProvider(provider: AIProviderConfig) {
  isEditing.value = true;
  editingProviderId.value = provider.id;
  formProvider.id = provider.id;
  formProvider.name = provider.name;
  formProvider.provider = provider.provider;
  formProvider.apiUrl = provider.apiUrl;
  formProvider.apiKey = provider.apiKey;
  formProvider.models = [...provider.models];
  formProvider.defaultModel = provider.defaultModel;
  formProvider.enabled = provider.enabled;
  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
}

function handleFormSave(data: Partial<AIProviderConfig>) {
  // 表单内部验证通过后触发此方法
  const provider: AIProviderConfig = {
    ...formProvider,
    ...data
  };

  if (isEditing.value && editingProviderId.value) {
    const providers = props.ai.providers.map(p =>
      p.id === editingProviderId.value ? provider : p
    );
    emit('update:ai', { ...props.ai, providers });
  } else {
    const providers = [...props.ai.providers, provider];
    const activeProviderId = props.ai.activeProviderId || provider.id;
    emit('update:ai', { ...props.ai, providers, activeProviderId });
  }

  showMessage((t('settings') as any).ai?.messageApplied ?? '已应用，点击下方「保存」写入配置', 3000);
  closeDialog();
}

function saveProvider() {
  // 触发表单组件的保存方法进行验证
  formRef.value?.handleSave();
}

function removeProvider(id: string) {
  const provider = props.ai.providers.find(p => p.id === id);
  if (!provider) return;

  if (confirm(((t('settings') as any).ai?.confirmDeleteProvider ?? '确定要删除 "{{name}}" 吗？').replace('{{name}}', provider.name))) {
    const providers = props.ai.providers.filter(p => p.id !== id);
    let activeProviderId = props.ai.activeProviderId;
    if (activeProviderId === id) {
      activeProviderId = providers.find(p => p.enabled)?.id || null;
    }
    emit('update:ai', { ...props.ai, providers, activeProviderId });
  }
}

function handleShowToolCallsChange(checked: boolean) {
  emit('update:ai', { ...props.ai, showToolCalls: checked });
}
</script>

<style scoped>
.ai-provider-list {
  margin-top: 12px;
}

.ai-provider-empty {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 12px;
  text-align: center;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  margin-bottom: 16px;
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.custom-item {
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 12px;
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.custom-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.custom-item-name {
  font-weight: 500;
  color: var(--b3-theme-on-background);
  font-size: 13px;
}

.custom-item-model {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.custom-item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.b3-dialog {
  z-index: 100;
}

.b3-dialog__container {
  width: 520px;
}

.form-save-btn {
  margin-left: 3px;
}

/* iOS Mobile Styles */
.ios-settings-content {
  padding: 0 16px 32px;
}

.ios-group-header {
  display: flex;
  gap: 12px;
  padding: 16px 0 20px;
}

.ios-group-header .header-icon {
  font-size: 36px;
}

.ios-group-header .header-info {
  flex: 1;
}

.ios-group-header .header-title {
  font-size: 20px;
  font-weight: 600;
  color: #000;
  margin-bottom: 4px;
}

.ios-group-header .header-desc {
  font-size: 14px;
  color: #6c6c70;
  line-height: 1.4;
}

.ios-group {
  margin-bottom: 20px;
}

.ios-cell-header {
  font-size: 13px;
  font-weight: 500;
  color: #6c6c70;
  text-transform: uppercase;
  margin: 0 16px 8px;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ios-cell-header .header-count {
  font-weight: 400;
  color: #8e8e93;
}

.ios-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.ios-empty {
  padding: 32px 16px;
  text-align: center;
  color: #8e8e93;
  font-size: 15px;
}

.ios-cell {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  min-height: 44px;
}

.ios-cell:first-child {
  border-radius: 10px 10px 0 0;
}

.ios-cell:last-child {
  border-radius: 0 0 10px 10px;
}

.ios-cell:only-child {
  border-radius: 10px;
}

.ios-cell + .ios-cell {
  border-top: 0.5px solid #e5e5ea;
}

.ios-cell:active {
  background: #f2f2f7;
}

.ios-cell .cell-content {
  flex: 1;
  min-width: 0;
}

.ios-cell .cell-title {
  font-size: 16px;
  color: #000;
  line-height: 22px;
}

.ios-cell .cell-subtitle {
  font-size: 13px;
  color: #6c6c70;
  line-height: 18px;
  margin-top: 2px;
}

.ios-cell .cell-accessory {
  display: flex;
  align-items: center;
  margin-left: 12px;
  flex-shrink: 0;
}

.ios-switch {
  width: 51px;
  height: 31px;
  background: #e5e5ea;
  border-radius: 16px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.ios-switch.on {
  background: #34c759;
}

.ios-switch.on .switch-thumb {
  transform: translateX(20px);
}

.ios-switch .switch-thumb {
  width: 27px;
  height: 27px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ios-switch-small {
  width: 40px;
  height: 24px;
  background: #e5e5ea;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.ios-switch-small.on {
  background: #34c759;
}

.ios-switch-small.on .switch-thumb {
  transform: translateX(16px);
}

.ios-switch-small .switch-thumb {
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.ios-cell-provider {
  gap: 12px;
}

.ios-cell-provider .provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #5856d6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.ios-cell-provider .provider-info {
  flex: 1;
  min-width: 0;
}

.ios-cell-provider .provider-name {
  font-size: 16px;
  font-weight: 500;
  color: #000;
}

.ios-cell-provider .provider-meta {
  font-size: 13px;
  color: #6c6c70;
  margin-top: 2px;
}

.ios-cell-provider .provider-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ios-cell-provider .action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: #f2f2f7;
  cursor: pointer;
}

.ios-cell-provider .action-btn svg {
  width: 16px;
  height: 16px;
  fill: #007aff;
}

.ios-cell-provider .action-btn.delete {
  background: #ff3b30;
}

.ios-cell-provider .action-btn.delete svg {
  fill: #fff;
}

.ios-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1px dashed #c5c5c7;
  border-radius: 10px;
  background: transparent;
  color: #007aff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.ios-add-btn .add-icon {
  font-size: 20px;
  font-weight: 300;
}

.ios-add-btn:active {
  background: #f2f2f7;
}

.ios-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.ios-dialog {
  background: #f2f2f7;
  border-radius: 20px 20px 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.ios-dialog .dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 0.5px solid #e5e5ea;
  border-radius: 20px 20px 0 0;
}

.ios-dialog .dialog-header .cancel-btn,
.ios-dialog .dialog-header .save-btn {
  padding: 8px;
  border: none;
  background: transparent;
  font-size: 17px;
  cursor: pointer;
}

.ios-dialog .dialog-header .cancel-btn {
  color: #8e8e93;
}

.ios-dialog .dialog-header .save-btn {
  color: #007aff;
  font-weight: 500;
}

.ios-dialog .dialog-header .dialog-title {
  font-size: 17px;
  font-weight: 600;
}

.ios-dialog .dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
