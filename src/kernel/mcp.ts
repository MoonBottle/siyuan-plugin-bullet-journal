import type { KernelData } from './types'
import {
  collectPomodoros,
  filterPomodoros,
  toolFilterItems,
  toolListGroups,
  toolListProjects,
} from './mcpTools'

const KERNEL_DATA_PATH = 'kernel-data.json'
const SERVER_NAME = 'sy-task-assistant'
const SERVER_VERSION = '1.0.0'

let activePort: SseRequest['port'] | null = null
let sessionId = ''

async function loadCache(): Promise<KernelData> {
  try {
    const file = await siyuan.storage.get(KERNEL_DATA_PATH)
    const text = await file.text()
    const data = JSON.parse(text) as KernelData
    return data
  } catch (_e: any) {
    throw new Error('内核数据不可用。请先打开思源笔记并确保任务助手插件已加载。')
  }
}

function makeJsonRpcResult(id: any, result: any) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

function makeJsonRpcError(id: any, code: number, message: string) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  }
}

const TOOLS = [
  {
    name: 'list_groups',
    description:
      '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
    inputSchema: {
      type: 'object',
      properties: {} as Record<string, any>,
      required: [],
    },
  },
  {
    name: 'list_projects',
    description:
      '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目',
        },
      },
      required: [],
    },
  },
  {
    name: 'filter_items',
    description:
      '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目文档 ID，来自 list_projects 返回的 id',
        },
        projectIds: {
          type: 'array',
          items: { type: 'string' },
          description: '项目 ID 数组，多选时使用',
        },
        groupId: {
          type: 'string',
          description: '分组 ID，来自 list_groups 返回的 id',
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD',
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD',
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'abandoned'],
          description: 'pending=待办, completed=已完成, abandoned=已放弃',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_pomodoro_stats',
    description:
      '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选）。返回今日/指定范围的番茄数、专注分钟数。',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          enum: ['today'],
          description: '设为 "today" 时查询今日统计',
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD',
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD',
        },
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_pomodoro_records',
    description:
      '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          enum: ['today'],
          description: '设为 "today" 时查询今日记录',
        },
        startDate: {
          type: 'string',
          description: '起始日期，格式 YYYY-MM-DD',
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD',
        },
        projectId: {
          type: 'string',
          description: '项目 ID，来自 list_projects 返回的 id',
        },
      },
      required: [],
    },
  },
]

function toolGetPomodoroStats(args: any, cache: KernelData) {
  const pomodoros = filterPomodoros(collectPomodoros(cache), args)
  const todayDate = new Date().toISOString().slice(0, 10)

  let todayCount = 0
  let todayMinutes = 0
  for (const p of pomodoros) {
    if (p.date === todayDate) {
      todayCount++
      todayMinutes += p.actualDurationMinutes || p.durationMinutes
    }
  }

  let totalMinutes = 0
  for (const p of pomodoros) {
    totalMinutes += p.actualDurationMinutes || p.durationMinutes
  }

  const result: any = {
    todayCount,
    todayMinutes,
    totalCount: pomodoros.length,
    totalMinutes,
  }

  let startDate = args.startDate
  let endDate = args.endDate
  if (args.date === 'today') {
    startDate = todayDate
    endDate = todayDate
  }
  if (startDate && endDate) {
    result.dateRange = {
      startDate,
      endDate,
    }
  }
  if (args.projectId) {
    result.projectId = args.projectId
  }

  return result
}

function toolGetPomodoroRecords(args: any, cache: KernelData) {
  const pomodoros = filterPomodoros(collectPomodoros(cache), args)

  const records = pomodoros.map((p) => {
    return {
      id: p.id,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      durationMinutes: p.durationMinutes,
      actualDurationMinutes: p.actualDurationMinutes,
      itemContent: p.itemContent,
      projectName: p.projectName,
      description: p.description,
    }
  })

  records.sort((a, b) => {
    const dc = a.date.localeCompare(b.date)
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime)
  })

  return { records }
}

