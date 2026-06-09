<template>
  <div class="gantt-view">
    <div
      class="gantt-wrapper"
      :class="{ 'gantt-ready': ganttReady }"
    >
      <div
        ref="ganttEl"
        class="gantt-inner"
      ></div>
    </div>
    <Teleport to="body">
      <div
        ref="eventTooltipEl"
        class="gantt-event-tooltip"
        :class="{ 'gantt-event-tooltip--visible': eventTooltipVisible }"
        :style="eventTooltipStyle"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type {
  CalendarEvent,
  Item,
  Project,
} from '@/types/models'

import { gantt } from 'dhtmlx-gantt'
import {
  computed,
  createApp,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue'
import {
  getCurrentLocale,
  t,
} from '@/i18n'
import { usePlugin } from '@/main'
import {
  usePomodoroStore,
} from '@/stores'
import { writeBlock } from '@/utils/blockWriter'
import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'
import {
  createItemMenu,
  showContextMenu,
} from '@/utils/contextMenu'
import { DataConverter } from '@/utils/dataConverter'
import dayjs from '@/utils/dayjs'
import {
  buildEventDetailContent,
  createDialog,
  showDatePickerDialog,
  showEventDetailModal,
} from '@/utils/dialog'
import { openDocumentAtLine } from '@/utils/fileUtils'
import { computeTooltipPosition } from '@/utils/tooltipPosition'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'

const props = withDefaults(defineProps<Props>(), {
  showItems: false,
  startDate: '',
  endDate: '',
  viewMode: 'day',
})

const HTML_DBLQUOTE_RE = /"/g
const HTML_LT_RE = /</g
const HTML_GT_RE = />/g

interface Props {
  projects: Project[]
  showItems?: boolean
  startDate?: string
  endDate?: string
  viewMode?: 'day' | 'week' | 'month'
}

const pomodoroStore = usePomodoroStore()
const plugin = usePlugin() as any

const ganttEl = ref<HTMLElement | null>(null)

let ganttInitialized = false
let resizeObserver: ResizeObserver | null = null
let onTaskClickId: string | number | null = null
let onContextMenuId: string | number | null = null
const ganttReady = ref(false)

const GANTT_TOOLTIP_HOVER_DELAY = 300

const eventTooltipEl = ref<HTMLElement | null>(null)
const eventTooltipVisible = ref(false)
const eventTooltipStyle = ref<{ left?: string, top?: string }>({})
let eventTooltipTimer: ReturnType<typeof setTimeout> | null = null

const showGanttEventTooltip = (e: MouseEvent, anchorEl: HTMLElement) => {
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer)
    eventTooltipTimer = null
  }
  eventTooltipTimer = setTimeout(() => {
    eventTooltipTimer = null
    const taskId = gantt.locate(e)
    if (taskId == null || !gantt.isTaskExists(taskId)) return
    const task = gantt.getTask(taskId)
    if (!task?.extendedProps?.item) return

    const props = task.extendedProps
    const start = props.originalStartDateTime || props.date || ''
    const end = props.originalEndDateTime || props.originalStartDateTime || props.date || ''
    const allDay = !props.originalStartDateTime

    const eventData: CalendarEvent = {
      id: String(task.id),
      title: task.text,
      start,
      end: end !== start ? end : undefined,
      allDay,
      extendedProps: {
        project: props.project,
        projectLinks: props.projectLinks,
        task: props.task,
        taskLinks: props.taskLinks,
        level: props.level,
        item: props.item,
        itemStatus: props.itemStatus,
        itemLinks: props.itemLinks,
        hasItems: props.hasItems ?? true,
        docId: props.docId ?? '',
        lineNumber: props.lineNumber ?? 0,
        blockId: props.blockId,
        date: props.date,
        originalStartDateTime: props.originalStartDateTime,
        originalEndDateTime: props.originalEndDateTime,
        siblingItems: props.siblingItems,
        dateRangeStart: props.dateRangeStart,
        dateRangeEnd: props.dateRangeEnd,
        pomodoros: props.pomodoros,
      },
    }

    const html = buildEventDetailContent(eventData)
    if (eventTooltipEl.value) {
      eventTooltipEl.value.innerHTML = html
      nextTick(() => {
        if (eventTooltipEl.value) {
          const rect = anchorEl.getBoundingClientRect()
          eventTooltipStyle.value = computeTooltipPosition(rect, eventTooltipEl.value, 4)
          eventTooltipVisible.value = true
        }
      })
    }
  }, GANTT_TOOLTIP_HOVER_DELAY)
}

