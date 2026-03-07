# 插件重命名计划：子弹笔记助手 → 任务助手

## 概述
将插件名称从"子弹笔记助手/Bullet Journal Assistant"改为"任务助手/Task Assistant"，同时"AI 助手/AI Assistant"也改为"任务助手/Task Assistant"。

## 需要修改的文件清单

### 1. plugin.json - 插件主配置
| 字段 | 原值 | 新值 |
|------|------|------|
| displayName.default | Bullet Journal Assistant | Task Assistant |
| displayName.zh_CN | 子弹笔记助手 | 任务助手 |
| description.default | Bullet Journal style task management... | Task assistant for managing your todos and projects |
| description.zh_CN | 子弹笔记风格任务管理... | 任务管理助手，日历、甘特图、项目视图一应俱全 |

### 2. package.json - 包描述
| 字段 | 原值 | 新值 |
|------|------|------|
| description | Bullet Journal Assistant plugin for SiYuan | Task Assistant plugin for SiYuan |

### 3. src/i18n/zh_CN.json - 中文国际化
| 字段 | 原值 | 新值 |
|------|------|------|
| title | 子弹笔记助手 | 任务助手 |
| aiChat.title | AI 助手 | 任务助手 |
| aiChat.emptyDesc | 向 AI 助手询问... | 向任务助手询问... |
| settings.dirConfig.description | 配置项目文件...子弹笔记目录... | 配置项目文件...任务助手目录... |
| settings.mcp.description | 将子弹笔记数据暴露给...AI 助手... | 将任务数据暴露给...AI 助手... |
| common.dirsSet | 已设置 {count} 个子弹笔记目录 | 已设置 {count} 个任务助手目录 |

### 4. src/i18n/en_US.json - 英文国际化
| 字段 | 原值 | 新值 |
|------|------|------|
| title | Bullet Journal Assistant | Task Assistant |
| aiChat.title | AI Assistant | Task Assistant |
| aiChat.emptyDesc | Ask the AI assistant... | Ask the task assistant... |
| settings.dirConfig.description | Configure parent directories...bullet journal... | Configure parent directories...task assistant... |
| settings.mcp.description | Expose bullet journal data... | Expose task data... |
| common.dirsSet | {count} bullet journal directories set | {count} task assistant directories set |

### 5. src/components/ai/ChatMessage.vue
- 第 201 行: `'AI 助手'` → `'任务助手'`

### 6. src/components/ai/ChatPanel.vue
- 第 40 行: `AI 助手` → `任务助手`
- 第 485 行: `**AI 助手**` → `**任务助手**`

### 7. src/services/aiService.ts
- 第 9 行: `你是一个子弹笔记助手` → `你是一个任务助手`
- 第 11 行: `## 子弹笔记数据结构` → `## 任务数据结构`

### 8. src/stores/aiStore.ts
- 第 154 行: `你是一个子弹笔记助手` → `你是一个任务助手`
- 第 158 行: `你可以使用以下工具来查询用户的子弹笔记数据` → `你可以使用以下工具来查询用户的任务数据`

### 9. src/services/aiTools.ts
- 第 3 行注释: `为 AI 提供查询子弹笔记数据的能力` → `为 AI 提供查询任务数据的能力`
- 第 14 行: `查询子弹笔记中配置的所有分组` → `查询任务助手中配置的所有分组`
- 第 30 行: `查询子弹笔记中的所有项目` → `查询任务助手中的所有项目`
- 第 51 行: `按项目、时间范围、分组、状态筛选子弹笔记事项` → `按项目、时间范围、分组、状态筛选任务事项`

### 10. src/settings/mcpConfig.ts
- 第 8 行: `将子弹笔记数据暴露给...` → `将任务数据暴露给...`

### 11. src/index.ts
- 第 307 行: `设置为子弹笔记目录` → `设置为任务助手目录`
- 第 345 行: `已设置 {count} 个子弹笔记目录` → `已设置 {count} 个任务助手目录`

### 12. src/index.scss
- 第 1 行: `/* 子弹笔记插件全局样式 */` → `/* 任务助手插件全局样式 */`

