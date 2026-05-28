// @vitest-environment happy-dom

import {
  createPinia,
  getActivePinia,
  setActivePinia,
} from 'pinia'
import {
  beforeEach,
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
} from 'vue'
import { initI18n } from '@/i18n'
import {
  useProjectStore,
  useSettingsStore,
} from '@/stores'

vi.mock('@/components/todo/TodoFilterBar.vue', () => ({
  default: defineComponent({
    name: 'TodoFilterBarStub',
    props: ['selectedGroup'],
    setup() {
      return () => h('div', { 'data-testid': 'todo-filter-bar-stub' }, 'todo-filter-bar')
    },
  }),
}))

async function mountDialog(options?: {
  initialConfig?: Record<string, unknown>
  onConfirm?: ReturnType<typeof vi.fn>
  onCancel?: ReturnType<typeof vi.fn>
}) {
  const { default: TodoWidgetConfigDialog } = await import('@/components/workbench/dialogs/TodoWidgetConfigDialog.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)

  const onConfirm = options?.onConfirm ?? vi.fn()
  const onCancel = options?.onCancel ?? vi.fn()

  const app = createApp(TodoWidgetConfigDialog, {
    initialConfig: options?.initialConfig ?? {},
    onConfirm,
    onCancel,
  })

  app.use(getActivePinia()!)
  app.mount(container)
  await nextTick()

  return {
    container,
    onConfirm,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('todoWidgetConfigDialog', () => {
  beforeEach(() => {
    initI18n('en_US')
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    vi.clearAllMocks()

    const settingsStore = useSettingsStore()
    settingsStore.groups = [
      {
        id: 'group-a',
        name: 'Group A',
        enabled: true,
        paths: [],
      },
    ] as any

    const projectStore = useProjectStore()
    projectStore.currentDate = '2026-05-08'
    projectStore.projects = [
      {
        id: 'project-1',
        name: 'Project A',
        groupId: 'group-a',
        path: '/project-a',
        tasks: [
          {
            id: 'task-1',
            name: 'Task A',
            items: [
              {
                id: 'item-1',
                date: '2026-05-08',
                content: 'Alpha item',
                status: 'pending',
                tags: ['Alpha'],
              },
              {
                id: 'item-2',
                date: '2026-05-08',
                content: 'Beta item',
                status: 'pending',
                tags: ['Beta'],
              },
              {
                id: 'item-3',
                date: '2026-05-08',
                content: 'Alpha second item',
                status: 'pending',
                tags: ['Alpha'],
              },
            ],
          },
        ],
      },
    ] as any
  })

  it('confirms selected preset tags', async () => {
    const mounted = await mountDialog({
      initialConfig: {
        preset: {
          groupId: 'group-a',
          selectedTags: ['Alpha'],
        },
      },
    })

    expect(mounted.container.textContent).toContain('#Alpha')

    const removeAlphaButton = Array.from(mounted.container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('#Alpha')) as HTMLButtonElement
    removeAlphaButton.click()
    await nextTick()

    const tagInput = mounted.container.querySelector('[data-testid="todo-widget-tag-filter"] input') as HTMLInputElement
    tagInput.dispatchEvent(new Event('focus'))
    await nextTick()

    const tagOptions = Array.from(mounted.container.querySelectorAll('.tag-option'))
    expect(tagOptions.length).toBeGreaterThan(0)

    const betaOption = Array.from(mounted.container.querySelectorAll('.tag-option'))
      .find((option) => option.textContent?.includes('#Beta')) as HTMLButtonElement
    betaOption.click()
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-widget-config-confirm"]') as HTMLButtonElement).click()

    expect(mounted.onConfirm).toHaveBeenCalledWith({
      preset: expect.objectContaining({
        groupId: 'group-a',
        selectedTags: ['Beta'],
      }),
    })

    mounted.unmount()
  })
})
