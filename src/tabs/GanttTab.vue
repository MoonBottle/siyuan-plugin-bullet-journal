<template>
  <div
    class="hk-work-tab gantt-tab"
    :class="{ 'gantt-tab--embedded': embedded }"
  >
    <div class="block__icons">
      <!-- 左侧：甘特图控件 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <SySelect
        v-model="selectedStatuses"
        multiple
        :options="statusOptions"
        :placeholder="t('common').statusFilter"
      />
      <SySelect
        v-model="displayLevel"
        :options="displayLevelOptions"
        :placeholder="t('gantt').displayLevel"
      />
      <div class="date-filter">
        <span>{{ showItems ? t('gantt').itemDateFilter : t('gantt').taskDateFilter }}</span>
        <input
          v-model="startDate"
          type="date"
        />
        <span>{{ t('gantt').to }}</span>
        <input
          v-model="endDate"
          type="date"
        />
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <!-- 右侧：刷新 -->
      <SySelect
        v-model="viewMode"
        :options="viewModeOptions"
        :placeholder="t('gantt').day"
      />
      <span
        class="block__icon refresh-btn b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <GanttView
        :projects="filteredProjects"
        :show-items="showItems"
        :start-date="startDate"
        :end-date="endDate"
        :view-mode="viewMode"
        :item-status-filter="effectiveStatusFilter"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ItemStatus } from '@/types/models'
import type { GanttDatePreset } from '@/types/workbench'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import GanttView from '@/components/gantt/GanttView.vue'
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
import { buildGanttDateRange } from '@/utils/ganttDateFilter'
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard'
import { buildViewDebugContext } from '@/utils/viewDebug'

const props = withDefaults(defineProps<{
  embedded?: boolean
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset
  startDate?: string
  endDate?: string
  groupId?: string
  itemStatusFilter?: ItemStatus[]
}>(), {
  embedded: false,
  viewMode: 'day',
  showItems: false,
  datePreset: 'all',
  startDate: '',
  endDate: '',
  groupId: '',
})

const emit = defineEmits<{
  (event: 'update:viewMode', value: string): void
  (event: 'update:showItems', value: boolean): void
  (event: 'update:datePreset', value: GanttDatePreset): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'update:groupId', value: string): void
  (event: 'update:itemStatusFilter', value: ItemStatus[]): void
}>()

const plugin = usePlugin() as any
const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const selectedGroup = ref(props.groupId)
const showItems = ref(props.showItems)
const startDate = ref(props.startDate)
const endDate = ref(props.endDate)
const viewMode = ref<'day' | 'week' | 'month'>(props.viewMode)

// 显示层级：SySelect 单选，桥接 showItems boolean
const displayLevelOptions = [
  {
    value: 'task',
    label: t('gantt').tasksOnly,
  },
  {
    value: 'item',
    label: t('gantt').withItems,
  },
]

const displayLevel = computed({
  get: () => showItems.value ? 'item' : 'task',
  set: (val: string | number | (string | number)[]) => {
    showItems.value = val === 'item'
  },
})

// 状态筛选：SySelect 多选
const ALL_STATUSES: ItemStatus[] = ['pending', 'completed', 'abandoned']
const selectedStatuses = ref<(string | number)[]>(
  props.itemStatusFilter ? [...props.itemStatusFilter] : [...ALL_STATUSES],
)

const statusOptions = [
  {
    value: 'pending' as string,
    label: t('common').statusPending,
  },
  {
    value: 'completed' as string,
    label: t('common').statusCompleted,
  },
  {
    value: 'abandoned' as string,
    label: t('common').statusAbandoned,
  },
]

// 计算传给 GanttView 的 itemStatusFilter
const effectiveStatusFilter = computed(() => {
  if (selectedStatuses.value.length === ALL_STATUSES.length) return undefined
  return selectedStatuses.value as ItemStatus[]
})

