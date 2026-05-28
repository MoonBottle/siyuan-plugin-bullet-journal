import type {
  Item,
  Project,
  Task,
} from '@/types/models'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
// @vitest-environment happy-dom
import {
  createApp,
  nextTick,
} from 'vue'

vi.mock('@/components/dialog/ItemDetailContent.vue', () => ({
  default: {
    props: ['item', 'embedded'],
    template: '<div data-testid="item-detail-content" :data-embedded="embedded ? \'true\' : \'false\'">{{ item?.content }}</div>',
  },
}))

vi.mock('@/components/todo/ItemActionBar.vue', () => ({
  default: {
    props: ['item'],
    template: '<div data-testid="item-action-bar">{{ item?.content }}</div>',
  },
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'project') {
      return {
        noProjectsData: '暂无项目数据',
        configureDirHint: '请在设置中配置笔记本目录',
        dirStructureHint: '项目文档需放置在 工作安排/YYYY/项目/ 目录下',
        searchPlaceholder: '搜索项目...',
        treeSearchPlaceholder: '搜索任务或事项...',
        noProjectMatches: '没有匹配的项目',
        noTaskMatches: '没有匹配的任务或事项',
        noTasks: '暂无任务',
        selectProjectPrompt: '请选择项目',
        selectDetailPrompt: '选择任务或事项查看详情',
        taskCount: '任务数',
        itemsLabel: '事项',
        taskDetail: '任务详情',
        pendingCount: '待办',
        completedCount: '已完成',
        abandonedCount: '已放弃',
        openDocument: '打开文档',
      }
    }
    if (key === 'common') return { clear: '清除' }
    if (key === 'todo') { return {
      project: '项目',
      task: '任务',
      item: '事项',
    }
    }
    return {}
  }),
}))

function makeItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId || 'block-1',
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    task: partial.task,
    project: partial.project,
  } as Item
}

function makeTask(partial: Partial<Task>): Task {
  const base = {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId || 'task-block',
  } as Task
  base.items.forEach((row) => {
    row.task = base
  })
  return base
}

function makeProject(partial: Partial<Project>): Project {
  const base = {
    id: partial.id || 'project',
    name: partial.name || '项目',
    description: partial.description,
    path: partial.path || '工作安排/2026/项目',
    tasks: partial.tasks || [],
    habits: [],
    links: partial.links,
  } as Project
  base.tasks.forEach((task) => {
    task.items.forEach((row) => {
      row.project = base
      row.task = task
    })
  })
  return base
}

