import type { PriorityLevel } from '@/types/models'
import type { TodoViewStateOptions } from '@/types/todoView'
import type { TodoDateFilterType } from '@/utils/todoDateFilter'
import dayjs from 'dayjs'
import {
  computed,
  ref,
  watch,
} from 'vue'
import {
  useProjectStore,
  useSettingsStore,
} from '@/stores'
import {
  buildCompletedTodoDateRange,
  buildTodoDateRange,

} from '@/utils/todoDateFilter'

export function useTodoViewState(options: TodoViewStateOptions = {}) {
  const settingsStore = useSettingsStore()
  const projectStore = useProjectStore()
  const preset = options.preset

  const selectedGroup = ref(preset?.groupId ?? settingsStore.todoDock.selectedGroup)
  const searchQuery = ref(preset?.searchQuery ?? '')
  const selectedPriorities = ref<PriorityLevel[]>([...(preset?.priorities ?? [])])
  const selectedTags = ref<string[]>([...(preset?.selectedTags ?? [])])
  const dateFilterType = ref<TodoDateFilterType>(preset?.dateFilterType ?? 'today')
  const startDate = ref(preset?.startDate ?? dayjs().format('YYYY-MM-DD'))
  const endDate = ref(preset?.endDate ?? dayjs().add(7, 'day').format('YYYY-MM-DD'))

  if (options.persistToSettings !== false) {
    watch(selectedGroup, (value) => {
      settingsStore.todoDock.selectedGroup = value
      settingsStore.saveToPlugin()
    })
  }

  const dateRange = computed(() => {
    return buildTodoDateRange(
      dateFilterType.value,
      projectStore.currentDate,
      startDate.value,
      endDate.value,
    )
  })

  const completedDateRange = computed(() => {
    return buildCompletedTodoDateRange(
      dateFilterType.value,
      projectStore.currentDate,
      dateRange.value,
    )
  })

  return {
    selectedGroup,
    searchQuery,
    selectedPriorities,
    selectedTags,
    dateFilterType,
    startDate,
    endDate,
    dateRange,
    completedDateRange,
  }
}