const hideGanttEventTooltip = () => {
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer)
    eventTooltipTimer = null
  }
  eventTooltipVisible.value = false
}

const handleGanttTooltipMouseOver = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const bar = target.closest('.gantt_task_line')
  const rightsideText = target.closest('.gantt-rightside-text')
  const anchor = bar || rightsideText
  if (anchor) {
    showGanttEventTooltip(e, anchor as HTMLElement)
  } else {
    hideGanttEventTooltip()
  }
}

const handleGanttTooltipMouseOut = (e: MouseEvent) => {
  const related = e.relatedTarget as HTMLElement
  if (related?.closest('.gantt-event-tooltip') || related?.closest('.gantt_task_line') || related?.closest('.gantt-rightside-text')) return
  hideGanttEventTooltip()
}

const openPomodoroDialog = (item: Item) => {
  const dialog = createDialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto',
  })

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount')
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => {
        dialog.destroy()
      },
      preselectedBlockId: item.blockId,
      hideItemList: true,
    })
    app.mount(mountEl)
  }
}

const handleGanttTaskClick = (id: string | number) => {
  const task = gantt.getTask(id)
  if (!task?.extendedProps?.item) return

  const props = task.extendedProps
  const start = props.originalStartDateTime || props.date || ''
  const end = props.originalEndDateTime || props.originalStartDateTime || props.date || ''
  const allDay = !props.originalStartDateTime

  const eventData: CalendarEvent = {
    id: String(task.id),
    title: task.text,
    start,
    end: end !== start ? end : undefined,
    allDay,
    extendedProps: {
      project: props.project,
      projectLinks: props.projectLinks,
      task: props.task,
      taskLinks: props.taskLinks,
      level: props.level,
      item: props.item,
      itemStatus: props.itemStatus,
      itemLinks: props.itemLinks,
      hasItems: props.hasItems ?? true,
      docId: props.docId ?? '',
      lineNumber: props.lineNumber ?? 0,
      blockId: props.blockId,
      date: props.date,
      originalStartDateTime: props.originalStartDateTime,
      originalEndDateTime: props.originalEndDateTime,
      siblingItems: props.siblingItems,
      dateRangeStart: props.dateRangeStart,
      dateRangeEnd: props.dateRangeEnd,
      pomodoros: props.pomodoros,
    },
  }
  showEventDetailModal(eventData)
}

