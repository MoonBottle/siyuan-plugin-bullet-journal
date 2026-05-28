import type {
  Item,
  PomodoroRecord,
  Project,
  Task,
} from '@/types/models'
import {
  computed,
  reactive,
} from 'vue'

export interface DetailState {
  // Navigation stack for hierarchical browsing
  stack: Array<{ type: 'item' | 'project' | 'task', id: string }>

  // Current view data
  currentItem: Item | null
  currentProject: Project | null
  currentTask: Task | null

  // UI state
  showPomodoroList: boolean
}

export function useItemDetail() {
  // State inside function to avoid singleton pattern
  const state = reactive<DetailState>({
    stack: [],
    currentItem: null,
    currentProject: null,
    currentTask: null,
    showPomodoroList: false,
  })

  const isRootLevel = computed(() => state.stack.length === 0)
  const currentLevel = computed(() => state.stack.length)
  const canGoBack = computed(() => state.stack.length > 0)
  const breadcrumb = computed(() => {
    return state.stack.map((s) => ({
      type: s.type,
      name: s.type === 'project'
        ? state.currentProject?.name
        : s.type === 'task'
          ? state.currentTask?.name
          : state.currentItem?.content,
    }))
  })

  const openItem = (item: Item) => {
    state.currentItem = item
    state.currentProject = item.project || null
    state.currentTask = item.task || null
    state.stack = []
  }

  const openProject = (project: Project) => {
    if (state.currentProject) {
      state.stack.push({
        type: 'project',
        id: project.id,
      })
    }
    state.currentProject = project
    state.currentTask = null
  }

  const openTask = (task: Task) => {
    if (state.currentTask) {
      state.stack.push({
        type: 'task',
        id: task.blockId || task.name,
      })
    }
    state.currentTask = task
  }

  const goBack = () => {
    if (state.stack.length === 0) return false

    const prev = state.stack.pop()
    if (!prev) return false

    // Restore previous state based on stack
    // This is simplified - in real implementation, you'd fetch the data
    return true
  }

  const reset = () => {
    state.stack = []
    state.currentItem = null
    state.currentProject = null
    state.currentTask = null
    state.showPomodoroList = false
  }

  const formatPomodoroDuration = (pomodoro: PomodoroRecord): string => {
    const start = new Date(pomodoro.startTime)
    const end = new Date(pomodoro.endTime || Date.now())
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
    return `${minutes}分钟`
  }

  return {
    state,
    isRootLevel,
    currentLevel,
    canGoBack,
    breadcrumb,
    openItem,
    openProject,
    openTask,
    goBack,
    reset,
    formatPomodoroDuration,
  }
}
