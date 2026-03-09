<template>
  <div class="gantt-view">
    <div class="gantt-wrapper" :class="{ 'gantt-ready': ganttReady }">
      <div ref="ganttEl" class="gantt-inner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import type { Project, CalendarEvent } from '@/types/models';
import { DataConverter } from '@/utils/dataConverter';
import { getCurrentLocale, t } from '@/i18n';
import { showEventDetailModal, showDatePickerDialog, createDialog } from '@/utils/dialog';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';
import { updateBlockContent, updateBlockDateTime, openDocumentAtLine } from '@/utils/fileUtils';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { createApp } from 'vue';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';

interface Props {
  projects: Project[];
  showItems?: boolean;
  startDate?: string;
  endDate?: string;
  viewMode?: 'day' | 'week' | 'month';
}

const props = withDefaults(defineProps<Props>(), {
  showItems: false,
  startDate: '',
  endDate: '',
  viewMode: 'day'
});

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();
const plugin = usePlugin();

const ganttEl = ref<HTMLElement | null>(null);

let ganttInitialized = false;
let resizeObserver: ResizeObserver | null = null;
let onTaskClickId: string | number | null = null;
let onContextMenuId: string | number | null = null;
let ganttTooltipHideTimer: ReturnType<typeof setTimeout> | null = null;
const ganttReady = ref(false);

const GANTT_TOOLTIP_ID = 'gantt-tooltip';
const TOOLTIP_HIDE_DELAY = 100;

const getOrCreateGanttTooltip = (): HTMLElement => {
  let el = document.getElementById(GANTT_TOOLTIP_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = GANTT_TOOLTIP_ID;
    el.className = 'gantt-tooltip-custom fn__none';
    el.addEventListener('mouseover', () => {
      if (ganttTooltipHideTimer) {
        clearTimeout(ganttTooltipHideTimer);
        ganttTooltipHideTimer = null;
      }
    });
    el.addEventListener('mouseout', (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement;
      if (!related?.closest('.gantt-task-text')) hideGanttTooltip();
    });
    document.body.appendChild(el);
  }
  return el;
};

const showGanttTooltip = (text: string, anchorEl: HTMLElement) => {
  if (ganttTooltipHideTimer) {
    clearTimeout(ganttTooltipHideTimer);
    ganttTooltipHideTimer = null;
  }
  const tip = getOrCreateGanttTooltip();
  tip.textContent = text;
  tip.classList.remove('fn__none');

  const anchor = anchorEl.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const gap = 6;
  let left = anchor.left + (anchor.width - tipRect.width) / 2;
  let top = anchor.top - tipRect.height - gap;

  const maxLeft = window.innerWidth - tipRect.width - 8;
  const minLeft = 8;
  left = Math.max(minLeft, Math.min(maxLeft, left));
  top = Math.max(8, top);

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
};

const hideGanttTooltip = () => {
  if (ganttTooltipHideTimer) return;
  ganttTooltipHideTimer = setTimeout(() => {
    ganttTooltipHideTimer = null;
    const tip = document.getElementById(GANTT_TOOLTIP_ID);
    if (tip) tip.classList.add('fn__none');
  }, TOOLTIP_HIDE_DELAY);
};

const handleGanttTooltipMouseOver = (e: MouseEvent) => {
  const target = (e.target as HTMLElement).closest('.gantt-task-text');
  if (target) {
    const text = (target as HTMLElement).getAttribute('data-gantt-tooltip');
    if (text) showGanttTooltip(text, target as HTMLElement);
  } else {
    hideGanttTooltip();
  }
};

const handleGanttTooltipMouseOut = (e: MouseEvent) => {
  const related = e.relatedTarget as HTMLElement;
  if (related?.closest(`#${GANTT_TOOLTIP_ID}`) || related?.closest('.gantt-task-text')) return;
  hideGanttTooltip();
};

const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  return t('statusTag')[status] || '';
};

const openPomodoroDialog = (item: Item) => {
  const dialog = createDialog({
    title: '开始专注',
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto'
  });

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount');
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => {
        dialog.destroy();
      },
      preselectedItem: item,
      hideItemList: true
    });
    app.mount(mountEl);
  }
};

const handleGanttTaskClick = (id: string | number) => {
  const task = gantt.getTask(id);
  if (!task?.extendedProps?.item) return;

  const props = task.extendedProps;
  const start = props.originalStartDateTime || props.date || '';
  const end = props.originalEndDateTime || props.originalStartDateTime || props.date || '';
  const allDay = !props.originalStartDateTime;

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
      siblingItems: props.siblingItems
    }
  };
  showEventDetailModal(eventData);
};

