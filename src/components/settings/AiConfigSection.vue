<template>
  <SySettingsSection
    icon="iconSparkles"
    :title="(t('settings') as any).ai?.title ?? 'AI 服务配置'"
    :description="(t('settings') as any).ai?.description ?? '配置 AI 服务商，支持添加多个供应商配置'"
  >
    <div class="ai-provider-list">
      <template v-if="aiData.providers.length === 0 && !showNewForm">
        <div class="ai-provider-empty">
          {{ (t('settings') as any).ai?.emptyProviders ?? '暂无供应商配置，点击下方按钮添加' }}
        </div>
      </template>
      <AiProviderCard
        v-for="(provider, index) in aiData.providers"
        :key="provider.id"
        :provider="provider"
        @save="(data) => applyProviderEdit(index, data)"
        @delete="removeProvider(index)"
      />
      <AiProviderCard
        v-if="showNewForm && newProvider"
        :key="'new'"
        :provider="newProvider"
        is-new
        @save="addProvider"
        @delete="cancelAddProvider"
      />
    </div>
    <SySettingsActionButton
      v-if="!showNewForm"
      icon="iconAdd"
      :text="(t('settings') as any).ai?.addProvider ?? '添加供应商'"
      @click="startAddProvider"
    />
  </SySettingsSection>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AIProviderConfig } from '@/types/ai';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import AiProviderCard from './AiProviderCard.vue';

const props = defineProps<{
  ai: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
  };
}>();

const emit = defineEmits<{
  'update:ai': [value: { providers: AIProviderConfig[]; activeProviderId: string | null }];
}>();

const showNewForm = ref(false);
const newProvider = ref<AIProviderConfig | null>(null);

const aiData = computed(() => props.ai);

function cancelAddProvider() {
  showNewForm.value = false;
  newProvider.value = null;
}

function startAddProvider() {
  newProvider.value = {
    id: `provider-${Date.now()}`,
    name: '',
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o-mini',
    enabled: true
  };
  showNewForm.value = true;
}

function addProvider(data: Partial<AIProviderConfig>) {
  if (!newProvider.value) return;
  const provider: AIProviderConfig = {
    ...newProvider.value,
    ...data
  };
  const providers = [...props.ai.providers, provider];
  const activeProviderId = props.ai.activeProviderId || provider.id;
  emit('update:ai', { providers, activeProviderId });
  showNewForm.value = false;
  newProvider.value = null;
}

function applyProviderEdit(index: number, data: Partial<AIProviderConfig>) {
  const providers = [...props.ai.providers];
  providers[index] = { ...providers[index], ...data };
  emit('update:ai', { ...props.ai, providers });
}

function removeProvider(index: number) {
  const provider = props.ai.providers[index];
  const providers = props.ai.providers.filter((_, i) => i !== index);
  let activeProviderId = props.ai.activeProviderId;
  if (activeProviderId === provider.id) {
    activeProviderId = providers.find(p => p.enabled)?.id || null;
  }
  emit('update:ai', { providers, activeProviderId });
}
</script>

<style scoped>
.ai-provider-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-provider-empty {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 12px;
  text-align: center;
}
</style>
