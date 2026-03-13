<template>
  <SySettingsSection icon="iconGroups" :title="t('settings').groupManage.title" :description="t('settings').groupManage.description">
    <div class="sy-group-top fn__flex" style="align-items: center; gap: 8px; margin-bottom: 8px;">
      <span class="sy-group-default-label">{{ t('settings').groupManage.defaultLabel }}</span>
      <SySelect
        :model-value="defaultGroup"
        :options="groupSelectOptions"
        :placeholder="t('settings').projectGroups.noGroup"
        class="sy-group-default-select"
        @update:model-value="$emit('update:defaultGroup', $event)"
      />
    </div>
    <div class="sy-group-list">
      <div
        v-for="(group, index) in groups"
        :key="group.id"
        class="sy-group-item fn__flex"
      >
        <input
          v-model="group.name"
          type="text"
          class="b3-text-field fn__flex-center sy-group-item__name"
          :placeholder="t('settings').projectGroups.namePlaceholder"
        />
        <SyButton
          icon="iconTrashcan"
          :aria-label="t('settings').projectGroups.deleteButton"
          @click="removeGroup(index)"
        />
      </div>
    </div>
    <SySettingsActionButton icon="iconAdd" :text="'+ ' + t('settings').projectGroups.addButton" @click="addGroup" />
  </SySettingsSection>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectGroup, ProjectDirectory } from '@/types/models';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';

const props = defineProps<{
  groups: ProjectGroup[];
  defaultGroup: string;
  directories: ProjectDirectory[];
}>();

const emit = defineEmits<{
  'update:groups': [value: ProjectGroup[]];
  'update:defaultGroup': [value: string];
  'update:directories': [value: ProjectDirectory[]];
}>();

const groupSelectOptions = computed(() => {
  const opts = [{ value: '', label: t('settings').projectGroups.noGroup }];
  props.groups.forEach(g => {
    opts.push({ value: g.id, label: g.name || t('settings').projectGroups.unnamed });
  });
  return opts;
});

function addGroup() {
  const newGroup: ProjectGroup = {
    id: 'group-' + Date.now(),
    name: ''
  };
  emit('update:groups', [...props.groups, newGroup]);
}

function removeGroup(index: number) {
  const deletedId = props.groups[index].id;
  const nextGroups = props.groups.filter((_, i) => i !== index);
  emit('update:groups', nextGroups);
  if (props.defaultGroup === deletedId) {
    emit('update:defaultGroup', '');
  }
  const nextDirs = props.directories.map(d => ({
    ...d,
    groupId: d.groupId === deletedId ? undefined : d.groupId
  }));
  emit('update:directories', nextDirs);
}
</script>

<style scoped>
.sy-group-default-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.sy-group-default-select {
  min-width: 100px;
}

.sy-group-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sy-group-item {
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.sy-group-item__name {
  flex: 1;
  min-width: 0;
}
</style>