const handleGanttContextMenu = (taskId: string | number, _linkId: string | number, event: MouseEvent) => {
  const task = gantt.getTask(taskId)
  if (!task?.extendedProps?.item) return true

  const props = task.extendedProps
  const item = {
    id: String(task.id),
    content: props.item ?? task.text,
    date: props.date ?? dayjs(task.start_date).format('YYYY-MM-DD'),
    blockId: props.blockId,
    docId: props.docId,
    lineNumber: props.lineNumber,
    status: props.itemStatus ?? 'pending',
    task: props.task ? { name: props.task } : undefined,
    startDateTime: props.originalStartDateTime,
    endDateTime: props.originalEndDateTime,
    siblingItems: props.siblingItems,
    timePrecision: props.timePrecision,
    listItemBlockId: props.listItemBlockId,
  }

  const menuOptions = createItemMenu(
    item,
    {
      onComplete: async () => {
        if (!item.blockId) return
        const success = await writeBlock({
          blockId: item.blockId,
          listItemBlockId: item.listItemBlockId,
        }, {
          type: 'setStatus',
          status: 'completed',
        })
        // 注意：重复事项的自动创建由 WebSocket 处理器处理
        if (success && plugin) {
          await plugin.requestRefresh?.({
            type: 'full',
            reason: 'gantt-view:complete',
          })
        }
      },
      onStartPomodoro: () => openPomodoroDialog(item as Item),
      onMigrateToday: async () => {
        if (!item.blockId) return
        const todayStr = dayjs().format('YYYY-MM-DD')
        await writeBlock(
          { blockId: item.blockId },
          buildDatePatchFromItem(item, todayStr, { includeCurrentItemInSiblings: true }),
        )
        if (plugin) {
          await plugin.requestRefresh?.({
            type: 'full',
            reason: 'gantt-view:migrate-today',
          })
        }
      },
      onMigrateTomorrow: async () => {
        if (!item.blockId) return
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD')
        await writeBlock(
          { blockId: item.blockId },
          buildDatePatchFromItem(item, tomorrowStr, { includeCurrentItemInSiblings: true }),
        )
        if (plugin) {
          await plugin.requestRefresh?.({
            type: 'full',
            reason: 'gantt-view:migrate-tomorrow',
          })
        }
      },
      onMigrateCustom: async () => {
        if (!item.blockId) return
        showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
          await writeBlock(
            { blockId: item.blockId },
            buildDatePatchFromItem(item, newDate, { includeCurrentItemInSiblings: true }),
          )
          if (plugin) {
            await plugin.requestRefresh?.({
              type: 'full',
              reason: 'gantt-view:migrate-custom',
            })
          }
        })
      },
      onAbandon: async () => {
        if (!item.blockId) return
        const success = await writeBlock({
          blockId: item.blockId,
          listItemBlockId: item.listItemBlockId,
        }, {
          type: 'setStatus',
          status: 'abandoned',
        })
        if (success && plugin) {
          await plugin.requestRefresh?.({
            type: 'full',
            reason: 'gantt-view:abandon',
          })
        }
      },
      onOpenDoc: () => {
        if (item.docId && item.lineNumber) {
          openDocumentAtLine(item.docId, item.lineNumber)
        }
      },
      onShowDetail: () => {
        const eventData: CalendarEvent = {
          id: item.id,
          title: item.content,
          start: item.date,
          allDay: true,
          extendedProps: {
            ...props,
            hasItems: props.hasItems ?? true,
            docId: props.docId ?? '',
            lineNumber: props.lineNumber ?? 0,
          },
        }
        showEventDetailModal(eventData)
      },
    },
    {
      showCalendarMenu: false,
      isFocusing: pomodoroStore.isFocusing,
    },
  )

  menuOptions.x = event.clientX
  menuOptions.y = event.clientY
  showContextMenu(menuOptions)
  return false
}

const ganttData = computed(() => {
  const dateFilter = props.startDate || props.endDate
    ? {
        start: props.startDate,
        end: props.endDate,
      }
    : undefined
  return DataConverter.projectsToGanttTasks(props.projects, props.showItems, dateFilter)
})

