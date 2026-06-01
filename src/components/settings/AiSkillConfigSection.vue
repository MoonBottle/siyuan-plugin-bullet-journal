<template>
  <SySettingsSection
    :title="t('settings').aiSkills?.title ?? 'AI 技能配置'"
    :description="t('settings').aiSkills?.description ?? '管理 AI 技能，让 AI 能够执行特定任务'"
  >
    <template #header>
      <div class="sy-settings-section__header">
        <div class="sy-settings-section__header-left">
          <div class="sy-settings-section__title-row fn__flex">
            <SkillIcon class="sy-settings-section__icon" />
            <span class="sy-settings-section__title">{{ t('settings').aiSkills?.title ?? 'AI 技能配置' }}</span>
          </div>
          <div class="sy-settings-section__description">
            {{ t('settings').aiSkills?.description ?? '管理 AI 技能，让 AI 能够执行特定任务' }}
          </div>
        </div>
      </div>
    </template>

    <div class="skill-section">
      <div
        v-if="skills.length === 0"
        class="skill-templates"
      >
        <div class="skill-templates-hint">
          {{ t('settings').aiSkills?.emptySkills ?? '暂无技能，从模板快速创建或自定义添加' }}
        </div>
        <div class="template-list">
          <div
            v-for="tpl in skillTemplates"
            :key="tpl.name"
            class="template-item"
          >
            <div class="template-info">
              <span class="template-name">{{ tpl.name }}</span>
              <span class="template-desc">{{ tpl.description }}</span>
            </div>
            <SyButton
              icon="iconAdd"
              :text="t('settings').aiSkills?.addSkill ?? '添加'"
              :aria-label="t('settings').aiSkills?.addSkill ?? '添加'"
              @click="createFromTemplate(tpl)"
            />
          </div>
        </div>
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

    <SySettingsActionButton
      icon="iconAdd"
      :text="t('settings').aiSkills?.addSkill ?? '添加技能'"
      @click="showAddSkillDialog"
    />
  </SySettingsSection>

</template>

<script setup lang="ts">
import type { RegisteredSkill } from '@/skills'
import { showMessage } from 'siyuan'
import {
  createApp,
} from 'vue'
import SkillEditDialog from '@/components/dialog/SkillEditDialog.vue'
import SkillIcon from '@/components/icons/SkillIcon.vue'
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

const skills = skillStore.skills

const skillTemplates = [
  {
    name: 'daily-report',
    description: '生成每日工作日报，汇总当天完成的任务和番茄钟记录',
    content: `## 工作流程

1. **获取用户时间范围** — 调用 \`get_user_time\` 获取用户当前时区的日期
2. **查询当天任务** — 调用 \`filter_items\` 获取今天完成和进行中的任务
3. **查询番茄钟记录** — 调用 \`get_pomodoro_stats\` 获取今日番茄钟统计
4. **生成日报** — 按以下格式整理信息并输出

## 日报格式

\`\`\`markdown
# 📋 日报 - {日期}

## ✅ 今日完成
- {任务1}
- {任务2}

## 🔄 进行中
- {任务3}

## 🍅 番茄钟统计
- 今日完成 {n} 个番茄钟
- 累计专注 {n} 分钟

## 📝 明日计划
（根据进行中的任务和用户补充信息生成）
\`\`\`

## 注意事项
- 如果用户指定了日期范围，按范围查询
- 如果没有完成的任务，提示"今日暂无完成任务"
- 番茄钟数据为空时省略该部分
`,
  },
]

function createFromTemplate(tpl: typeof skillTemplates[0]) {
  skillStore.addSkill({
    name: tpl.name,
    description: tpl.description,
    content: tpl.content,
    autoEnable: true,
  }).then(() => {
    showMessage(`技能「${tpl.name}」已创建`, 2000, 'info')
  }).catch((err) => {
    showMessage(`创建失败: ${(err as Error).message}`, 3000, 'error')
  })
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

.skill-templates {
  margin-bottom: 16px;
}

.skill-templates-hint {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 12px 0;
  text-align: center;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.template-item {
  background: var(--b3-theme-surface-light);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px dashed var(--b3-theme-surface-lighter);
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.template-name {
  font-weight: 500;
  color: var(--b3-theme-on-background);
  font-size: 13px;
}

.template-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
