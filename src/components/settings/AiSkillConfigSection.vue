<template>
  <SySettingsSection
    :svg-icon="skillSvgIcon"
    :title="t('settings').aiSkills?.title ?? 'AI 技能配置'"
    :description="t('settings').aiSkills?.description ?? '管理 AI 技能，让 AI 能够执行特定任务'"
  >
    <div class="skill-section">
      <div
        v-if="skills.length === 0"
        class="skill-empty"
      >
        {{ t('settings').aiSkills?.emptySkills ?? '暂无技能，从技能市场浏览模板，或自定义创建' }}
      </div>

      <div
        v-else
        class="custom-list"
      >
        <div
          v-for="skill in skills"
          :key="skill.name"
          class="custom-item"
        >
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">
                {{ skill.name }}
                <span
                  v-if="!skill.enabled"
                  class="disabled-badge"
                >
                  {{ t('common')?.disabled ?? '已禁用' }}
                </span>
              </span>
              <span class="custom-item-desc">{{ skill.description }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton
                icon="iconEdit"
                :text="t('settings').aiSkills?.editSkill ?? '编辑'"
                :aria-label="t('settings').aiSkills?.editSkill ?? '编辑'"
                @click="editSkill(skill)"
              />
              <SyButton
                icon="iconTrashcan"
                :aria-label="t('settings').aiSkills?.delete ?? '删除'"
                @click="removeSkill(skill)"
              />
              <SySwitch
                :model-value="skill.enabled"
                @update:model-value="toggleSkillEnabled(skill.name, $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="skill-actions">
      <SySettingsActionButton
        icon="iconAdd"
        :text="t('settings').aiSkills?.addSkill ?? '添加技能'"
        :title="t('settings').aiSkills?.addSkillDescription ?? '自定义创建新技能'"
        @click="showAddSkillDialog"
      />
      <SySettingsActionButton
        icon="iconSparkles"
        :text="t('settings').aiSkills?.marketTitle ?? '技能市场'"
        :title="t('settings').aiSkills?.marketDescription ?? '浏览模板，快速创建技能'"
        @click="openMarketDialog"
      />
    </div>
  </SySettingsSection>

</template>

<script setup lang="ts">
import type { RegisteredSkill } from '@/skills'
import { showMessage } from 'siyuan'
import {
  computed,
  createApp,
} from 'vue'
import SkillEditDialog from '@/components/dialog/SkillEditDialog.vue'
import SkillMarketDialog from '@/components/dialog/SkillMarketDialog.vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import { t } from '@/i18n'
import { useSkillStore } from '@/stores/skillStore'

import {
  createDialog,
  showConfirmDialog,
} from '@/utils/dialog'
import { getSharedPinia } from '@/utils/sharedPinia'
import SySettingsActionButton from './SySettingsActionButton.vue'
import SySettingsSection from './SySettingsSection.vue'

const _props = defineProps<{
  dialog?: { destroy: () => void }
}>()

const _emit = defineEmits<{
  (e: 'close'): void
}>()

const skillStore = useSkillStore()

const skillSvgIcon = '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M758.208 42.688H254.016C184.448 42.688 128 99.008 128 168.64v671.808c0 69.568 56.448 125.952 126.08 125.952h504.128c69.568 0 126.016-56.384 126.016-125.952V168.64a126.016 126.016 0 0 0-126.08-125.952zM254.016 126.656h504.192c23.168 0 41.984 18.752 41.984 41.984v671.808a41.984 41.984 0 0 1-41.984 41.984H254.016a41.984 41.984 0 0 1-41.984-41.984V168.64c0-23.232 18.816-41.984 41.984-41.984z m425.024 231.296a41.984 41.984 0 0 0-4.864-83.712H338.048l-4.864 0.256a41.984 41.984 0 0 0 4.864 83.712h336.128l4.864-0.256z m0 167.936a41.984 41.984 0 0 0-4.864-83.712H338.048l-4.864 0.256a41.984 41.984 0 0 0 4.864 83.712h336.128l4.864-0.256zM476.16 652.096a41.984 41.984 0 0 1-37.12 41.728l-4.864 0.256h-96a41.984 41.984 0 0 1-4.928-83.648l4.864-0.32h96c23.232 0 42.048 18.816 42.048 41.984z" fill="currentColor"/></svg>'

const skills = computed(() => skillStore.skills)

function openMarketDialog() {
  const container = document.createElement('div')

  let app: ReturnType<typeof createApp>

  const dialog = createDialog({
    title: t('settings').aiSkills?.marketTitle ?? '技能市场',
    content: '',
    width: '600px',
    destroyCallback: () => {
      app.unmount()
    },
  })

  app = createApp(SkillMarketDialog, {
    onClose: () => {
      dialog.destroy()
    },
    onCreated: () => {
      dialog.destroy()
    },
  })

  app.use(getSharedPinia())
  app.mount(container)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body')
  if (bodyEl) {
    bodyEl.appendChild(container)
  }
}

function openSkillEditDialog(skillName: string, mode: 'create' | 'edit' | 'view') {
  const container = document.createElement('div')

  let app: ReturnType<typeof createApp>

  const titleMap = {
    create: t('settings').aiSkills?.addSkill ?? '添加技能',
    edit: t('settings').aiSkills?.editSkill ?? '编辑技能',
    view: skillName,
  }

  const dialog = createDialog({
    title: titleMap[mode],
    content: '',
    width: '800px',
    destroyCallback: () => {
      app.unmount()
    },
  })

  app = createApp(SkillEditDialog, {
    skillName,
    mode,
    onClose: () => {
      dialog.destroy()
    },
    onSaved: () => {
      dialog.destroy()
    },
  })

  app.use(getSharedPinia())
  app.mount(container)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body')
  if (bodyEl) {
    bodyEl.appendChild(container)
  }
}

function showAddSkillDialog() {
  openSkillEditDialog('', 'create')
}

function editSkill(skill: RegisteredSkill) {
  openSkillEditDialog(skill.name, 'edit')
}

function removeSkill(skill: RegisteredSkill) {
  showConfirmDialog(
    t('common').confirmDelete,
    (t('settings').aiSkills?.confirmDeleteSkill ?? '确定要删除技能「{name}」吗？')
      .replace('{name}', skill.name),
    () => {
      skillStore.removeSkill(skill.name)
      showMessage('技能已删除', 2000, 'info')
    },
  )
}

function toggleSkillEnabled(name: string, enabled: boolean) {
  skillStore.toggleSkillEnabled(name, enabled)
}

</script>

<style scoped>
.skill-section {
  margin-bottom: 20px;
}

.skill-empty {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 12px 0;
  text-align: center;
}

.skill-actions {
  display: flex;
  gap: 8px;
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
  border: 1px solid transparent;
  transition: all 0.2s;
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.custom-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.custom-item-name {
  font-weight: 500;
  color: var(--b3-theme-on-background);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-item-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.disabled-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-light);
}
</style>