// 动态加载甘特图主题样式
const loadGanttStyles = () => {
  const style = document.createElement('style')
  style.id = 'dhtmlx-gantt-theme-styles'
  style.textContent = `
    /* 思源主题覆盖 */
    .gantt_container {
      font-family: var(--b3-font-family) !important;
      background-color: var(--b3-theme-background) !important;
    }
    .gantt_grid_scale,
    .gantt_task_scale {
      background-color: var(--b3-theme-surface) !important;
      color: var(--b3-theme-on-background) !important;
      border-bottom: 1px solid var(--b3-border-color) !important;
    }
    .gantt_grid_head_cell {
      color: var(--b3-theme-on-background) !important;
      font-weight: 600 !important;
    }
    .gantt_scale_cell {
      color: var(--b3-theme-on-surface) !important;
      border-right: 1px solid var(--b3-border-color) !important;
    }
    .gantt_row,
    .gantt_task_row {
      background-color: var(--b3-theme-background) !important;
      border-bottom: 1px solid var(--b3-border-color) !important;
    }
    .gantt_row.odd,
    .gantt_task_row.odd {
      background-color: var(--b3-theme-surface) !important;
    }
    .gantt_cell {
      color: var(--b3-theme-on-background) !important;
      border-right: 1px solid var(--b3-border-color) !important;
    }
    .gantt_tree_content {
      color: var(--b3-theme-on-background) !important;
    }
    .gantt_tree_icon {
      color: var(--b3-theme-on-surface) !important;
    }
    /* 任务条内文字垂直居中 */
    .gantt_task_line > div {
      display: flex !important;
      align-items: center !important;
    }
    .gantt-task {
      background-color: var(--b3-theme-primary) !important;
      border-color: var(--b3-theme-primary) !important;
    }
    .gantt-project {
      background-color: var(--b3-theme-secondary) !important;
      border-color: var(--b3-theme-secondary) !important;
    }
    .gantt-item {
      background-color: var(--b3-theme-success) !important;
      border-color: var(--b3-theme-success) !important;
    }
    .gantt_task,
    .gantt_task_bg {
      background-color: var(--b3-theme-background) !important;
    }
    .gantt_layout,
    .gantt_layout_content {
      border-color: var(--b3-border-color) !important;
    }
    .gantt_grid_data {
      background-color: var(--b3-theme-background) !important;
    }
    .gantt-multidate-item {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    .gantt-multidate-item .gantt_task_progress {
      display: none !important;
    }
    .gantt-multidate-item .gantt_task_content {
      padding: 0 !important;
    }
    .gantt-segment-bar {
      position: absolute;
      top: 0;
      height: 100%;
      background-color: var(--b3-theme-success);
      border-radius: 2px;
      border: 1px solid var(--b3-theme-success);
    }
    .gantt-multidate-label {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      color: var(--b3-theme-on-success);
      font-weight: 500;
      font-size: 12px;
      padding: 2px 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      z-index: 1;
      pointer-events: none;
    }
  `
  document.head.appendChild(style)
}

// 设置视图模式
const setScaleConfig = (mode: 'day' | 'week' | 'month') => {
  switch (mode) {
    case 'day':
      gantt.config.scales = [
        {
          unit: 'day',
          step: 1,
          format: '%d %M',
        },
      ]
      gantt.config.scale_height = 27
      break
    case 'week':
      gantt.config.scales = [
        {
          unit: 'week',
          step: 1,
          format: t('gantt').weekFormat,
        },
        {
          unit: 'day',
          step: 1,
          format: '%d',
        },
      ]
      gantt.config.scale_height = 50
      break
    case 'month':
      gantt.config.scales = [
        {
          unit: 'month',
          step: 1,
          format: t('gantt').monthFormat,
        },
        {
          unit: 'week',
          step: 1,
          format: t('gantt').weekFormat,
        },
      ]
      gantt.config.scale_height = 50
      break
  }
}

// 设置甘特图容器高度
const setGanttHeight = () => {
  if (ganttEl.value) {
    if (ganttInitialized) {
      gantt.setSizes()
    }
  }
}

// resize 处理函数
const handleResize = () => {
  setGanttHeight()
}

const updateGantt = () => {
  if (!ganttInitialized) return
  gantt.clearAll()
  gantt.parse({ data: ganttData.value })
  gantt.render()
  gantt.setSizes()
}