const viewModeOptions = [
  {
    value: 'day',
    label: t('gantt').day,
  },
  {
    value: 'week',
    label: t('gantt').week,
  },
  {
    value: 'month',
    label: t('gantt').month,
  },
]

watch(() => props.viewMode, (val) => {
  if (val && val !== viewMode.value) viewMode.value = val
})

watch(() => props.showItems, (val) => {
  if (val !== undefined && val !== showItems.value) showItems.value = val
})

watch(() => props.startDate, (val) => {
  if (val !== undefined && val !== startDate.value) startDate.value = val
})

watch(() => props.endDate, (val) => {
  if (val !== undefined && val !== endDate.value) endDate.value = val
})

watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) selectedGroup.value = val
})

const filteredProjects = computed(() => projectStore.getFilteredProjects(selectedGroup.value))

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
    ...buildViewDebugContext('GanttTab', plugin),
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

// 同步 props 到内部 ref
watch(() => props.viewMode, (val) => {
  if (val && val !== viewMode.value) {
    viewMode.value = val
  }
})

watch(() => props.showItems, (val) => {
  if (val !== showItems.value) {
    showItems.value = val
  }
})

watch(() => props.startDate, (val) => {
  if (val !== undefined && val !== startDate.value) {
    startDate.value = val
  }
})

watch(() => props.endDate, (val) => {
  if (val !== undefined && val !== endDate.value) {
    endDate.value = val
  }
})

watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) {
    selectedGroup.value = val
  }
})

watch(() => props.datePreset, (val) => {
  const range = buildGanttDateRange(val, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  } else {
    startDate.value = ''
    endDate.value = ''
  }
})

// 状态变更时 emit 事件
watch(viewMode, (val) => {
  emit('update:viewMode', val)
})

watch(showItems, (val) => {
  emit('update:showItems', val)
})

watch(startDate, (val) => {
  emit('update:startDate', val)
})

watch(endDate, (val) => {
  emit('update:endDate', val)
})

watch(selectedGroup, (val) => {
  emit('update:groupId', val)
})

watch(selectedStatuses, (val) => {
  emit('update:itemStatusFilter', val as ItemStatus[])
}, { deep: true })

// 初始化数据
onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('GanttTab', plugin))
  // 从插件加载设置
  settingsStore.loadFromPlugin()

  const range = buildGanttDateRange(props.datePreset, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  }

  if (!selectedGroup.value && settingsStore.defaultGroup) {
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
          ...buildViewDebugContext('GanttTab', plugin),
          data: payload
            ? {
                type: 'SETTINGS_CHANGED',
                ...payload,
              }
            : { type: 'SETTINGS_CHANGED' },
        })
        return handleDataRefresh(payload)
      },
      viewName: 'GanttTab',
    })
  } catch {
    // 忽略
  }
})

onUnmounted(() => {
  console.log('[Task Assistant][ViewLifecycle] onUnmounted:', buildViewDebugContext('GanttTab', plugin))
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
      reason: 'gantt-tab:manual-refresh',
    })
    showMessage(t('common').dataRefreshed)
  }
}
</script>

<style lang="scss" scoped>
.gantt-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  // background: var(--b3-theme-surface);
}

.gantt-tab--embedded {
  .block__icons {
    padding: 6px 0;
  }
  
  .tab-content {
    padding: 0;
  }
}

:deep(.gantt_task_vscroll) {
  background: var(--b3-theme-surface);
}

.block__icons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  // background: var(--b3-theme-surface);

  .block__icon {
    opacity: 1;
  }

  .date-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;

    input[type='date'] {
      padding: 5px 10px;
      border: 1px solid var(--b3-border-color);
      border-radius: var(--b3-border-radius);
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
    }
  }

  select.b3-select {
    width: auto !important;
    min-width: 60px;
    margin-left: 8px;
    padding: 4px 24px 4px 8px;
  }

  .refresh-btn {
    margin-left: 0;
  }
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px;
}
</style>