async function mountProjectView(projects: Project[]) {
  const { default: ProjectView } = await import('@/components/project/ProjectView.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ProjectView, { projects })
  app.mount(container)
  await nextTick()
  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('projectView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('有项目时渲染三栏布局并默认选中第一个项目', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [makeTask({ name: '任务 A' })],
      }),
      makeProject({
        id: 'p2',
        name: '项目 Beta',
        tasks: [makeTask({ name: '任务 B' })],
      }),
    ])

    expect(mounted.container.querySelector('.project-workbench')).not.toBeNull()
    expect(mounted.container.querySelector('.project-list-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-tree-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-detail-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-list-row--active')?.textContent).toContain('项目 Alpha')
    expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('任务 A')

    mounted.unmount()
  })

  it('左栏搜索按项目名称、描述和路径过滤项目列表', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '移动端',
        description: '手机体验',
        path: '工作安排/2026/mobile',
      }),
      makeProject({
        id: 'p2',
        name: '桌面端',
        description: '项目工作台',
        path: '工作安排/2026/desktop',
      }),
    ])

    const input = mounted.container.querySelector('[data-testid="project-search-input"]') as HTMLInputElement
    input.value = 'desktop'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('.project-list-pane')?.textContent).not.toContain('移动端')
    expect(mounted.container.querySelector('.project-list-pane')?.textContent).toContain('桌面端')
    expect(mounted.container.querySelector('.project-list-row--active')?.textContent).toContain('桌面端')

    mounted.unmount()
  })

  it('展示当前项目任务树并按 L1/L2/L3 层级渲染', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [
          makeTask({
            id: 'l1',
            name: '一级任务',
            level: 'L1',
          }),
          makeTask({
            id: 'l2',
            name: '二级任务',
            level: 'L2',
          }),
          makeTask({
            id: 'l3',
            name: '三级任务',
            level: 'L3',
            items: [makeItem({
              id: 'item-1',
              content: '交付事项',
            })],
          }),
        ],
      }),
    ])

    expect(mounted.container.querySelector('[data-task-id="l1"]')?.textContent).toContain('一级任务')
    expect(mounted.container.querySelector('[data-task-id="l2"]')?.getAttribute('data-depth')).toBe('1')
    expect(mounted.container.querySelector('[data-task-id="l3"]')?.getAttribute('data-depth')).toBe('2')
    expect(mounted.container.querySelector('[data-item-id="item-1"]')?.textContent).toContain('交付事项')

    mounted.unmount()
  })

  it('中栏搜索命中事项时保留必要父级链路并支持清空恢复', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [
          makeTask({
            id: 'l1',
            name: '一级任务',
            level: 'L1',
          }),
          makeTask({
            id: 'l2',
            name: '二级任务',
            level: 'L2',
            items: [makeItem({
              id: 'target',
              content: '会议纪要',
            })],
          }),
          makeTask({
            id: 'other',
            name: '其他任务',
            level: 'L1',
          }),
        ],
      }),
    ])

    const input = mounted.container.querySelector('[data-testid="task-tree-search-input"]') as HTMLInputElement
    input.value = '纪要'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('[data-task-id="l1"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-task-id="l2"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-item-id="target"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-task-id="other"]')).toBeNull()

    mounted.container.querySelector('.project-pane-search-box__clear')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('[data-task-id="other"]')).not.toBeNull()

    mounted.unmount()
  })

  it('任务节点默认展开并可单独折叠', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [
          makeTask({
            id: 'l1',
            name: '一级任务',
            level: 'L1',
            items: [makeItem({
              id: 'item-1',
              content: '可折叠事项',
            })],
          }),
        ],
      }),
    ])

    expect(mounted.container.querySelector('[data-item-id="item-1"]')).not.toBeNull()
    mounted.container.querySelector('[data-testid="toggle-task-l1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(mounted.container.querySelector('[data-item-id="item-1"]')).toBeNull()

    mounted.unmount()
  })

  it('点击任务后显示轻量任务详情', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [
          makeTask({
            id: 'task-1',
            name: '设计任务',
            level: 'L2',
            items: [
              makeItem({
                id: 'pending',
                status: 'pending',
              }),
              makeItem({
                id: 'done',
                status: 'completed',
              }),
            ],
          }),
        ],
      }),
    ])

    mounted.container.querySelector('[data-task-id="task-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('设计任务')
    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('L2')
    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('1/2')

    mounted.unmount()
  })

  it('点击事项后嵌入 ItemDetailContent 和 ItemActionBar', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [
          makeTask({
            id: 'task-1',
            name: '设计任务',
            items: [makeItem({
              id: 'item-1',
              content: '写实现计划',
            })],
          }),
        ],
      }),
    ])

    mounted.container.querySelector('[data-item-id="item-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('[data-testid="item-detail-content"]')?.textContent).toContain('写实现计划')
    expect(mounted.container.querySelector('[data-testid="item-detail-content"]')?.getAttribute('data-embedded')).toBe('true')
    expect(mounted.container.querySelector('[data-testid="item-action-bar"]')?.textContent).toContain('写实现计划')

    mounted.unmount()
  })

  it('切换项目后清空右栏选择', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [makeTask({
          id: 'task-1',
          name: '任务 A',
        })],
      }),
      makeProject({
        id: 'p2',
        name: '项目 Beta',
        tasks: [makeTask({
          id: 'task-2',
          name: '任务 B',
        })],
      }),
    ])

    mounted.container.querySelector('[data-task-id="task-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    mounted.container.querySelectorAll('.project-list-row')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('选择任务或事项查看详情')
    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).not.toContain('任务 A')

    mounted.unmount()
  })

  it('没有项目时显示现有项目空状态引导', async () => {
    const mounted = await mountProjectView([])

    expect(mounted.container.textContent).toContain('暂无项目数据')
    expect(mounted.container.textContent).toContain('请在设置中配置笔记本目录')
    expect(mounted.container.querySelector('.project-workbench')).toBeNull()

    mounted.unmount()
  })

  it('项目没有任务时中栏显示暂无任务', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '空项目',
        tasks: [],
      }),
    ])

    expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('暂无任务')

    mounted.unmount()
  })

  it('左栏搜索无结果时清空中栏和右栏', async () => {
    const mounted = await mountProjectView([
      makeProject({
        id: 'p1',
        name: '项目 Alpha',
        tasks: [makeTask({
          id: 'task-1',
          name: '任务 A',
        })],
      }),
    ])

    const input = mounted.container.querySelector('[data-testid="project-search-input"]') as HTMLInputElement
    input.value = '不存在'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('.project-list-pane')?.textContent).toContain('没有匹配的项目')
    expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('请选择项目')
    expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('选择任务或事项查看详情')

    mounted.unmount()
  })
})
