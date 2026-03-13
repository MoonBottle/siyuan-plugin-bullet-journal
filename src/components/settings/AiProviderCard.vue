<template>
  <div class="ai-provider-card" :class="{ 'is-editing': isEditing }">
    <div
      class="ai-provider-card__header fn__flex"
      @click="!isEditing && toggleEdit()"
    >
      <div class="ai-provider-card__info">
        <span class="ai-provider-card__name">{{ provider.name }}</span>
        <span class="ai-provider-card__model">{{ providerLabel }} · {{ provider.defaultModel }}</span>
      </div>
      <div class="ai-provider-card__actions fn__flex">
        <SyButton
          :icon="isEditing ? 'iconContract' : 'iconEdit'"
          :aria-label="isEditing ? ((t('settings') as any).ai?.collapse ?? '收起') : ((t('settings') as any).ai?.edit ?? '编辑')"
          @click.stop="toggleEdit()"
        />
        <SyButton
          icon="iconTrashcan"
          :aria-label="(t('settings') as any).projectGroups?.deleteButton ?? '删除'"
          @click.stop="handleDelete"
        />
        <SySwitch v-model="provider.enabled" />
      </div>
    </div>
    <AiProviderEditForm
      v-if="isEditing"
      :provider="provider"
      :is-new="isNew"
      @save="handleSave"
      @cancel="isEditing = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { PROVIDER_PRESETS } from '@/types/ai';
import type { AIProviderConfig } from '@/types/ai';
import { t } from '@/i18n';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import AiProviderEditForm from './AiProviderEditForm.vue';

const props = defineProps<{
  provider: AIProviderConfig;
  isNew?: boolean;
}>();

const emit = defineEmits<{
  save: [data: Partial<AIProviderConfig>];
  delete: [];
}>();

const isEditing = ref(props.isNew ?? false);

const providerLabel = computed(() => {
  const p = PROVIDER_PRESETS[props.provider.provider as keyof typeof PROVIDER_PRESETS];
  return p?.name || props.provider.provider;
});

function toggleEdit() {
  isEditing.value = !isEditing.value;
}

function handleSave(data: Partial<AIProviderConfig>) {
  isEditing.value = false;
  emit('save', data);
}

function handleDelete() {
  if (confirm(((t('settings') as any).ai?.confirmDeleteProvider ?? '确定要删除 "{{name}}" 吗？').replace('{{name}}', props.provider.name))) {
    emit('delete');
  }
}
</script>

<style scoped>
.ai-provider-card {
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  overflow: hidden;
}

.ai-provider-card.is-editing .ai-provider-card__header {
  cursor: default;
}

.ai-provider-card__header {
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.ai-provider-card__header:hover {
  background: var(--b3-theme-surface);
}

.ai-provider-card__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ai-provider-card__name {
  font-size: 13px;
  font-weight: 500;
}

.ai-provider-card__model {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.ai-provider-card__actions {
  align-items: center;
  gap: 4px;
}
</style>
