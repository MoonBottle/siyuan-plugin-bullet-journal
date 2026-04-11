<template>
  <div class="ios-settings-content">
    <div class="ios-group-header">
      <div class="header-icon">🤖</div>
      <div class="header-info">
        <div class="header-title">{{ (t('settings') as any).ai?.title ?? 'AI 服务配置' }}</div>
        <div class="header-desc">{{ (t('settings') as any).ai?.description ?? '配置 AI 服务商，支持添加多个供应商配置' }}</div>
      </div>
    </div>

    <div class="ios-group">
      <div class="ios-cell" @click="toggleShowToolCalls">
        <div class="cell-content">
          <div class="cell-title">{{ (t('settings') as any).ai?.showToolCalls ?? '显示工具调用详情' }}</div>
          <div class="cell-subtitle">{{ (t('settings') as any).ai?.showToolCallsDesc ?? '在对话中展示 AI 工具调用的详细信息和执行结果' }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: ai.showToolCalls !== false }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="ios-group">
      <div class="ios-cell-header">
        {{ (t('settings') as any).ai?.providers ?? '供应商' }}
        <span class="header-count">({{ ai.providers.length }})</span>
      </div>
      <div v-if="ai.providers.length === 0" class="ios-empty">
        {{ (t('settings') as any).ai?.emptyProviders ?? '暂无供应商配置' }}
      </div>
      <div v-else class="ios-card">
        <div v-for="provider in ai.providers" :key="provider.id" class="ios-cell ios-cell-provider">
          <div class="provider-icon">{{ provider.name.charAt(0) }}</div>
          <div class="provider-info">
            <div class="provider-name">{{ provider.name }}</div>
            <div class="provider-meta">{{ getProviderLabel(provider.provider) }} · {{ provider.defaultModel }}</div>
          </div>
          <div class="provider-actions">
            <div class="ios-switch-small" :class="{ on: provider.enabled }" @click="toggleProvider(provider)">
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
  </div>
</template>

<script setup lang="ts">
import type { AIProviderConfig } from '@/types/ai';
import { PROVIDER_PRESETS } from '@/types/ai';
import { t } from '@/i18n';

defineProps<{
  ai: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
  };
}>();

const emit = defineEmits<{
  'update:ai': [value: { providers: AIProviderConfig[]; activeProviderId: string | null; showToolCalls?: boolean }];
}>();

function getProviderLabel(provider: string): string {
  const p = PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS];
  return p?.name || provider;
}

const toggleShowToolCalls = () => {
  // Implementation needed
};

const toggleProvider = (provider: AIProviderConfig) => {
  // Implementation needed
};

const editProvider = (provider: AIProviderConfig) => {
  // Implementation needed
};

const removeProvider = (id: string) => {
  // Implementation needed
};

const showAddDialog = () => {
  // Implementation needed
};
</script>

<style lang="scss" scoped>
.ios-settings-content { padding: 0 16px 32px; }
.ios-group-header {
  display: flex; gap: 12px; padding: 16px 0 20px;
  .header-icon { font-size: 36px; }
  .header-info { flex: 1; }
  .header-title { font-size: 20px; font-weight: 600; color: #000; margin-bottom: 4px; }
  .header-desc { font-size: 14px; color: #6c6c70; line-height: 1.4; }
}
.ios-group { margin-bottom: 20px; }
.ios-cell-header {
  font-size: 13px; font-weight: 500; color: #6c6c70; text-transform: uppercase;
  margin: 0 16px 8px; letter-spacing: 0.3px; display: flex; align-items: center; gap: 4px;
  .header-count { font-weight: 400; color: #8e8e93; }
}
.ios-card { background: #fff; border-radius: 12px; overflow: hidden; }
.ios-empty { padding: 32px 16px; text-align: center; color: #8e8e93; font-size: 15px; }
.ios-cell {
  display: flex; align-items: center; padding: 12px 16px; background: #fff; min-height: 44px;
  & + .ios-cell { border-top: 0.5px solid #e5e5ea; }
  &:active { background: #f2f2f7; }
  .cell-content { flex: 1; min-width: 0; }
  .cell-title { font-size: 16px; color: #000; line-height: 22px; }
  .cell-subtitle { font-size: 13px; color: #6c6c70; line-height: 18px; margin-top: 2px; }
  .cell-accessory { display: flex; align-items: center; margin-left: 12px; flex-shrink: 0; }
}
.ios-switch {
  width: 51px; height: 31px; background: #e5e5ea; border-radius: 16px; position: relative; cursor: pointer; transition: background 0.2s;
  &.on { background: #34c759; .switch-thumb { transform: translateX(20px); } }
  .switch-thumb { width: 27px; height: 27px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
}
.ios-cell-provider {
  gap: 12px;
  .provider-icon { width: 36px; height: 36px; border-radius: 8px; background: #5856d6; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 600; flex-shrink: 0; }
  .provider-info { flex: 1; min-width: 0; }
  .provider-name { font-size: 16px; font-weight: 500; color: #000; }
  .provider-meta { font-size: 13px; color: #6c6c70; margin-top: 2px; }
  .provider-actions { display: flex; gap: 8px; align-items: center; }
  .ios-switch-small { width: 40px; height: 24px; background: #e5e5ea; border-radius: 12px; position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0;
    &.on { background: #34c759; .switch-thumb { transform: translateX(16px); } }
    .switch-thumb { width: 20px; height: 20px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
  }
  .action-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: #f2f2f7; cursor: pointer;
    svg { width: 16px; height: 16px; fill: #007aff; }
    &.delete { background: #ff3b30; svg { fill: #fff; } }
  }
}
.ios-add-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px; margin-top: 8px;
  border: 1px dashed #c5c5c7; border-radius: 10px; background: transparent; color: #007aff; font-size: 15px; font-weight: 500; cursor: pointer;
  &:active { background: #f2f2f7; }
  .add-icon { font-size: 20px; font-weight: 300; }
}
</style>
