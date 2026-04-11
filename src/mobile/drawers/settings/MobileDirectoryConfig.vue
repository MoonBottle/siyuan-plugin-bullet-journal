<template>
  <div class="ios-settings-content">
    <!-- Header -->
    <div class="ios-group-header">
      <div class="header-icon">📁</div>
      <div class="header-info">
        <div class="header-title">{{ t('settings').dirConfig.title }}</div>
        <div class="header-desc">{{ t('settings').dirConfig.description }}</div>
      </div>
    </div>

    <!-- Scan Mode Group -->
    <div class="ios-group">
      <div class="ios-cell-header">{{ t('settings').dirConfig.scanMode || '扫描模式' }}</div>
      <div class="ios-cell ios-cell-segment">
        <div class="segment-control segment-control-full">
          <button
            class="segment-btn"
            :class="{ active: scanMode === 'full' }"
            @click="emit('update:scanMode', 'full')"
          >
            {{ t('settings').dirConfig.scanModeFull || '全库扫描' }}
          </button>
          <button
            class="segment-btn"
            :class="{ active: scanMode === 'directories' }"
            @click="emit('update:scanMode', 'directories')"
          >
            {{ t('settings').dirConfig.scanModeDirectories || '指定目录' }}
          </button>
        </div>
      </div>
      <div class="cell-footer">
        {{ scanMode === 'full' 
          ? (t('settings').dirConfig.scanModeFullHint || '扫描整个工作空间中的所有文档')
          : (t('settings').dirConfig.scanModeDirectoriesHint || '仅扫描下方配置的目录及其子目录中的文档')
        }}
      </div>
      <div v-if="scanMode === 'full' && directories.length > 0" class="cell-footer hint">
        💡 {{ t('settings').dirConfig.fullScanDirectoriesHint || '以下目录配置仅用于分组归类' }}
      </div>
    </div>

    <!-- Directories Group -->
    <div class="ios-group">
      <div class="ios-cell-header">
        {{ t('settings').projectDirectories.title || '目录列表' }}
        <span class="header-count">({{ directories.length }})</span>
      </div>
      <div 
        v-for="(dir, index) in directories" 
        :key="dir.id"
        class="ios-cell ios-cell-directory"
        :class="{ 'is-disabled': scanMode === 'full' }"
      >
        <div class="directory-info">
          <input
            v-model="dir.path"
            type="text"
            class="ios-input"
            :placeholder="t('settings').projectDirectories.pathPlaceholder"
            :disabled="scanMode === 'full'"
          />
          <div class="directory-meta">
            <select 
              v-model="dir.groupId" 
              class="ios-select-small"
              :disabled="scanMode === 'full'"
            >
              <option :value="undefined">{{ t('settings').projectGroups.noGroup }}</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <div 
              class="ios-switch-small" 
              :class="{ on: dir.enabled }" 
              @click="toggleDirEnabled(index)"
            >
              <div class="switch-thumb"></div>
            </div>
          </div>
        </div>
        <button 
          class="delete-btn" 
          @click="removeDir(index)"
          :disabled="scanMode === 'full'"
        >
          <svg><use xlink:href="#iconTrashcan"></use></svg>
        </button>
      </div>
      <button 
        class="ios-add-btn" 
        @click="addDir"
        :disabled="scanMode === 'full'"
      >
        <span class="add-icon">+</span>
        {{ t('settings').projectDirectories.addButton }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectDirectory, ProjectGroup, ScanMode } from '@/types/models';
import { t } from '@/i18n';

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

const addDir = () => {
  const newDir: ProjectDirectory = {
    id: 'dir-' + Date.now(),
    path: '',
    enabled: true,
    groupId: props.defaultGroup || undefined
  };
  emit('update:directories', [...props.directories, newDir]);
};

const removeDir = (index: number) => {
  const next = props.directories.filter((_, i) => i !== index);
  emit('update:directories', next);
};

const toggleDirEnabled = (index: number) => {
  if (props.scanMode === 'full') return;
  const dir = props.directories[index];
  if (dir) {
    dir.enabled = !dir.enabled;
  }
};
</script>

<style lang="scss" scoped>
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
}

.ios-cell-segment {
  padding: 16px;
}

.segment-control {
  display: flex;
  gap: 8px;
  width: 100%;
  
  &.segment-control-full .segment-btn {
    flex: 1;
  }
}

.segment-btn {
  padding: 10px 16px;
  border: 1px solid #007aff;
  background: transparent;
  color: #007aff;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &.active {
    background: #007aff;
    color: #fff;
  }
  
  &:active {
    opacity: 0.8;
  }
}

.cell-footer {
  font-size: 13px;
  color: #6c6c70;
  padding: 8px 16px 12px;
  line-height: 1.4;
  
  &.hint {
    background: rgba(255, 204, 0, 0.1);
    border-radius: 8px;
    margin: 8px 16px;
    padding: 10px 12px;
  }
}

.ios-cell-directory {
  align-items: flex-start;
  padding: 12px 16px;
  gap: 12px;
  
  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .directory-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .ios-input {
    width: 100%;
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
  
  .directory-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .ios-select-small {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #e5e5ea;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
    color: #3c3c43;
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
    margin-top: 4px;
    
    svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }
    
    &:disabled {
      opacity: 0.3;
    }
  }
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
  
  &.on {
    background: #34c759;
    
    .switch-thumb {
      transform: translateX(16px);
    }
  }
  
  .switch-thumb {
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
  
  .add-icon {
    font-size: 20px;
    font-weight: 300;
  }
  
  &:active {
    background: #f2f2f7;
  }
  
  &:disabled {
    opacity: 0.3;
    pointer-events: none;
  }
}
</style>
