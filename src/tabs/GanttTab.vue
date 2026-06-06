<template>
  <div
    class="hk-work-tab gantt-tab"
    :class="{ 'gantt-tab--embedded': embedded }"
  >
    <div class="block__icons">
      <!-- 左侧：甘特图控件 -->
      <label class="show-items">
        <input
          v-model="showItems"
          type="checkbox"
        />
        {{ t('gantt').showItems }}
      </label>
      <div class="date-filter">
        <span>{{ t('gantt').dateFilter }}</span>
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
      <div class="view-modes">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          class="view-mode-btn"
          :class="[{ active: viewMode === mode.value }]"
          @click="viewMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>
      <span class="fn__flex-1 fn__space"></span>
      <!-- 右侧：分组、刷新 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard'
import { buildViewDebugContext } from '@/utils/viewDebug'

const props = withDefaults(defineProps<{
  embedded?: boolean
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  startDate?: string
  endDate?: string
  groupId?: string
}>(), {
  embedded: false,
  viewMode: 'day',
  showItems: false,
  startDate: '',
  endDate: '',
  groupId: '',
})

const plugin = usePlugin() as any
const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

const selectedGroup = ref(props.groupId)
const showItems = ref(props.showItems)
const startDate = ref(props.startDate)
const endDate = ref(props.endDate)
const viewMode = ref<'day' | 'week' | 'month'>(props.viewMode)

const viewModes: Array<{ value: 'day' | 'week' | 'month', label: string }> = [
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

// 初始化数据
onMounted(async () => {
  console.log('[Task Assistant][ViewLifecycle] onMounted:', buildViewDebugContext('GanttTab', plugin))
  // 从插件加载设置
  settingsStore.loadFromPlugin()

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
}

.gantt-tab--embedded {
  // 嵌入模式下无需额外样式，预留扩展点
}

.block__icons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 12px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);

  .block__icon {
    opacity: 1;
  }

  .show-items {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 12px;
    min-height: 28px;
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

  .view-modes {
    display: flex;
    gap: 4px;
  }

  .view-mode-btn {
    padding: 5px 12px;
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
}
</style>