### 13. src/mcp/server.ts
- 第 3 行注释: `子弹笔记 MCP 服务器` → `任务助手 MCP 服务器`
- 第 34 行: `查询子弹笔记中配置的所有分组` → `查询任务助手中配置的所有分组`
- 第 48 行: `查询子弹笔记中的所有项目` → `查询任务助手中的所有项目`
- 第 65 行: `按项目、时间范围、分组、状态筛选子弹笔记事项` → `按项目、时间范围、分组、状态筛选任务事项`

### 14. src/parser/markdownParser.ts
- 第 21 行: `[Bullet Journal][Parser] 开始解析项目` → `[Task Assistant][Parser] 开始解析项目`
- 第 68 行: `[Bullet Journal][Parser] 解析完成` → `[Task Assistant][Parser] 解析完成`
- 第 78 行: `[Bullet Journal][Parser] 目录为空` → `[Task Assistant][Parser] 目录为空`
- 第 94 行: `[Bullet Journal][Parser] 查询到的文档数量` → `[Task Assistant][Parser] 查询到的文档数量`

### 15. 所有文件中的日志前缀 [Bullet Journal]
需要将所有 `[Bullet Journal]` 日志前缀改为 `[Task Assistant]`，涉及文件：
- src/index.ts
- src/stores/projectStore.ts
- src/utils/fileUtils.ts
- src/utils/dialog.ts
- src/utils/eventBus.ts
- src/components/calendar/CalendarView.vue
- src/components/todo/TodoSidebar.vue
- src/tabs/CalendarTab.vue
- src/mcp/config.ts
- src/mcp/siyuan-client.ts

### 16. README_zh_CN.md - 中文 README
| 位置 | 原值 | 新值 |
|------|------|------|
| 标题 | 子弹笔记助手 | 任务助手 |
| 第 7 行 | 采用子弹笔记风格的任务管理插件 | 任务管理插件 |
| 第 17 行 | 内置 `sy-bullet-journal-assistant` | 内置 `sy-task-assistant` |
| 第 93 行 | 搜索「子弹笔记」 | 搜索「任务助手」 |
| 第 106 行 | 「设置为子弹笔记目录」 | 「设置为任务助手目录」 |
| 第 113 行 | 插件内置 MCP 服务器（`sy-bullet-journal-assistant`），可将子弹笔记数据暴露给... | 插件内置 MCP 服务器（`sy-task-assistant`），可将任务数据暴露给... |
| 第 130-160 行 AI 提示词 | 多处"子弹笔记" | 改为"任务助手"或"任务" |

### 17. README.md - 英文 README
| 位置 | 原值 | 新值 |
|------|------|------|
| 标题 | Bullet Journal Assistant - SiYuan Plugin | Task Assistant - SiYuan Plugin |
| 第 7 行 | A Bullet Journal style task management plugin | A task management plugin |
| 第 18 行 | Built-in `sy-bullet-journal-assistant` | Built-in `sy-task-assistant` |
| 第 93 行 | Search for "Bullet Journal" | Search for "Task Assistant" |
| 第 106 行 | "Set as Bullet Journal directory" | "Set as Task Assistant directory" |
| 第 113 行 | The plugin includes an MCP server (`sy-bullet-journal-assistant`) that exposes bullet journal data... | The plugin includes an MCP server (`sy-task-assistant`) that exposes task data... |
| 第 128-159 行 AI 提示词 | 多处"bullet journal" | 改为"task assistant"或"task" |

## 执行步骤
1. 修改 plugin.json
2. 修改 package.json
3. 修改 i18n 文件 (zh_CN.json, en_US.json)
4. 修改 Vue 组件文件 (ChatMessage.vue, ChatPanel.vue)
5. 修改 Service 文件 (aiService.ts, aiTools.ts)
6. 修改 Store 文件 (aiStore.ts, projectStore.ts)
7. 修改设置文件 (mcpConfig.ts)
8. 修改主入口文件 (index.ts)
9. 修改样式文件 (index.scss)
10. 修改 MCP 相关文件 (server.ts, config.ts, siyuan-client.ts)
11. 修改解析器文件 (markdownParser.ts)
12. 修改其他工具文件 (fileUtils.ts, dialog.ts, eventBus.ts)
13. 修改日历和待办组件 (CalendarView.vue, TodoSidebar.vue, CalendarTab.vue)
