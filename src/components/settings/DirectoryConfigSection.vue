<template>
  <SySettingsSection icon="iconFolder" :title="t('settings').dirConfig.title" :description="t('settings').dirConfig.description">
    <!-- 扫描模式选择 -->
    <div class="sy-scan-mode">
      <div class="sy-scan-mode__title">{{ t('settings').dirConfig.scanMode || '扫描模式' }}</div>
      <div class="sy-scan-mode__options">
        <label class="sy-scan-mode__option" :class="{ 'is-active': scanMode === 'full' }">
          <input
            type="radio"
            :value="'full'"
            :checked="scanMode === 'full'"
            @change="emit('update:scanMode', 'full')"
          />
          <span class="sy-scan-mode__icon">🌐</span>
          <span class="sy-scan-mode__label">{{ t('settings').dirConfig.scanModeFull || '全库扫描' }}</span>
        </label>
        <label class="sy-scan-mode__option" :class="{ 'is-active': scanMode === 'directories' }">
          <input
            type="radio"
            :value="'directories'"
            :checked="scanMode === 'directories'"
            @change="emit('update:scanMode', 'directories')"
          />
          <span class="sy-scan-mode__icon">📁</span>
          <span class="sy-scan-mode__label">{{ t('settings').dirConfig.scanModeDirectories || '指定目录' }}</span>
        </label>
      </div>
      <div v-if="scanMode === 'full'" class="sy-scan-mode__hint">
        {{ t('settings').dirConfig.scanModeFullHint || '扫描整个工作空间中的所有文档' }}
      </div>
    </div>

    <!-- 目录配置说明 -->
    <div v-if="scanMode === 'full' && directories.length > 0" class="sy-directory-hint">
      <span class="sy-hint-icon">💡</span>
      <span>{{ t('settings').dirConfig.fullScanDirectoriesHint || '以下目录配置仅用于分组归类' }}</span>
    </div>

    <div class="sy-directory-list" :class="{ 'is-disabled': scanMode === 'full' }">
      <div
        v-for="(dir, index) in directories"
        :key="dir.id"
        class="sy-directory-item fn__flex"
      >
        <input
          v-model="dir.path"
          type="text"
          class="b3-text-field fn__flex-center sy-directory-item__path"
          :placeholder="t('settings').projectDirectories.pathPlaceholder"
          :disabled="scanMode === 'full'"
        />
        <SySelect
          :model-value="dir.groupId ?? ''"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.noGroup"
          class="sy-directory-item__group"
          @update:model-value="(v) => { dir.groupId = v || undefined; }"
        />
        <SyButton
          icon="iconTrashcan"
          :aria-label="t('settings').projectGroups.deleteButton"
          @click="removeDir(index)"
          :disabled="scanMode === 'full'"
        />
        <SySwitch v-model="dir.enabled" :disabled="scanMode === 'full'" />
      </div>
    </div>
    <SySettingsActionButton 
      icon="iconAdd" 
      :text="t('settings').projectDirectories.addButton" 
      @click="addDir" 
      :disabled="scanMode === 'full'"
    />
  </SySettingsSection>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectDirectory, ProjectGroup, ScanMode } from '@/types/models';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

const props = defineProps<{
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  scanMode: ScanMode;
}>();

const emit = defineEmits<{
  'update:directories': [value: ProjectDirectory[]];
  'update:scanMode': [value: ScanMode];
}>();

const groupOptions = computed(() => {
  const opts = [{ value: '', label: t('settings').projectGroups.noGroup }];
  props.groups.forEach(g => {
    opts.push({ value: g.id, label: g.name || t('settings').projectGroups.unnamed });
  });
  return opts;
});

function addDir() {
  const newDir: ProjectDirectory = {
    id: 'dir-' + Date.now(),
    path: '',
    enabled: true,
    groupId: props.defaultGroup || undefined
  };
  emit('update:directories', [...props.directories, newDir]);
}

function removeDir(index: number) {
  const next = props.directories.filter((_, i) => i !== index);
  emit('update:directories', next);
}
</script>

<style scoped>
.sy-directory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sy-directory-item {
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.sy-directory-item__path {
  flex: 1;
  min-width: 0;
}

.sy-directory-item__group {
  min-width: 100px;
}

.sy-scan-mode {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
}

.sy-scan-mode__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.sy-scan-mode__options {
  display: flex;
  gap: 16px;
}

.sy-scan-mode__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
}

.sy-scan-mode__option:hover {
  background: var(--b3-theme-surface-lighter);
}

.sy-scan-mode__option.is-active {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
}

.sy-scan-mode__option input[type="radio"] {
  margin: 0;
}

.sy-scan-mode__icon {
  font-size: 16px;
}

.sy-scan-mode__label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.sy-scan-mode__hint {
  margin-top: 10px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-surface-lighter);
  border-radius: 4px;
}

.sy-directory-hint {
  margin-bottom: 12px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-primary-lightest);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sy-hint-icon {
  font-size: 14px;
}

.sy-directory-list.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>