onMounted(() => {
  if (!ganttEl.value) return

  // 动态加载 dhtmlx-gantt 样式
  loadGanttStyles()

  // 配置 Gantt
  gantt.config.date_format = '%Y-%m-%d %H:%i'
  gantt.config.xml_date = '%Y-%m-%d %H:%i'
  gantt.config.columns = [
    {
      name: 'text',
      label: t('gantt').taskName,
      width: '*',
      tree: true,
      template: (task) => {
        const text = task.text ?? ''
        const escapedText = text.replace(HTML_DBLQUOTE_RE, '&quot;').replace(HTML_LT_RE, '&lt;').replace(HTML_GT_RE, '&gt;')
        return `<span class="gantt-task-text" data-gantt-tooltip="${escapedText}" aria-label="${escapedText}" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${text}</span>`
      },
    },
    {
      name: 'start_date',
      label: t('gantt').startTime,
      align: 'center',
      width: 100,
    },
    {
      name: 'end_date',
      label: t('gantt').endTime,
      align: 'center',
      width: 100,
    },
  ]
  gantt.config.open_tree_initially = true
  gantt.config.bar_height = 28
  gantt.config.row_height = 36
  gantt.config.drag_resize = false
  gantt.config.drag_move = false
  gantt.config.drag_progress = false
  gantt.config.drag_links = false

  // 注释掉双击功能：禁用双击打开任务详情
  gantt.config.details_on_dblclick = false

  // 自定义任务条样式 - 项目/任务/事项区分
  gantt.templates.task_class = function (_start, _end, task) {
    if (task.extendedProps?.isMultiDate) return 'gantt-multidate-item'
    if (task.type === 'project') return 'gantt-project'
    if (String(task.id).startsWith('item-')) return 'gantt-item'
    return 'gantt-task'
  }

  // 自定义任务文本 - 项目/任务/事项对应文字颜色
  gantt.templates.task_text = function (start, end, task) {
    if (task.extendedProps?.isMultiDate && task.extendedProps?.segments?.length) {
      const totalDuration = end.getTime() - start.getTime()
      if (totalDuration <= 0) return ''
      const text = task.text ?? ''
      const escapedText = text.replace(HTML_DBLQUOTE_RE, '&quot;').replace(HTML_LT_RE, '&lt;').replace(HTML_GT_RE, '&gt;')
      let html = `<span class="gantt-multidate-label" data-gantt-tooltip="${escapedText}" aria-label="${escapedText}">${text}</span>`
      for (const seg of task.extendedProps.segments) {
        const left = ((seg.startTs - start.getTime()) / totalDuration) * 100
        const width = ((seg.endTs - start.getTime()) / totalDuration) * 100 - left
        html += `<div class="gantt-segment-bar" style="left:${left}%;width:${Math.max(width, 0.5)}%"></div>`
      }
      return html
    }
    const text = task.text ?? ''
    const escapedText = text.replace(HTML_DBLQUOTE_RE, '&quot;').replace(HTML_LT_RE, '&lt;').replace(HTML_GT_RE, '&gt;')
    const textColor = task.type === 'project'
      ? 'var(--b3-theme-on-secondary)'
      : String(task.id).startsWith('item-')
        ? 'var(--b3-theme-on-success)'
        : 'var(--b3-theme-on-primary)'
    return `<span class="gantt-task-text" data-gantt-tooltip="${escapedText}" aria-label="${escapedText}" style="
      color: ${textColor};
      font-weight: 500;
      font-size: 12px;
      padding: 2px 6px;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    ">${text}</span>`
  }

  // 短条（≤1 天）在右侧显示文字，避免条内文字不可见
  // 日/周视图：短文字（如「ddd」「测试」）条内可读，不重复显示；月视图：条极短，一律右侧显示
  const SHORT_BAR_THRESHOLD_MS = 24 * 60 * 60 * 1000
  const MIN_TEXT_LENGTH_FOR_RIGHTSIDE = 6
  gantt.templates.rightside_text = function (start, end, task) {
    const text = task.text ?? ''
    const duration = (end?.getTime?.() ?? 0) - (start?.getTime?.() ?? 0)
    if (duration > SHORT_BAR_THRESHOLD_MS || !text) return ''
    if (props.viewMode !== 'month' && text.length < MIN_TEXT_LENGTH_FOR_RIGHTSIDE) return ''
    const escaped = text.replace(HTML_DBLQUOTE_RE, '&quot;').replace(HTML_LT_RE, '&lt;').replace(HTML_GT_RE, '&gt;')
    return `<span class="gantt-task-text gantt-rightside-text" data-gantt-tooltip="${escaped}" aria-label="${escaped}" style="
      color: var(--b3-theme-on-background);
      font-size: 12px;
      white-space: nowrap;
      margin-left: 4px;
    ">${text}</span>`
  }

  // 本地化 - 根据插件语言设置
  gantt.i18n.setLocale(getCurrentLocale().startsWith('zh') ? 'cn' : 'en')

  // 设置初始视图模式
  setScaleConfig(props.viewMode)

  gantt.init(ganttEl.value)
  ganttInitialized = true

  // 先解绑再绑定，防止 Tab 切换时 destroy 未触发 onUnmounted 导致 handler 累积（点击一次弹多个框）
  if (onTaskClickId !== null) {
    gantt.detachEvent(String(onTaskClickId))
    onTaskClickId = null
  }
  onTaskClickId = gantt.attachEvent('onTaskClick', (id, e) => {
    // 仅点击右侧任务条时展示详情，左侧任务列表区域不触发
    const target = e?.target as HTMLElement | undefined
    if (!target?.closest('.gantt_task_line')) return true
    handleGanttTaskClick(id)
    return true
  })
  if (onContextMenuId !== null) {
    gantt.detachEvent(String(onContextMenuId))
    onContextMenuId = null
  }
  onContextMenuId = gantt.attachEvent('onContextMenu', (taskId, linkId, event) => {
    return handleGanttContextMenu(taskId, linkId, event as MouseEvent)
  })

  ganttEl.value.addEventListener('mouseover', handleGanttTooltipMouseOver)
  ganttEl.value.addEventListener('mouseout', handleGanttTooltipMouseOut)

  // 设置容器高度
  setGanttHeight()

  // 添加 resize 监听
  window.addEventListener('resize', handleResize)

  // ResizeObserver 监听容器尺寸变化（与 CalendarView 一致，解决数据变动后空白）
  resizeObserver = new ResizeObserver(() => {
    setGanttHeight()
  })
  resizeObserver.observe(ganttEl.value)

  updateGantt()
  ganttReady.value = true
})

