# Changelog

## [0.11.0] - 2026-03-17

### Features

- **Slash Commands**: Brand new slash command system for quick task operations
  - Built-in commands: Mark today/tomorrow/date, complete task, abandon task, view details, start focus
  - Custom commands: Support configuring custom slash commands for flexible workflow extension
- **Pomodoro Enhancements**:
  - Multi-line description support: Focus timer supports entering multi-line task descriptions
  - Focus completion dialog: Refactored completion dialog with project/task/item card display
  - Status bar progress bar: Supports gradually shortening display mode
  - Auto-append date: Automatically append date to items when focus ends
- **Date Picker Enhancements**:
  - Monday start: Calendar now starts on Monday, selected date changed to circular style
- **Settings Panel Refactor**:
  - Sidebar navigation: New settings dialog layout with left-side category navigation
  - AI Provider interaction optimization: Add/edit changed to dialog interaction
- **Empty State Guidance**:
  - Task Assistant empty state: Added empty state guidance and sample document creation
  - Focus records empty state: Added empty state guidance and sample document creation
- **Help Menu**: New help menu supporting sample document creation and help documentation viewing

### Fixes

- Fixed pomodoro record sharing issue for multi-date items

### Refactors

- Optimized slash command management logic with centralized configuration
- Optimized pomodoro data parsing and merging logic
- Use blockId instead of item reference passed to pre-selected item start focus dialog

### Styles

- Settings dialog sidebar and content area style adjustments
- Pomodoro completion dialog unified width to 600px
- Removed fade-in effect for todo item action buttons

### Tests

- Improved fileUtils unit test cases
- Added various test cases for slash command handling
- Modified focus record sharing tests for multi-date items

## [0.10.2] - 2026-03-15

### Fixes

- **Pomodoro Record Merge**: Fixed duplicate merging issue for pomodoro records of multi-date items

### CI

- Upgraded Node.js version from 20 to 22

## [0.10.1] - 2026-03-15

### Features

- **AI Chat Enhancement**: Chat messages now support one-click copy to clipboard
- **Pomodoro Abandon Feature**: Added abandon task button to timer, allowing users to mark tasks as abandoned
- **Weekly Statistics ISO Standard**: Changed weekly statistics date range calculation to use ISO week standard for international consistency

### Fixes

- **Anti-duplicate Click**: Added execution state locks for critical operations to prevent duplicate execution caused by rapid clicking
- **Tooltip Optimization**: Unified tooltip direction to northwest for better display positioning

### Styles

- Adjusted statistical chart component styling details
- Added help cursor style to tooltip icons

### Docs

- Documentation Migration: Moved CHANGELOG.md and CONTRIBUTING.md to user guide directory, added English versions
- Internationalization text optimization: Updated control button text in status bar timer description

## [0.10.0] - 2026-03-14

### Features

- **Pomodoro Statistics Enhancement**: New focus data statistics panel with five charts
  - Yearly Heatmap: Visualize focus records throughout the year
  - Focus Distribution: Donut chart showing focus time distribution by task/project
  - Focus Trend: View focus time trends by day/week/month
  - Weekly Focus Hours: Display focus distribution across time slots (24-hour heatmap)
  - Peak Productivity Analysis: Analyze the most productive time periods of the day
- **Status Bar Pomodoro**: New bottom bar countdown panel for quick focus start
- **Focus Record Storage Config**: Configure where pomodoro records are stored
  - Under item block (child block): Store records as child blocks under items
  - Item block custom attributes: Store records in item block custom attributes
- **AI Chat Optimization**:
  - Markdown rendering: Use SiYuan Lute engine instead of marked.js for better quality
- **Settings Interface Refactor**:
  - Search function: Settings panel supports searching configuration items
  - New layout: Use SySettingItem component for unified settings style
  - Optimized interactions: AI Provider config validation, save prompts, etc.

### Styles

- Theme adaptation: Full adaptation to SiYuan theme variables, supporting dark/light mode
- Component unification:
  - New generic Card component for unified card UI style
  - New SySelect component replacing native select
  - New SyButton component supporting icon buttons and link buttons

### Refactors

- Internationalization: Pomodoro module fully supports multiple languages (Chinese/English)
- Component encapsulation: Extract common components to improve code reusability

