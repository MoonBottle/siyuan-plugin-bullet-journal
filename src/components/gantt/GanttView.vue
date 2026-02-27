<template>
  <div class="gantt-view">
    <div class="gantt-toolbar">
      <label class="show-items">
        <input type="checkbox" v-model="showItems" />
        显示工作事项
      </label>
      <div class="date-filter">
        <span>日期筛选:</span>
        <input type="date" v-model="startDate" />
        <span>至</span>
        <input type="date" v-model="endDate" />
      </div>
      <div class="view-modes">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          :class="['view-mode-btn', { active: viewMode === mode.value }]"
          @click="viewMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>
    <div class="gantt-wrapper">
      <div ref="ganttEl" class="gantt-inner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import type { Project } from '@/types/models';
import { DataConverter } from '@/utils/dataConverter';

interface Props {
  projects: Project[];
}

const props = defineProps<Props>();

const ganttEl = ref<HTMLElement | null>(null);
const showItems = ref(false);
const startDate = ref('');
const endDate = ref('');
const viewMode = ref<'day' | 'week' | 'month'>('day');

const viewModes = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' }
];

let ganttInitialized = false;

const ganttData = computed(() => {
  const dateFilter = startDate.value || endDate.value
    ? { start: startDate.value, end: endDate.value }
    : undefined;
  return DataConverter.projectsToGanttTasks(props.projects, showItems.value, dateFilter);
});

onMounted(() => {
  if (!ganttEl.value) return;

  // 动态加载 dhtmlx-gantt 样式
  loadGanttStyles();

  // 配置 Gantt
  gantt.config.date_format = '%Y-%m-%d %H:%i';
  gantt.config.xml_date = '%Y-%m-%d %H:%i';
  gantt.config.columns = [
    { name: 'text', label: '任务名称', width: '*', tree: true },
    { name: 'start_date', label: '开始', align: 'center', width: 100 },
    { name: 'end_date', label: '结束', align: 'center', width: 100 }
  ];
  gantt.config.open_tree_initially = true;
  gantt.config.bar_height = 28;
  gantt.config.row_height = 36;
  gantt.config.drag_resize = false;
  gantt.config.drag_move = false;
  gantt.config.drag_progress = false;
  gantt.config.drag_links = false;

  // 自定义任务条样式
  gantt.templates.task_class = function(start, end, task) {
    if (task.type === 'project') {
      return 'gantt-project';
    }
    return 'gantt-task';
  };

  // 自定义任务文本 - 类似 Obsidian 的日历样式
  gantt.templates.task_text = function(start, end, task) {
    return `<span style="
      color: var(--b3-theme-on-background);
      font-weight: 500;
      font-size: 12px;
      padding: 2px 6px;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    ">${task.text}</span>`;
  };

  // 本地化 - 使用内置中文
  gantt.i18n.setLocale('cn');

  // 设置初始视图模式
  setScaleConfig(viewMode.value);

  gantt.init(ganttEl.value);
  ganttInitialized = true;

  // 设置容器高度
  setGanttHeight();

  // 添加 resize 监听
  window.addEventListener('resize', handleResize);

  updateGantt();
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
    .gantt-task {
      background-color: var(--b3-theme-primary) !important;
      border-color: var(--b3-theme-primary) !important;
    }
    .gantt-project {
      background-color: var(--b3-theme-secondary) !important;
      border-color: var(--b3-theme-secondary) !important;
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

watch([ganttData, showItems, startDate, endDate], () => {
  updateGantt();
});

watch(viewMode, (newMode) => {
  if (ganttInitialized) {
    setScaleConfig(newMode);
    gantt.render();
  }
});

const updateGantt = () => {
  if (!ganttInitialized) return;
  gantt.clearAll();
  gantt.parse({ data: ganttData.value });
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

.gantt-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  flex-wrap: wrap;
}

.show-items {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 13px;
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  input[type='date'] {
    padding: 4px 8px;
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
  padding: 4px 12px;
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

/* 外层容器 - 类似 Obsidian 的 gantt-container */
.gantt-wrapper {
  flex: 1;
  width: 100%;
  overflow: hidden;
  position: relative;
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
