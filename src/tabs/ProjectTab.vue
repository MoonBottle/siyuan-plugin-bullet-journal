<template>
  <div
    class="hk-work-tab project-tab"
    :class="{ 'project-tab--embedded': embedded }"
  >
    <div class="block__icons">
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <div class="status-filter">
        <button
          v-for="s in statusOptions"
          :key="s.value"
          class="status-btn"
          :class="[{ active: isStatusActive(s.value) }]"
          @click="toggleStatusFilter(s.value)"
        >
          {{ s.label }}
        </button>
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <span
        v-if="projectStore.projects.length > 0"
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="t('project').resetColumnWidthsTooltip"
        @click="handleResetColumnRatios"
      >
        <svg><use xlink:href="#iconFullscreen"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="projectViewRef?.allCollapsed ? t('todo').expandAll : t('todo').collapseAll"
        @click="projectViewRef?.toggleCollapseAll()"
      >
        <svg><use :xlink:href="projectViewRef?.allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
      </span>
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <ProjectView
        ref="projectViewRef"
        :projects="filteredProjects"
        :embedded="embedded"
        :column-ratios="columnRatios"
        :item-status-filter="effectiveStatusFilter"
        @update:column-ratios="handleColumnRatiosChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ItemStatus } from '@/types/models'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import ProjectView from '@/components/project/ProjectView.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import { t } from '@/i18n'
import {
  getCurrentPlugin,
  usePlugin,
} from '@/main'
import {
  useProjectStore,
  useSettingsStore,
} from '@/stores'
import { showMessage } from '@/utils/dialog'
import {
  DATA_REFRESH_CHANNEL,
  eventBus,
  Events,
} from '@/utils/eventBus'
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard'
import { buildViewDebugContext } from '@/utils/viewDebug'

const props = withDefaults(defineProps<{
  embedded?: boolean
  groupId?: string
  columnRatios?: [number, number, number]
  itemStatusFilter?: ItemStatus[]
}>(), {
  embedded: false,
})

const emit = defineEmits<{
  (event: 'update:itemStatusFilter', value: ItemStatus[]): void
}>()

const plugin = usePlugin() as any
const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const selectedGroup = ref(props.groupId ?? '')
const projectViewRef = ref<InstanceType<typeof ProjectView> | null>(null)

const DEFAULT_COLUMN_RATIOS: [number, number, number] = [20, 20, 60]

const columnRatios = ref<[number, number, number]>(
  props.columnRatios ? [...props.columnRatios] : [...DEFAULT_COLUMN_RATIOS],
)

function handleColumnRatiosChange(newRatios: [number, number, number]) {
  columnRatios.value = newRatios
}

function handleResetColumnRatios() {
  columnRatios.value = [...DEFAULT_COLUMN_RATIOS]
}

// 状态筛选：内部维护已选状态列表，undefined 表示全部选中
const ALL_STATUSES: ItemStatus[] = ['pending', 'completed', 'abandoned']
const internalStatusFilter = ref<ItemStatus[] | undefined>(props.itemStatusFilter)

const statusOptions: Array<{ value: ItemStatus, label: string }> = [
  {
    value: 'pending',
    label: t('common').statusPending,
  },
  {
    value: 'completed',
    label: t('common').statusCompleted,
  },
  {
    value: 'abandoned',
    label: t('common').statusAbandoned,
  },
]

function isStatusActive(status: ItemStatus): boolean {
  return !internalStatusFilter.value || internalStatusFilter.value.includes(status)
}

function toggleStatusFilter(status: ItemStatus) {
  if (!internalStatusFilter.value) {
    internalStatusFilter.value = ALL_STATUSES.filter((s) => s !== status)
  } else if (internalStatusFilter.value.includes(status)) {
    const next = internalStatusFilter.value.filter((s) => s !== status)
    internalStatusFilter.value = next.length === 0 ? undefined : next
  } else {
    const next = [...internalStatusFilter.value, status]
    internalStatusFilter.value = next.length === ALL_STATUSES.length ? undefined : next
  }
}