const handleGanttContextMenu = (taskId: string | number, _linkId: string | number, event: MouseEvent) => {
  const task = gantt.getTask(taskId);
  if (!task?.extendedProps?.item) return true;

  const props = task.extendedProps;
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
    siblingItems: props.siblingItems
  };

  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  const menuOptions = createItemMenu(
    item,
    {
      onComplete: async () => {
        if (!item.blockId) return;
        const tag = getStatusTag('completed');
        const success = await updateBlockContent(item.blockId, tag);
        if (success && plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onStartPomodoro: () => openPomodoroDialog(item as Item),
      onMigrateToday: async () => {
        if (!item.blockId) return;
        const todayStr = dayjs().format('YYYY-MM-DD');
        await updateBlockDateTime(
          item.blockId,
          todayStr,
          item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
          item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
          !item.startDateTime,
          item.date,
          completeSiblingItems,
          item.status
        );
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateTomorrow: async () => {
        if (!item.blockId) return;
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
        await updateBlockDateTime(
          item.blockId,
          tomorrowStr,
          item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
          item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
          !item.startDateTime,
          item.date,
          completeSiblingItems,
          item.status
        );
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateCustom: async () => {
        if (!item.blockId) return;
        showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
          await updateBlockDateTime(
            item.blockId,
            newDate,
            item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
            item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
            !item.startDateTime,
            item.date,
            completeSiblingItems,
            item.status
          );
          if (plugin) {
            await projectStore.refresh(plugin, settingsStore.enabledDirectories);
          }
        });
      },
      onAbandon: async () => {
        if (!item.blockId) return;
        const tag = getStatusTag('abandoned');
        const success = await updateBlockContent(item.blockId, tag);
        if (success && plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onOpenDoc: () => {
        if (item.docId && item.lineNumber) {
          openDocumentAtLine(item.docId, item.lineNumber);
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
            lineNumber: props.lineNumber ?? 0
          }
        };
        showEventDetailModal(eventData);
      }
    },
    { showCalendarMenu: false, isFocusing: pomodoroStore.isFocusing }
  );

  menuOptions.x = event.clientX;
  menuOptions.y = event.clientY;
  showContextMenu(menuOptions);
  return false;
};

const ganttData = computed(() => {
  const dateFilter = props.startDate || props.endDate
    ? { start: props.startDate, end: props.endDate }
    : undefined;
  return DataConverter.projectsToGanttTasks(props.projects, props.showItems, dateFilter);
});

onMounted(() => {
  if (!ganttEl.value) return;

  // 动态加载 dhtmlx-gantt 样式
  loadGanttStyles();

  // 配置 Gantt
  gantt.config.date_format = '%Y-%m-%d %H:%i';
  gantt.config.xml_date = '%Y-%m-%d %H:%i';
  gantt.config.columns = [
    {
      name: 'text',
      label: t('gantt').taskName,
      width: '*',
      tree: true,
      template: (task) => {
        const escapedText = (task.text || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<span class="gantt-task-text" data-gantt-tooltip="${escapedText}" aria-label="${escapedText}" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${task.text}</span>`;
      }
    },
    { name: 'start_date', label: t('gantt').startTime, align: 'center', width: 100 },
    { name: 'end_date', label: t('gantt').endTime, align: 'center', width: 100 }
  ];
  gantt.config.open_tree_initially = true;
  gantt.config.bar_height = 28;
  gantt.config.row_height = 36;
  gantt.config.drag_resize = false;
  gantt.config.drag_move = false;
  gantt.config.drag_progress = false;
  gantt.config.drag_links = false;

  // 注释掉双击功能：禁用双击打开任务详情
  gantt.config.details_on_dblclick = false;

  // 自定义任务条样式 - 项目/任务/事项区分
  gantt.templates.task_class = function(_start, _end, task) {
    if (task.type === 'project') return 'gantt-project';
    if (String(task.id).startsWith('item-')) return 'gantt-item';
    return 'gantt-task';
  };

  // 自定义任务文本 - 项目/任务/事项对应文字颜色
  gantt.templates.task_text = function(_start, _end, task) {
    const escapedText = (task.text || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const textColor = task.type === 'project'
      ? 'var(--b3-theme-on-secondary)'
      : String(task.id).startsWith('item-')
        ? 'var(--b3-theme-on-success)'
        : 'var(--b3-theme-on-primary)';
    return `<span class="gantt-task-text" data-gantt-tooltip="${escapedText}" aria-label="${escapedText}" style="
      color: ${textColor};
      font-weight: 500;
      font-size: 12px;
      padding: 2px 6px;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    ">${task.text}</span>`;
  };

  // 短条（≤1 天）在右侧显示文字，避免条内文字不可见
  // 日/周视图：短文字（如「ddd」「测试」）条内可读，不重复显示；月视图：条极短，一律右侧显示
  const SHORT_BAR_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const MIN_TEXT_LENGTH_FOR_RIGHTSIDE = 6;
  gantt.templates.rightside_text = function(start, end, task) {
    const duration = (end?.getTime?.() ?? 0) - (start?.getTime?.() ?? 0);
    if (duration > SHORT_BAR_THRESHOLD_MS || !task.text) return '';
    if (props.viewMode !== 'month' && task.text.length < MIN_TEXT_LENGTH_FOR_RIGHTSIDE) return '';
    const escaped = (task.text || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="gantt-task-text gantt-rightside-text" data-gantt-tooltip="${escaped}" aria-label="${escaped}" style="
      color: var(--b3-theme-on-background);
      font-size: 12px;
      white-space: nowrap;
      margin-left: 4px;
    ">${task.text}</span>`;
  };

  // 本地化 - 根据插件语言设置
  gantt.i18n.setLocale(getCurrentLocale().startsWith('zh') ? 'cn' : 'en');

  // 设置初始视图模式
  setScaleConfig(props.viewMode);

  gantt.init(ganttEl.value);
  ganttInitialized = true;

  onTaskClickId = gantt.attachEvent('onTaskClick', (id) => {
    handleGanttTaskClick(id);
    return true;
  });
  onContextMenuId = gantt.attachEvent('onContextMenu', (taskId, linkId, event) => {
    return handleGanttContextMenu(taskId, linkId, event as MouseEvent);
  });

  ganttEl.value.addEventListener('mouseover', handleGanttTooltipMouseOver);
  ganttEl.value.addEventListener('mouseout', handleGanttTooltipMouseOut);

  // 设置容器高度
  setGanttHeight();

  // 添加 resize 监听
  window.addEventListener('resize', handleResize);

  // ResizeObserver 监听容器尺寸变化（与 CalendarView 一致，解决数据变动后空白）
  resizeObserver = new ResizeObserver(() => {
    setGanttHeight();
  });
  resizeObserver.observe(ganttEl.value);

  updateGantt();
  ganttReady.value = true;
});

// 设置甘特图容器高度
const setGanttHeight = () => {
  if (ganttEl.value) {
    // gantt-inner 已经通过 CSS 设置为 100% 高度
    // 只需要通知 gantt 重新计算尺寸
    if (ganttInitialized) {
      gantt.setSizes();
    }
  }
};

// resize 处理函数
const handleResize = () => {
  setGanttHeight();
};

// 动态加载甘特图主题样式
const loadGanttStyles = () => {
  // 添加思源主题覆盖样式
  const style = document.createElement('style');
  style.id = 'dhtmlx-gantt-theme-styles';
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
    /* 甘特图自定义 tooltip - 深色背景、白色文字（与思源刷新按钮一致） */
    #gantt-tooltip.gantt-tooltip-custom {
      position: fixed;
      z-index: 2147483647;
      padding: 6px 10px;
      font-size: 12px;
      line-height: 1.4;
      color: #fff;
      background-color: #2d2d2d;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      white-space: nowrap;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: auto;
    }
    #gantt-tooltip.gantt-tooltip-custom::before {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #2d2d2d;
    }
  `;
  document.head.appendChild(style);
};

// 设置视图模式
const setScaleConfig = (mode: 'day' | 'week' | 'month') => {
  switch (mode) {
    case 'day':
      gantt.config.scales = [
        { unit: 'day', step: 1, format: '%d %M' }
      ];
      gantt.config.scale_height = 27;
      break;
    case 'week':
      gantt.config.scales = [
        { unit: 'week', step: 1, format: '第%W周' },
        { unit: 'day', step: 1, format: '%d' }
      ];
      gantt.config.scale_height = 50;
      break;
    case 'month':
      gantt.config.scales = [
        { unit: 'month', step: 1, format: '%Y年%M' },
        { unit: 'week', step: 1, format: '第%W周' }
      ];
      gantt.config.scale_height = 50;
      break;
  }
};

onUnmounted(() => {
  ganttReady.value = false;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (onTaskClickId !== null) {
    gantt.detachEvent(String(onTaskClickId));
    onTaskClickId = null;
  }
  if (onContextMenuId !== null) {
    gantt.detachEvent(String(onContextMenuId));
    onContextMenuId = null;
  }
  if (ganttEl.value) {
    ganttEl.value.removeEventListener('mouseover', handleGanttTooltipMouseOver);
    ganttEl.value.removeEventListener('mouseout', handleGanttTooltipMouseOut);
  }
  if (ganttTooltipHideTimer) {
    clearTimeout(ganttTooltipHideTimer);
    ganttTooltipHideTimer = null;
  }
  const tip = document.getElementById(GANTT_TOOLTIP_ID);
  if (tip) tip.remove();
  if (ganttInitialized) {
    gantt.clearAll();
  }
  // 清理样式
  const style = document.getElementById('dhtmlx-gantt-theme-styles');
  if (style) {
    style.remove();
  }
  // 移除 resize 监听
  window.removeEventListener('resize', handleResize);
});

watch([ganttData, () => props.showItems, () => props.startDate, () => props.endDate], () => {
  nextTick(() => updateGantt());
}, { flush: 'post' });

watch(() => props.viewMode, (newMode) => {
  if (ganttInitialized) {
    setScaleConfig(newMode);
    gantt.render();
  }
});

const updateGantt = () => {
  if (!ganttInitialized) return;
  gantt.clearAll();
  gantt.parse({ data: ganttData.value });
  gantt.render();
  gantt.setSizes();
};
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
</style>
