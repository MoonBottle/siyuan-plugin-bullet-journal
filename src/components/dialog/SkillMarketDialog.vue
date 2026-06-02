<template>
  <div class="skill-market-dialog">
    <div class="market-search">
      <div class="market-search-wrap">
        <svg class="market-search__icon">
          <use xlink:href="#iconSearch"></use>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="market-search-input"
          :placeholder="t('settings').aiSkills?.searchPlaceholder ?? '搜索模板...'"
        />
        <button
          v-if="searchQuery"
          class="market-search__clear"
          @click="searchQuery = ''"
        >
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import type { MarketSkill } from '@/services/marketService'
import {
  createApp,
  computed,
  ref,
} from 'vue'
import SkillEditDialog from '@/components/dialog/SkillEditDialog.vue'
import { createDialog } from '@/utils/dialog'
import { t } from '@/i18n'
import { MarketService } from '@/services/marketService'
import { getSharedPinia } from '@/utils/sharedPinia'
import { useSkillStore } from '@/stores/skillStore'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const skillStore = useSkillStore()
const marketService = MarketService.getInstance()

const searchQuery = ref('')

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

function openCreateFromTemplate(skill: MarketSkill) {
  const container = document.createElement('div')

  let app: ReturnType<typeof createApp>

  const dialog = createDialog({
    title: t('settings').aiSkills?.createFromTemplate ?? '从模板创建技能',
    content: '',
    width: '800px',
    destroyCallback: () => {
      app.unmount()
    },
  })

  app = createApp(SkillEditDialog, {
    skillName: skill.name,
    mode: 'create',
    initialDescription: skill.description,
    initialContent: skill.content,
    onClose: () => {
      dialog.destroy()
    },
    onSaved: () => {
      dialog.destroy()
      emit('created')
    },
  })

  app.use(getSharedPinia())
  app.mount(container)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body')
  if (bodyEl) {
    bodyEl.appendChild(container)
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

.market-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 5px 10px;

  &:focus-within {
    border-color: var(--b3-theme-primary);
  }
}

.market-search__icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  pointer-events: none;
}

.market-search-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-background);
  outline: none;

  &::placeholder {
    color: var(--b3-theme-on-surface-light);
  }
}

.market-search__clear {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.4;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
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
</style>
