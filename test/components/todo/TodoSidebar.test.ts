// @vitest-environment happy-dom

import type { Item } from '@/types/models'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  watchEffect,
} from 'vue'
import TodoSidebar from '@/components/todo/TodoSidebar.vue'

const todoSidebarListProps = vi.fn()

const pendingItem: Item = {
  id: 'item-1',
  content: '处理优先级',
  date: '2026-05-01',
  lineNumber: 1,
  docId: 'doc-1',
  blockId: 'block-1',
  status: 'pending',
  priority: 'high',
}

const mockProjectStore = {
  loading: false,
  getDisplayItems: vi.fn(() => [pendingItem]),
  getFilteredAndSortedItems: vi.fn(() => [pendingItem]),
  getFilteredCompletedItems: vi.fn(() => []),
  getFilteredAbandonedItems: vi.fn(() => []),
}

vi.mock('@/stores', () => ({
  useProjectStore: () => mockProjectStore,
}))

vi.mock('@/components/todo/TodoSidebarList.vue', () => ({
  default: defineComponent({
    name: 'TodoSidebarListStub',
    props: {
      items: {
        type: Array,
        default: () => [],
      },
      selectedTags: {
        type: Array,
        default: () => [],
      },
      hasAnyItemsRaw: {
        type: Boolean,
        default: false,
      },
      hasActiveFilters: {
        type: Boolean,
        default: false,
      },
      loading: {
        type: Boolean,
        default: false,
      },
      displayMode: {
        type: String,
        default: 'default',
      },
    },
    setup(props, { expose }) {
      watchEffect(() => {
        todoSidebarListProps({
          items: [...props.items],
          selectedTags: [...props.selectedTags],
          hasAnyItemsRaw: props.hasAnyItemsRaw,
          hasActiveFilters: props.hasActiveFilters,
          loading: props.loading,
          displayMode: props.displayMode,
        })
      })

      expose({
        allCollapsed: false,
        collapseAll: vi.fn(),
        expandAll: vi.fn(),
        toggleCollapseAll: vi.fn(),
      })

      return () => h('div', { 'data-testid': 'todo-sidebar-list-stub' })
    },
  }),
}))

function mountSidebar(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render() {
      return h(TodoSidebar, props)
    },
  })

  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  mockProjectStore.loading = false
  mockProjectStore.getDisplayItems.mockReturnValue([pendingItem])
  mockProjectStore.getFilteredAndSortedItems.mockReturnValue([pendingItem])
  mockProjectStore.getFilteredCompletedItems.mockReturnValue([])
  mockProjectStore.getFilteredAbandonedItems.mockReturnValue([])
})

describe('todoSidebar', () => {
  it('queries items from the project store and forwards them to TodoSidebarList', async () => {
    const mounted = mountSidebar({
      groupId: 'group-a',
      searchQuery: '优先级',
      selectedTags: ['前端'],
      priorities: ['high'],
      displayMode: 'embedded',
    })

    await nextTick()

    expect(mockProjectStore.getFilteredAndSortedItems).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'group-a',
      searchQuery: '优先级',
      selectedTags: ['前端'],
      priorities: ['high'],
    }))
    expect(todoSidebarListProps).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ id: 'item-1' })],
      selectedTags: ['前端'],
      hasAnyItemsRaw: true,
      hasActiveFilters: true,
      displayMode: 'embedded',
    }))

    mounted.unmount()
  })

  it('marks empty state as unfiltered when no query props are active', async () => {
    mockProjectStore.getDisplayItems.mockReturnValue([])
    mockProjectStore.getFilteredAndSortedItems.mockReturnValue([])

    const mounted = mountSidebar({})
    await nextTick()

    expect(todoSidebarListProps).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [],
      hasAnyItemsRaw: false,
      hasActiveFilters: false,
    }))

    mounted.unmount()
  })

  it('uses completedDateRange for completed and abandoned items instead of broad pending dateRange', async () => {
    const completedItem: Item = {
      ...pendingItem,
      id: 'item-2',
      blockId: 'block-2',
      status: 'completed',
      date: '2026-05-01',
    }
    const abandonedItem: Item = {
      ...pendingItem,
      id: 'item-3',
      blockId: 'block-3',
      status: 'abandoned',
      date: '2026-05-01',
    }

    mockProjectStore.getFilteredAndSortedItems.mockReturnValue([pendingItem, completedItem, abandonedItem])
    mockProjectStore.getFilteredCompletedItems.mockReturnValue([completedItem])
    mockProjectStore.getFilteredAbandonedItems.mockReturnValue([abandonedItem])

    const mounted = mountSidebar({
      dateRange: {
        start: '1970-01-01',
        end: '2026-05-01',
      },
      completedDateRange: {
        start: '2026-05-01',
        end: '2026-05-01',
      },
    })

    await nextTick()

    expect(mockProjectStore.getFilteredCompletedItems).toHaveBeenCalledWith(expect.objectContaining({
      dateRange: {
        start: '2026-05-01',
        end: '2026-05-01',
      },
    }))
    expect(mockProjectStore.getFilteredAbandonedItems).toHaveBeenCalledWith(expect.objectContaining({
      dateRange: {
        start: '2026-05-01',
        end: '2026-05-01',
      },
    }))
    expect(todoSidebarListProps).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [
        expect.objectContaining({
          id: 'item-1',
          status: 'pending',
        }),
        expect.objectContaining({
          id: 'item-2',
          status: 'completed',
        }),
        expect.objectContaining({
          id: 'item-3',
          status: 'abandoned',
        }),
      ],
    }))

    mounted.unmount()
  })
})