### Fixes

- Fixed collapse icon direction error

## [0.9.2] - 2026-03-11

### Fixes

- **Pomodoro**: Fixed issue where in-progress records couldn't be cleared when plugin variable was not passed, causing duplicate 🍅 records

## [0.9.1] - 2026-03-10

### Features

- **Item Status**: New "In Progress" status for task state tracking, adapted in Gantt chart, detail modal, and styles
- **Pomodoro AI Tools**: MCP/AI assistant adds `get_pomodoro_stats`, `get_pomodoro_records` tools, `filter_items` output adds `pomodoros` field
- **Calendar Enhancements**:
  - Default view config: Support configuring calendar default display view
  - Drill-down navigation: Support day/week view switching and back navigation
  - Week number display and navigation link hints
  - All-day item text localization
- **Gantt Chart Enhancements**: Optimized task click handling, event tooltips, and calendar styles
- **Item Details**: Modal changed to singleton mode, optimized date/time formatting
- **Multi-date & Status**: Enhanced multi-date item handling, optimized status emoji display
- **Todo Sidebar**: Optimized layout and item display
- **MCP Server**: Updated assistant name and configuration

### Styles

- Gantt chart tooltip padding and style consistency
- Calendar view and Gantt component padding, gap adjustments
- Calendar event display CSS optimization

### Refactors

- Optimized todo sidebar layout and item display

### Docs

- User guide, README and other documentation updates, adding new features and configuration instructions
- Chinese README link updates and content corrections

## [0.9.0] - 2026-03-09

### Features

- **Pomodoro Feature**: New Pomodoro focus timer
  - Pomodoro timer: Support custom focus duration (default 25/45/60 minutes), quick preset options
  - Floating Pomodoro button: Floating button in bottom-right corner for quick start/pause/continue
  - Pomodoro auto-recovery: Automatically restore previous focus state after page refresh or restart
  - Pomodoro records: Automatically record each focus session, track today's focus data
  - Todo item focus: Add "Focus" button to todo items for one-click Pomodoro start
  - Calendar Pomodoro status: Display daily Pomodoro completion status in calendar view
  - Notification support: Send system notifications when focus session completes

![Pomodoro Active](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/user-guide/images/pomodoro-active.png)

