import type { McpCache } from '@/mcp/kernelTools'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  collectPomodoros,
  filterPomodoros,

  toolFilterItems,
  toolListGroups,
  toolListProjects,
} from '@/mcp/kernelTools'

function makeCache(overrides?: Partial<McpCache>): McpCache {
  return {
    version: 1,
    updatedAt: '2026-05-11T00:00:00.000Z',
    groups: [
      {
        id: 'g1',
        name: '工作',
      },
      {
        id: 'g2',
        name: '个人',
      },
    ],
    projects: [
      {
        id: 'p1',
        name: '项目A',
        description: undefined,
        path: '/a',
        groupId: 'g1',
        taskCount: 2,
      },
      {
        id: 'p2',
        name: '项目B',
        description: undefined,
        path: '/b',
        groupId: 'g2',
        taskCount: 1,
      },
    ],
    items: [
      {
        id: 'i1',
        content: '任务1',
        date: '2026-05-11',
        startDateTime: undefined,
        endDateTime: undefined,
        status: 'pending',
        projectName: '项目A',
        taskName: undefined,
        projectId: 'p1',
        links: undefined,
        pomodoros: [
          {
            id: 'pom1',
            date: '2026-05-11',
            startTime: '09:00:00',
            endTime: '09:25:00',
            durationMinutes: 25,
            actualDurationMinutes: undefined,
            description: undefined,
          },
        ],
      },
      {
        id: 'i2',
        content: '任务2',
        date: '2026-05-10',
        startDateTime: undefined,
        endDateTime: undefined,
        status: 'completed',
        projectName: '项目A',
        taskName: undefined,
        projectId: 'p1',
        links: undefined,
        pomodoros: [],
      },
      {
        id: 'i3',
        content: '任务3',
        date: '2026-05-11',
        startDateTime: undefined,
        endDateTime: undefined,
        status: 'pending',
        projectName: '项目B',
        taskName: undefined,
        projectId: 'p2',
        links: undefined,
        pomodoros: [
          {
            id: 'pom2',
            date: '2026-05-11',
            startTime: '14:00:00',
            endTime: '14:25:00',
            durationMinutes: 25,
            actualDurationMinutes: 20,
            description: undefined,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('kernelTools', () => {
  describe('toolListGroups', () => {
    it('returns all groups', () => {
      const cache = makeCache()
      const result = toolListGroups({}, cache)
      expect(result.groups).toHaveLength(2)
      expect(result.groups[0].name).toBe('工作')
    })
  })

  describe('toolListProjects', () => {
    it('returns all projects without filter', () => {
      const cache = makeCache()
      const result = toolListProjects({}, cache)
      expect(result.projects).toHaveLength(2)
    })

    it('filters by groupId', () => {
      const cache = makeCache()
      const result = toolListProjects({ groupId: 'g1' }, cache)
      expect(result.projects).toHaveLength(1)
      expect(result.projects[0].name).toBe('项目A')
    })
  })

  describe('toolFilterItems', () => {
    it('returns all items without filter', () => {
      const cache = makeCache()
      const result = toolFilterItems({}, cache)
      expect(result.items).toHaveLength(3)
    })

    it('filters by projectId', () => {
      const cache = makeCache()
      const result = toolFilterItems({ projectId: 'p1' }, cache)
      expect(result.items).toHaveLength(2)
    })

    it('filters by projectIds array', () => {
      const cache = makeCache()
      const result = toolFilterItems({ projectIds: ['p1', 'p2'] }, cache)
      expect(result.items).toHaveLength(3)
    })

    it('filters by groupId', () => {
      const cache = makeCache()
      const result = toolFilterItems({ groupId: 'g1' }, cache)
      expect(result.items).toHaveLength(2)
      expect(result.items.every((i) => {
        return i.projectId === 'p1'
      })).toBe(true)
    })

    it('filters by date range', () => {
      const cache = makeCache()
      const result = toolFilterItems({
        startDate: '2026-05-11',
        endDate: '2026-05-11',
      }, cache)
      expect(result.items).toHaveLength(2)
    })

    it('filters by status', () => {
      const cache = makeCache()
      const result = toolFilterItems({ status: 'completed' }, cache)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('i2')
    })

    it('combines multiple filters', () => {
      const cache = makeCache()
      const result = toolFilterItems({
        projectId: 'p1',
        status: 'pending',
      }, cache)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('i1')
    })
  })

  describe('collectPomodoros', () => {
    it('collects pomodoros from all items with dedup', () => {
      const cache = makeCache()
      const result = collectPomodoros(cache)
      expect(result).toHaveLength(2)
    })
  })

  describe('filterPomodoros', () => {
    it('filters by date range', () => {
      const pomodoros = [
        {
          id: '1',
          date: '2026-05-10',
          startTime: '09:00:00',
          projectId: 'p1',
        },
        {
          id: '2',
          date: '2026-05-11',
          startTime: '10:00:00',
          projectId: 'p1',
        },
      ]
      const result = filterPomodoros(pomodoros, {
        startDate: '2026-05-11',
        endDate: '2026-05-11',
      })
      expect(result).toHaveLength(1)
    })

    it('filters by today', () => {
      const today = new Date().toISOString().slice(0, 10)
      const pomodoros = [
        {
          id: '1',
          date: today,
          startTime: '09:00:00',
          projectId: 'p1',
        },
        {
          id: '2',
          date: '2020-01-01',
          startTime: '10:00:00',
          projectId: 'p1',
        },
      ]
      const result = filterPomodoros(pomodoros, { date: 'today' })
      expect(result).toHaveLength(1)
    })
  })
})
