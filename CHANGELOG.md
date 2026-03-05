# Changelog

## [0.7.0] - 2026-03-04

### Features

- **MCP 服务器**：内置 `sy-bullet-journal-assistant`，提供 `list_groups`、`list_projects`、`filter_items` 三个工具，供 Cursor、Claude 等 AI 助手调用思源子弹笔记数据
- 插件设置中「复制 MCP 配置」生成的 JSON 包含 `SIYUAN_TOKEN` 与 `SIYUAN_API_URL`（默认 `http://127.0.0.1:6806`）

### Docs

- README / README_zh_CN：MCP 配置说明补充 `SIYUAN_API_URL`（可选，默认 `http://127.0.0.1:6806`）

### Dev / Test

- 集成测试支持从 `.env` 读取 `SIYUAN_TOKEN`、`SIYUAN_API_URL`（vitest 通过 dotenv 加载）
- 新增 `test/mcp/filterItems.test.ts`、`test/mcp/listProjects.test.ts`，含纯函数单测与可选思源 API 集成测试

## [0.6.0] - 2026-03-03

### Features

- 待办侧栏各分组统一支持右键菜单和 hover 操作按钮（已过期/今日/明日/未来：完成、迁移、放弃、详情、日历；已完成/已放弃：详情、日历）
- 详情弹框优化：垂直卡片式布局、时长旁添加复制按钮、图标样式与工具提示

### Fixes

- 统一详情弹框标题为「事项详情」
- 国际化修复：使用 `window.siyuan.config.lang` 检测语言；修复 en_US 等 locale 大小写不敏感匹配；右键菜单改用 `t()` 随思源语言切换

### Styles

- 适配 FullCalendar 样式以匹配思源主题
- 日历事件任务文字使用主题变量 `--b3-theme-on-background` 提升可读性
- 优化卡片标题样式与对话框按钮垂直对齐

### CI

- 发布工作流改为草稿模式

## [0.5.1] - 2026-03-02

### Features

- 目录配置为空时自动扫描所有含 `#任务` / `#task` 标记的文档，无需配置目录即可使用
- 设置项按重要性排序：目录配置 → 分组管理 → 午休时间
- 目录配置说明文案优化：明确为项目文件父目录，并提示可通过文档树右键「设置为子弹笔记目录」添加

### Fixes

- 设置弹框打开时不再自动聚焦到第一个目录输入框（对首个路径输入做 focus 防抖）
- 在设置中删除全部目录后，日历/甘特图/项目/待办视图会自动刷新为「扫描所有文档」结果

### Refactors

- 「目录为空」时 getAllDocs 仅查询 content 含 `#任务` 或 `#task` 的 block（type 限定 p/h/l/i），按 root_id 聚合成文档列表再解析，减少无效 API 与解析
- 各 Tab/Dock 始终调用 loadProjects/refresh 并传入 enabledDirectories（可为空），由解析器内部区分按目录过滤与扫描全部

### Docs

- README 增加甘特图、事项详情弹窗截图链接

## [0.5.0] - 2026-03-01

### Features

- 支持通过文档树右键菜单添加扫描目录

### Fixes

- 使用共享 Pinia 实例解决多 tab 间 store 不同步问题
- 修复打开标签页时缺少类型数据的问题
- 修复删除分组时未清理关联目录和默认分组的问题

### Refactors

- 重新组织设置项顺序并优化目录配置UI
- 移除默认视图功能及相关代码
- 重构分组筛选逻辑为视图独立管理
- 重构数据刷新机制以支持完整设置同步