const effectiveStatusFilter = computed(() => internalStatusFilter.value)

watch(internalStatusFilter, (val) => {
  emit('update:itemStatusFilter', val ?? [])
})

const filteredProjects = computed(() => {
  return projectStore.getFilteredProjects(selectedGroup.value)
})

watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) selectedGroup.value = val
})

watch(() => props.columnRatios, (val) => {
  if (val && Array.isArray(val) && val.length === 3) columnRatios.value = [...val]
})

const groupOptions = computed(() => {
  const options = [{
    value: '',
    label: t('settings').projectGroups.allGroups,
  }]
  settingsStore.groups.forEach((g) => {
    options.push({
      value: g.id,
      label: g.name || t('settings').projectGroups.unnamed,
    })
  })
  return options
})

// 数据刷新处理函数（同上下文无 payload 则 loadFromPlugin 同步 groups/defaultGroup；跨上下文 BC 带完整设置则 patch）
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  console.log('[Task Assistant][ViewLifecycle] handleDataRefresh:', {
    ...buildViewDebugContext('ProjectTab', plugin),
    hasPayload: Boolean(payload),
    payloadKeys: payload ? Object.keys(payload) : [],
  })
  if (!plugin) return
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock']
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some((k) => k in payload)
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {}
    storeKeys.forEach((k) => {
      if (payload[k] !== undefined)
        patch[k] = payload[k]
    })
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch)
  } else {
    settingsStore.loadFromPlugin()
  }
  await nextTick()
}

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null
let refreshChannel: BroadcastChannel | null = null
let refreshChannelGuard: ReturnType<typeof createRefreshChannelGuard> | null = null

// 初始化数据
onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('ProjectTab', plugin))
  // 从插件加载设置
  settingsStore.loadFromPlugin()

  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup
  }

  // 监听数据刷新事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.SETTINGS_CHANGED, handleDataRefresh)

  // 跨上下文：Tab 可能与主窗口分离，用 BroadcastChannel 接收刷新
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL)
    refreshChannelGuard = createRefreshChannelGuard({
      channel: refreshChannel,
      plugin,
      getCurrentPlugin,
      onRefresh: (payload) => {
        console.log('[Task Assistant][ViewLifecycle] BroadcastChannel message:', {
          ...buildViewDebugContext('ProjectTab', plugin),
          data: payload
            ? {
                type: 'SETTINGS_CHANGED',
                ...payload,
              }
            : { type: 'SETTINGS_CHANGED' },
        })
        return handleDataRefresh(payload)
      },
      viewName: 'ProjectTab',
    })
  } catch {
    // 忽略
  }
})

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('ProjectTab', plugin))
  if (unsubscribeRefresh) {
    unsubscribeRefresh()
  }
  if (refreshChannelGuard) {
    refreshChannelGuard.dispose()
    refreshChannelGuard = null
  }
  if (refreshChannel) {
    refreshChannel.close()
    refreshChannel = null
  }
})

const handleRefresh = async () => {
  if (plugin) {
    await plugin.requestRefresh?.({
      type: 'full',
      reason: 'project-tab:manual-refresh',
    })
    showMessage(t('common').dataRefreshed)
  }
}
</script>

<style lang="scss" scoped>
.project-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.project-tab--embedded {
  .block__icons .sy-select {
    margin-left: 0px;
  }
}

.block__icons {
  .block__icon {
    opacity: 1;
  }

  .sy-select {
    margin-left: 8px;
  }

  .status-filter {
    display: flex;
    gap: 4px;
  }

  .status-btn {
    padding: 5px 10px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    border-radius: var(--b3-border-radius);
    font-size: 12px;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-surface-light);
    }

    &.active {
      background: var(--b3-theme-primary);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