onUnmounted(() => {
  ganttReady.value = false
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (onTaskClickId !== null) {
    gantt.detachEvent(String(onTaskClickId))
    onTaskClickId = null
  }
  if (onContextMenuId !== null) {
    gantt.detachEvent(String(onContextMenuId))
    onContextMenuId = null
  }
  if (ganttEl.value) {
    ganttEl.value.removeEventListener('mouseover', handleGanttTooltipMouseOver)
    ganttEl.value.removeEventListener('mouseout', handleGanttTooltipMouseOut)
  }
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer)
    eventTooltipTimer = null
  }
  if (ganttInitialized) {
    gantt.clearAll()
  }
  // 清理样式
  const style = document.getElementById('dhtmlx-gantt-theme-styles')
  if (style) {
    style.remove()
  }
  // 移除 resize 监听
  window.removeEventListener('resize', handleResize)
})

watch([ganttData, () => props.showItems, () => props.startDate, () => props.endDate], () => {
  nextTick(() => updateGantt())
}, { flush: 'post' })

watch(() => props.viewMode, (newMode) => {
  if (ganttInitialized) {
    setScaleConfig(newMode)
    gantt.render()
  }
})
</script>

<style lang="scss">
/* 甘特图视图容器 */
.gantt-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* 外层容器 - 类似 Obsidian 的 gantt-container */
.gantt-wrapper {
  flex: 1;
  width: 100%;
  overflow: hidden;
  position: relative;
  opacity: 0;
  transition: opacity 0.15s ease-in;

  &.gantt-ready {
    opacity: 1;
  }
}

/* 内层容器 - gantt 初始化目标 */
.gantt-inner {
  width: 100%;
  height: 100%;
}

/* DHTMLX Gantt 容器样式 */
.gantt_container {
  height: 100% !important;
}

/* 悬浮事项详情弹框（与日历样式一致，无滚动条） */
.gantt-event-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: 440px;
  overflow: visible;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;

  &.gantt-event-tooltip--visible {
    opacity: 1;
  }

  .sy-dialog-content {
    padding: 0 !important;
  }

  .sy-dialog-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sy-dialog-card {
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
  }
}
</style>