async function handleToolCall(name: string, args: any, id: any) {
  let cache: KernelData
  try {
    cache = await loadCache()
  } catch (e: any) {
    return makeJsonRpcError(id, -32000, e.message || String(e))
  }

  let result: any
  switch (name) {
    case 'list_groups':
      result = toolListGroups(args, cache)
      break
    case 'list_projects':
      result = toolListProjects(args, cache)
      break
    case 'filter_items':
      result = toolFilterItems(args, cache)
      break
    case 'get_pomodoro_stats':
      result = toolGetPomodoroStats(args, cache)
      break
    case 'get_pomodoro_records':
      result = toolGetPomodoroRecords(args, cache)
      break
    default:
      return makeJsonRpcError(id, -32601, `Method not found: ${name}`)
  }

  return makeJsonRpcResult(id, {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  })
}

async function handleJsonRpc(message: any): Promise<any> {
  if (!message || message.jsonrpc !== '2.0') {
    return makeJsonRpcError(null, -32600, 'Invalid Request')
  }

  const id = message.id
  const method = message.method

  switch (method) {
    case 'initialize':
      return makeJsonRpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      })

    case 'notifications/initialized':
      return undefined

    case 'ping':
      return makeJsonRpcResult(id, {})

    case 'tools/list':
      return makeJsonRpcResult(id, { tools: TOOLS })

    case 'tools/call': {
      const params = message.params || {}
      return handleToolCall(params.name, params.arguments || {}, id)
    }

    default:
      return makeJsonRpcError(id, -32601, `Method not found: ${method}`)
  }
}

export function initMcpServer(): void {
  siyuan.server.private.es.handler = async function (req: SseRequest) {
    req.port.onopen = async function (_event) {
      if (activePort && activePort !== req.port) {
        try {
          activePort.close()
        } catch {}
      }
      activePort = req.port
      sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2)
      await siyuan.logger.info('[mcp] SSE connection opened, sid:', sessionId)
    }

    req.port.onclose = async function (_event) {
      if (activePort === req.port) {
        activePort = null
        sessionId = ''
      }
      await siyuan.logger.info('[mcp] SSE connection closed')
    }
  }

  siyuan.server.private.http.handler = async function (req: HttpRequest) {
    const bodyData = req.request.body.data
    if (!bodyData) {
      await siyuan.logger.warn('[mcp] HTTP handler: no body', req.url.path)
      return {
        statusCode: 400,
        body: {
          data: {
            type: 'JSON',
            data: { error: 'no body' },
          },
        },
      }
    }

    let message: any
    try {
      message = await bodyData.json()
    } catch {
      await siyuan.logger.warn('[mcp] HTTP handler: JSON parse error')
      return {
        statusCode: 400,
        body: {
          data: {
            type: 'JSON',
            data: {
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: 'Parse error' },
            },
          },
        },
      }
    }

    await siyuan.logger.info('[mcp] HTTP handler:', message.method, message.id)

    const response = await handleJsonRpc(message)

    const sid = req.url.query?.sid?.[0]
    if (sid && sid === sessionId) {
      if (response !== undefined) {
        if (activePort) {
          activePort.send('message', JSON.stringify(response))
        } else {
          await siyuan.logger.warn('[mcp] Response dropped: SSE connection closed')
        }
      }
      return {
        statusCode: 202,
        headers: {},
      }
    }

    if (response === undefined) {
      await siyuan.logger.info('[mcp] HTTP handler: notification, returning 202')
      return {
        statusCode: 202,
        headers: {},
      }
    }

    const responseBody = JSON.stringify(response)
    await siyuan.logger.info('[mcp] HTTP handler: responding', message.method, responseBody.length, 'bytes')

    return {
      statusCode: 200,
      body: {
        raw: {
          contentType: 'application/json',
          data: responseBody,
        },
      },
    }
  }
}

export function closeMcpServer(): void {
  if (activePort) {
    try {
      activePort.close()
    } catch {}
    activePort = null
    sessionId = ''
  }
}
