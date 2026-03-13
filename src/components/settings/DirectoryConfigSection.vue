<template>
  <SySettingsSection :title="t('settings').dirConfig.title" :description="t('settings').dirConfig.description">
    <div class="sy-directory-list">
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
        />
        <SySwitch v-model="dir.enabled" />
      </div>
    </div>
    <SySettingsActionButton icon="iconAdd" :text="'+ ' + t('settings').projectDirectories.addButton" @click="addDir" />
  </SySettingsSection>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectDirectory, ProjectGroup } from '@/types/models';
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
}>();

const emit = defineEmits<{
  'update:directories': [value: ProjectDirectory[]];
  'update:defaultGroup': [value: string];
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
</style>