![Pomodoro Dock](https://b3logfile.com/file/2026/03/pomodoro-dock-CqX5NnE.png)

- **Gantt Chart Enhancements**:
  - Task text display: Show task names directly on task bars, hover for full details
  - Task context menu: Right-click tasks to view details or open in calendar
  - Day/week view optimization: Improved task display at different time granularities

- **Calendar Enhancements**:
  - Day view navigation: Support day view switching and back button
  - Pomodoro status display: Show 🍅 icon for items in focus

- **Documentation Update "Bullet Journal"**: Plugin name updated to "Task Assistant"

### Fixes

- Fixed calendar navigation button tooltip direction
- Fixed task list link name parsing error

### Refactors

- Optimized parent block Kramdown parsing logic

## [0.8.1] - 2026-03-08

### Features

- **AI Tool Enhancement**: Added `get_user_time` tool to get user's current local date and time. When users ask time-related questions like "today", "tomorrow", "this week", the task assistant will prioritize calling this tool to get accurate dates before querying task data, improving accuracy for daily reports and schedules

## [0.8.0] - 2026-03-08

### Features

- **AI Chat Feature**: Built-in Task Assistant panel with support for OpenAI, Kimi, DeepSeek, Step, Zhipu AI, and all OpenAI-compatible providers
  - Query projects, tasks, and items through conversation
  - Generate daily reports and insert into notes with one click
  - Multi-conversation management: Support creating multiple independent conversation contexts with automatic chat history saving

![AI Chat Demo](https://b3logfile.com/file/2026/03/PixPin_2026-03-08_01-11-20-aZI6SeB.gif)

![AI Chat Panel](https://b3logfile.com/file/2026/03/image-TzlXbcv.png)

## [0.7.2] - 2026-03-07

### Features

- **Multi-date Items**: Support single items associated with multiple dates for cross-day task management, format: `@2026-03-06, 2026-03-10~03-12`
- **Item Links**: Support adding external or SiYuan internal links to items (`[text](siyuan://blocks/ID)` format), clickable in detail modal
- **Item Details Enhancement**: Added item status display in detail modal, new item links
- **Calendar/Todo Sidebar Enhancement**: Added status emoji display for each item
- **Refresh Prompt**: Added completion prompt for refresh operation to improve user experience

### Fixes

- Fixed issue where project name was overwritten by subsequent H2 headings
- Optimized migration menu date condition display logic

### Styles

- Adjusted todo sidebar item spacing and font size
- Optimized dialog and label style layout
- Adjusted status label and card layout styles

### Refactors

- Improved multi-line content parsing logic and optimized date handling

### Dev / Test

- Added integration test cases for multi-date items
- Added parsing test cases for ordered and unordered lists

## [0.7.1] - 2026-03-05

### Features

- Parser: Added `stripListAndBlockAttr` function to remove list markers (`-`, `1.`, etc.) and inline block attributes from list items, ensuring correct task name/item content parsing

### Fixes

- Fixed issue where calendar view jumped to target date but header date title didn't update when clicking "Open in Calendar" from todo sidebar

## [0.7.0] - 2026-03-05

### Features

- **MCP Server**: Built-in `sy-task-assistant` with three tools: `list_groups`, `list_projects`, `filter_items` for AI assistants like Cursor and Claude to access SiYuan task assistant data
- Plugin settings "Copy MCP Config" generates JSON with `SIYUAN_TOKEN` and `SIYUAN_API_URL` (default `http://127.0.0.1:6806`)

### Docs

- README / README_zh_CN: MCP configuration instructions added `SIYUAN_API_URL` (optional, default `http://127.0.0.1:6806`)

### Dev / Test

- Integration tests support reading `SIYUAN_TOKEN`, `SIYUAN_API_URL` from `.env` (vitest loads via dotenv)
- Added `test/mcp/filterItems.test.ts`, `test/mcp/listProjects.test.ts` with pure function unit tests and optional SiYuan API integration tests

## [0.6.0] - 2026-03-03

### Features

- Todo sidebar groups unified support for right-click menu and hover action buttons (Overdue/Today/Tomorrow/Future: complete, migrate, abandon, details, calendar; Completed/Abandoned: details, calendar)
- Detail modal optimization: Vertical card layout, copy button next to duration, icon styles and tooltips

### Fixes

- Unified detail modal title to "Item Details"
- Internationalization fix: Use `window.siyuan.config.lang` for language detection; fixed en_US and other locale case-insensitive matching; context menu uses `t()` to follow SiYuan language switching

### Styles

- Adapted FullCalendar styles to match SiYuan theme
- Calendar event task text uses theme variable `--b3-theme-on-background` for better readability
- Optimized card title styles and dialog button vertical alignment

### CI

- Release workflow changed to draft mode

## [0.5.1] - 2026-03-02

### Features

- When directory config is empty, automatically scan all documents containing `#任务` / `#task` markers, no directory config needed to use
- Settings items sorted by importance: Directory Config → Group Management → Lunch Break Time
- Directory config description optimization: Clarified as project file parent directory, with hint to add via document tree right-click "Set as Task Assistant directory"

### Fixes

- Settings modal no longer auto-focuses first directory input field (focus debounce for first path input)
- After deleting all directories in settings, calendar/Gantt/project/todo views automatically refresh to "scan all documents" results

### Refactors

- When "directory is empty", getAllDocs only queries blocks with content containing `#任务` or `#task` (type limited to p/h/l/i), aggregates by root_id into document list before parsing, reducing invalid API calls and parsing
- All Tabs/Docks always call loadProjects/refresh with enabledDirectories (can be empty), parser internally distinguishes between directory filtering and scanning all

### Docs

- README added Gantt chart and item detail modal screenshot links

## [0.5.0] - 2026-03-01

### Features

- Support adding scan directories via document tree right-click menu

### Fixes

- Use shared Pinia instance to solve store synchronization issues between tabs
- Fixed missing type data when opening tabs
- Fixed issue where associated directories and default groups weren't cleaned up when deleting groups

### Refactors

- Reorganized settings item order and optimized directory config UI
- Removed default view feature and related code
- Refactored group filtering logic to view-independent management
- Refactored data refresh mechanism to support complete settings synchronization
