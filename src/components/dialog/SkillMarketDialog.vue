<template>
  <div class="skill-market-dialog">
    <div class="market-search">
      <SyInput
        v-model="searchQuery"
        :placeholder="t('settings').aiSkills?.searchPlaceholder ?? '搜索模板...'"
      />
    </div>

    <div
      v-if="filteredCatalog.length === 0"
      class="market-empty"
    >
      {{ t('settings').aiSkills?.emptyMarket ?? '暂无可用模板' }}
    </div>

    <div
      v-else
      class="market-list"
    >
      <div
        v-for="skill in filteredCatalog"
        :key="skill.name"
        class="market-card"
      >
        <div class="market-card-header">
          <span class="market-card-name">{{ skill.name }}</span>
          <div class="market-card-tags">
            <span
              v-for="tag in skill.tags"
              :key="tag"
              class="market-card-tag"
            >{{ tag }}</span>
          </div>
        </div>
        <div class="market-card-desc">
          {{ skill.description }}
        </div>
        <div class="market-card-footer">
          <span class="market-card-author">{{ skill.author }}</span>
          <button
            class="use-template-btn"
            :aria-label="t('settings').aiSkills?.useTemplate ?? '使用模板'"
            @click="openCreateFromTemplate(skill)"
          >
            <svg class="use-template-btn__icon"><use xlink:href="#iconDownload"></use></svg>
            <span>{{ t('settings').aiSkills?.useTemplate ?? '使用模板' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="creatingFrom"
      class="b3-dialog"
    >
      <div
        class="b3-dialog__scrim"
        @click="creatingFrom = null"
      ></div>
      <div class="b3-dialog__container create-from-template-dialog">
        <div class="b3-dialog__header">
          <div class="b3-dialog__title">
            {{ t('settings').aiSkills?.createFromTemplate ?? '从模板创建技能' }}
          </div>
          <svg
            class="b3-dialog__close"
            @click="creatingFrom = null"
          ><use xlink:href="#iconCloseRound"></use></svg>
        </div>
        <div class="b3-dialog__content">
          <div class="create-form">
            <div class="create-form-item">
              <label class="create-form-label">{{ t('settings').aiSkills?.templateName ?? '技能名称' }}</label>
              <SyInput
                v-model="createForm.name"
                :placeholder="t('settings').aiSkills?.templateNamePlaceholder ?? '输入技能名称'"
                @blur="validateName"
              />
              <span
                v-if="createErrors.name"
                class="create-form-error"
              >{{ createErrors.name }}</span>
            </div>
            <div class="create-form-item">
              <label class="create-form-label">{{ t('settings').aiSkills?.templateDesc ?? '技能描述' }}</label>
              <SyInput
                v-model="createForm.description"
                :placeholder="t('settings').aiSkills?.templateDescPlaceholder ?? '输入技能描述'"
              />
            </div>
          </div>
        </div>
        <div class="b3-dialog__action">
          <button
            class="b3-button b3-button--cancel"
            @click="creatingFrom = null"
          >
            {{ t('common').cancel }}
          </button>
          <button
            class="b3-button b3-button--text"
            :disabled="!isCreateValid || isCreating"
            @click="handleCreateFromTemplate"
          >
            {{ isCreating ? (t('common').saving ?? '创建中...') : (t('settings').aiSkills?.createBtn ?? '创建') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MarketSkill } from '@/services/marketService'
import { showMessage } from 'siyuan'
import {
  computed,
  reactive,
  ref,
} from 'vue'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import { t } from '@/i18n'
import { MarketService } from '@/services/marketService'
import { useSkillStore } from '@/stores/skillStore'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const skillStore = useSkillStore()
const marketService = MarketService.getInstance()

const searchQuery = ref('')
const creatingFrom = ref<MarketSkill | null>(null)
const isCreating = ref(false)

const catalog = computed(() => marketService.getCatalog())

const filteredCatalog = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return catalog.value
  return catalog.value.filter((s) => {
    return s.name.toLowerCase().includes(q)
      || s.description.toLowerCase().includes(q)
      || s.tags.some((tag) => tag.toLowerCase().includes(q))
  })
})

const createForm = reactive({
  name: '',
  description: '',
})

const createErrors = reactive({
  name: '',
})

const isCreateValid = computed(() => {
  return createForm.name.trim().length > 0
    && createForm.description.trim().length > 0
    && !createErrors.name
})

function validateName() {
  const name = createForm.name.trim()
  createErrors.name = ''
  if (!name) {
    createErrors.name = t('slash').skillNameRequired
    return
  }
  const existing = skillStore.getSkillByName(name)
  if (existing) {
    createErrors.name = t('slash').skillNameExists
  }
}

function openCreateFromTemplate(skill: MarketSkill) {
  createForm.name = skill.name
  createForm.description = skill.description
  createErrors.name = ''
  creatingFrom.value = skill
}

async function handleCreateFromTemplate() {
  if (!creatingFrom.value || !isCreateValid.value) return

  isCreating.value = true
  try {
    await skillStore.addSkill({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      content: creatingFrom.value.content,
      autoEnable: true,
    })
    showMessage(`技能「${createForm.name.trim()}」已创建`, 2000, 'info')
    creatingFrom.value = null
    emit('created')
  }
  catch (err) {
    showMessage(`创建失败: ${(err as Error).message}`, 3000, 'error')
  }
  finally {
    isCreating.value = false
  }
}
</script>

<style lang="scss" scoped>
.skill-market-dialog {
  padding: 16px;
  min-width: 400px;
  position: relative;
}

.market-search {
  margin-bottom: 16px;
}

.market-empty {
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 32px 0;
}

.market-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.market-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  padding: 14px 16px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary-light, var(--b3-theme-primary));
  }
}

.market-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.market-card-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.market-card-tags {
  display: flex;
  gap: 4px;
}

.market-card-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface-light);
}

.market-card-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
  margin-bottom: 10px;
}

.market-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.market-card-author {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.7;
}

.use-template-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-primary-light, var(--b3-theme-surface-lighter));
    color: var(--b3-theme-primary);
  }
}

.use-template-btn__icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.create-from-template-dialog {
  width: 420px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.create-form-label {
  font-size: 13px;
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

.create-form-error {
  font-size: 12px;
  color: var(--b3-theme-error);
}
</style>
