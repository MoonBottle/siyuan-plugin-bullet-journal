<template>
  <!-- Desktop Version -->
  <template v-if="!isMobile">
    <SySettingsSection icon="iconGroups" :title="t('settings').groupManage.title" :description="t('settings').groupManage.description">
      <SySettingItemList>
        <SySettingItem
          :label="t('settings').projectGroups.defaultGroupTitle"
          :description="t('settings').projectGroups.defaultGroupDesc"
        >
          <SySelect
            :model-value="defaultGroup"
            :options="groupSelectOptions"
            :placeholder="t('settings').projectGroups.noGroup"
            class="sy-group-default-select"
            @update:model-value="$emit('update:defaultGroup', $event)"
          />
        </SySettingItem>
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
              :ariaLabel="t('settings').projectGroups.deleteButton"
              @click="removeGroup(index)"
            />
          </div>
        </div>
      </SySettingItemList>
      <SySettingsActionButton icon="iconAdd" :text="t('settings').projectGroups.addButton" @click="addGroup" />
    </SySettingsSection>
  </template>

  <!-- iOS Mobile Version -->
  <template v-else>
    <div class="ios-settings-content">
      <!-- Header -->
      <div class="ios-group-header">
        <div class="header-icon">📊</div>
        <div class="header-info">
          <div class="header-title">{{ t('settings').groupManage.title }}</div>
          <div class="header-desc">{{ t('settings').groupManage.description }}</div>
        </div>
      </div>

      <!-- Default Group -->
      <div class="ios-group">
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">{{ t('settings').projectGroups.defaultGroupTitle }}</div>
            <div class="cell-subtitle">{{ t('settings').projectGroups.defaultGroupDesc }}</div>
          </div>
          <div class="cell-accessory">
            <select 
              :value="defaultGroup" 
              class="ios-select"
              @change="$emit('update:defaultGroup', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ t('settings').projectGroups.noGroup }}</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name || t('settings').projectGroups.unnamed }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Groups List -->
      <div class="ios-group">
        <div class="ios-cell-header">
          {{ t('settings').projectGroups.title || '分组列表' }}
          <span class="header-count">({{ groups.length }})</span>
        </div>
        <div 
          v-for="(group, index) in groups" 
          :key="group.id"
          class="ios-cell ios-cell-group"
        >
          <div class="group-icon" :style="{ background: getGroupColor(index) }">
            {{ group.name?.charAt(0) || '?' }}
          </div>
          <input
            v-model="group.name"
            type="text"
            class="ios-input"
            :placeholder="t('settings').projectGroups.namePlaceholder"
          />
          <button class="delete-btn" @click="removeGroup(index)">
            <svg><use xlink:href="#iconTrashcan"></use></svg>
          </button>
        </div>
        <button class="ios-add-btn" @click="addGroup">
          <span class="add-icon">+</span>
          {{ t('settings').projectGroups.addButton }}
        </button>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProjectGroup, ProjectDirectory } from '@/types/models';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';

const props = defineProps<{
  groups: ProjectGroup[];
  defaultGroup: string;
  directories: ProjectDirectory[];
  isMobile?: boolean;
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

const groupColors = [
  '#007aff', '#34c759', '#ff9500', '#ff3b30', 
  '#5856d6', '#af52de', '#ff2d55', '#5ac8fa'
];

function getGroupColor(index: number): string {
  return groupColors[index % groupColors.length];
}

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

<style lang="scss" scoped>
// Desktop styles
.sy-group-default-select {
  min-width: 78px;
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

// iOS Mobile Styles
.ios-settings-content {
  padding: 0 16px 32px;
}

.ios-group-header {
  display: flex;
  gap: 12px;
  padding: 16px 0 20px;
  
  .header-icon {
    font-size: 36px;
  }
  
  .header-info {
    flex: 1;
  }
  
  .header-title {
    font-size: 20px;
    font-weight: 600;
    color: #000;
    margin-bottom: 4px;
  }
  
  .header-desc {
    font-size: 14px;
    color: #6c6c70;
    line-height: 1.4;
  }
}

.ios-group {
  margin-bottom: 20px;
  
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
    
    .header-count {
      font-weight: 400;
      color: #8e8e93;
    }
  }
}

.ios-cell {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  min-height: 44px;
  
  &:first-child {
    border-radius: 10px 10px 0 0;
  }
  
  &:last-child {
    border-radius: 0 0 10px 10px;
  }
  
  &:only-child {
    border-radius: 10px;
  }
  
  & + .ios-cell {
    border-top: 0.5px solid #e5e5ea;
  }
  
  &:active {
    background: #f2f2f7;
  }
  
  .cell-content {
    flex: 1;
    min-width: 0;
  }
  
  .cell-title {
    font-size: 16px;
    color: #000;
    line-height: 22px;
  }
  
  .cell-subtitle {
    font-size: 13px;
    color: #6c6c70;
    line-height: 18px;
    margin-top: 2px;
  }
  
  .cell-accessory {
    display: flex;
    align-items: center;
    margin-left: 12px;
    flex-shrink: 0;
  }
}

.ios-cell-select {
  border-radius: 10px !important;
  
  .cell-content {
    padding-right: 8px;
  }
}

// iOS Select
.ios-select {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 16px;
  color: #6c6c70;
  padding-right: 20px;
  text-align: right;
  direction: rtl;
  cursor: pointer;
  
  &:focus {
    outline: none;
  }
}

// Group Item
.ios-cell-group {
  gap: 12px;
  
  .group-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }
  
  .ios-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    font-size: 15px;
    background: #fafafa;
    
    &:focus {
      outline: none;
      border-color: #007aff;
    }
    
    &::placeholder {
      color: #c5c5c7;
    }
  }
  
  .delete-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: #ff3b30;
    border-radius: 8px;
    cursor: pointer;
    flex-shrink: 0;
    
    svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }
  }
}

// Add Button
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
  
  .add-icon {
    font-size: 20px;
    font-weight: 300;
  }
  
  &:active {
    background: #f2f2f7;
  }
}
</style>
