# 番茄钟功能 PRD

## 一、需求

### 1.1 功能概述

番茄钟功能帮助用户追踪专注时间，提供以下能力：

1. **番茄钟记录** - 在笔记中记录已完成的专注时段
2. **统计分析** - 查看今日/总专注时长和番茄数
3. **专注计时** - 在插件中直接开始专注倒计时

### 1.2 用户需求

#### 1.2.1 作为用户，我需要查看专注统计

**验收标准：**
- 显示今日番茄数（今日完成的番茄钟数量）
- 显示今日专注时长（格式：25m 或 1h 30m）
- 显示总番茄数（所有时间累计）
- 显示总专注时长（所有时间累计）
- 按日期分组展示专注记录列表

#### 1.2.2 作为用户，我需要在笔记中记录番茄钟

**验收标准：**
- 支持手动在事项下方添加番茄钟行
- 格式：`🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述`
- 支持列表格式：`- 🍅...` 或 `1. 🍅...`
- 无结束时间时默认按25分钟计算

#### 1.2.3 作为用户，我需要使用专注计时功能

**验收标准：**
- 点击"开始专注"按钮打开弹框
- 弹框分左右两栏：
  - 左侧：选择待办事项（过期事项 + 今天事项）
  - 右侧：设置专注时长（15/25/45/60分钟快捷按钮 + 自定义输入）
- 必须选择一个事项才能开始
- 默认时长25分钟
- 开始专注后 Dock 显示倒计时和事项信息
- 提供"结束专注"和"取消"按钮
- 倒计时结束自动完成，播放提示音，显示系统通知
- 完成时在文档中创建番茄钟记录

#### 1.2.4 作为用户，我需要专注状态持久化

**验收标准：**
- 开始专注后，状态保存到文件
- 插件重启后能恢复专注状态
- 过期的番茄钟自动标记为完成
- 取消专注时删除状态，不在文档中创建记录

### 1.3 数据格式

#### 1.3.1 番茄钟记录格式

```markdown
- 工作事项 @2026-03-08
🍅2026-03-08 15:45:32~15:45:36 专注描述
```

**支持实际专注时长（用于暂停/继续功能）：**

```markdown
🍅5,2026-03-08 15:45:32~15:50:32 专注描述（实际专注5分钟）
🍅5，2026-03-08 15:45:32~15:50:32 专注描述（中文逗号）
🍅5, 2026-03-08 15:45:32~15:50:32 专注描述（逗号后空格）
```

| 元素 | 格式 | 说明 |
|------|------|------|
| 标记 | `🍅` | 番茄钟标识 |
| 实际时长 | `N,` 或 `N，` | 实际专注分钟数（可选），支持中英文逗号，逗号后可有空格 |
| 日期 | `YYYY-MM-DD` | 番茄钟日期 |
| 开始时间 | `HH:mm:ss` | 专注开始时间 |
| 结束时间 | `HH:mm:ss` | 专注结束时间（可选）|
| 描述 | 任意文本 | 专注内容描述（可选）|

#### 1.3.2 文件存储格式

**文件路径：** `active-pomodoro.json`（插件数据目录）

```json
{
  "blockId": "事项块ID",
  "itemId": "事项ID",
  "itemContent": "事项内容",
  "startTime": 1741427132000,
  "durationMinutes": 25,
  "projectId": "项目ID",
  "taskId": "任务ID"
}
```

## 二、技术实现方案

### 2.1 架构设计

#### 2.1.1 数据流

```
用户点击"开始专注"
    │
    ▼
打开 PomodoroTimerDialog
    │
    ▼
选择事项 + 设置时长
    │
    ▼
调用 pomodoroStore.startPomodoro()
    │
    ├──► 保存到文件 active-pomodoro.json
    └──► 启动倒计时定时器
    │
    ▼
Dock 展示 PomodoroActiveTimer
    │
    ▼
倒计时结束 / 用户结束 / 用户取消
    │
    ├──► 完成：删除文件 + appendBlock 创建番茄钟块
    └──► 取消：删除文件
```

#### 2.1.2 状态管理

使用 Pinia Store 管理专注状态：

```typescript
// State
{
  activePomodoro: ActivePomodoro | null;  // 当前专注状态
  timerInterval: number | null;           // 倒计时定时器
}

// Actions
- startPomodoro()      // 开始专注，保存到文件
- completePomodoro()   // 完成专注，删除文件，创建块
- cancelPomodoro()     // 取消专注，删除文件
- restorePomodoro()    // 从文件恢复专注状态
```

### 2.2 核心模块

#### 2.2.1 文件存储模块 (`src/utils/pomodoroStorage.ts`)

| 函数 | 功能 | 思源 API |
|------|------|----------|
| `saveActivePomodoro()` | 保存进行中的番茄钟 | `plugin.saveData()` |
| `loadActivePomodoro()` | 读取进行中的番茄钟 | `plugin.loadData()` |
| `removeActivePomodoro()` | 删除进行中的番茄钟 | `plugin.removeData()` |

#### 2.2.2 专注状态 Store (`src/stores/pomodoroStore.ts`)

**startPomodoro(item, durationMinutes, parentBlockId, plugin):**
1. 构建番茄钟数据对象
2. 调用 `saveActivePomodoro()` 保存到文件
3. 设置本地 `activePomodoro` 状态
4. 启动倒计时定时器

**completePomodoro(plugin):**
1. 生成番茄钟内容 `🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss`
2. 调用 `appendBlock()` 在事项下创建块
3. 调用 `removeActivePomodoro()` 删除文件
4. 播放提示音
5. 显示系统通知
6. 清理本地状态

**cancelPomodoro(plugin):**
1. 调用 `removeActivePomodoro()` 删除文件
2. 清理本地状态

**restorePomodoro(plugin):**
1. 调用 `loadActivePomodoro()` 读取文件
2. 计算剩余时间
3. 如果已过期，调用 `markExpiredPomodoroComplete()`
4. 否则恢复专注状态，启动倒计时

#### 2.2.3 UI 组件

| 组件 | 功能 | 位置 |
|------|------|------|
| `PomodoroTimerDialog.vue` | 开始专注弹框 | `src/components/pomodoro/` |
| `PomodoroActiveTimer.vue` | 专注中展示 | `src/components/pomodoro/` |
| `PomodoroStats.vue` | 统计概览 | `src/components/pomodoro/` |
| `PomodoroRecordList.vue` | 记录列表 | `src/components/pomodoro/` |
| `PomodoroDock.vue` | Dock 主组件 | `src/tabs/` |

### 2.3 思源 API 使用

| 操作 | API | 用途 |
|------|-----|------|
| 保存文件 | `plugin.saveData()` | 保存进行中的番茄钟 |
| 读取文件 | `plugin.loadData()` | 读取进行中的番茄钟 |
| 删除文件 | `plugin.removeData()` | 删除进行中的番茄钟 |
| 创建块 | `appendBlock()` | 完成时在文档中创建番茄钟块 |

### 2.4 通知机制

#### 2.4.1 系统通知

使用 Web Notifications API：

```typescript
// 请求权限
Notification.requestPermission()

// 显示通知
new Notification('专注完成 🎉', {
  body: '已完成：事项内容（25分钟）',
  requireInteraction: true
})
```

#### 2.4.2 提示音

使用 Web Audio API：

```typescript
const audioContext = new AudioContext()
const oscillator = audioContext.createOscillator()
oscillator.frequency.value = 800
oscillator.start()
```

### 2.5 状态恢复流程

插件加载时（`PomodoroDock.vue onMounted`）：

1. 调用 `pomodoroStore.restorePomodoro(plugin)`
2. 读取 `active-pomodoro.json` 文件
3. 如果文件存在：
   - 计算剩余时间 = 设定时长 - (当前时间 - 开始时间)
   - 如果剩余时间 > 0：恢复倒计时
   - 如果剩余时间 <= 0：自动完成，创建块，删除文件
4. 如果文件不存在：无进行中的番茄钟

### 2.6 文件结构

```
src/
├── components/pomodoro/
│   ├── PomodoroStats.vue          # 统计概览
│   ├── PomodoroRecordList.vue     # 记录列表
│   ├── PomodoroTimerDialog.vue    # 开始专注弹框
│   └── PomodoroActiveTimer.vue    # 专注中展示
├── stores/
│   └── pomodoroStore.ts           # 专注状态管理
├── utils/
│   ├── notification.ts            # 系统通知
│   └── pomodoroStorage.ts         # 文件存储
├── tabs/
│   └── PomodoroDock.vue           # Dock 主组件
└── types/
    └── models.ts                  # 数据模型
```

### 2.7 类型定义

```typescript
// 进行中的番茄钟数据（文件存储）
interface ActivePomodoroData {
  blockId: string;         // 事项块ID
  itemId: string;          // 事项ID
  itemContent: string;     // 事项内容
  startTime: number;       // 开始时间戳（毫秒）
  durationMinutes: number; // 设定时长（分钟）
  projectId?: string;      // 项目ID
  taskId?: string;         // 任务ID
}

// 运行时专注状态（继承自 ActivePomodoroData）
interface ActivePomodoro extends ActivePomodoroData {
  remainingSeconds: number; // 剩余秒数
}

// 番茄钟记录（已完成的）
interface PomodoroRecord {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  description?: string;
  durationMinutes: number;
  actualDurationMinutes?: number; // 实际专注时长（分钟），用于暂停/继续功能
  blockId?: string;
  itemId?: string;
  itemContent?: string;
}
```

## 三、使用流程

### 3.1 手动记录番茄钟

1. 在事项下方手动添加番茄钟行
2. 格式：`🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述`
3. 支持记录实际专注时长（用于暂停/继续）：`🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss 描述`
4. 查看 Dock 统计和记录列表

### 3.2 使用专注计时

1. 点击 Dock 中的"开始专注"按钮
2. 在弹框中选择一个待办事项
3. 设置专注时长（或保持默认25分钟）
4. 点击"开始专注"
5. 专注过程中 Dock 显示倒计时
6. 专注结束后自动记录到笔记

## 四、注意事项

1. **状态持久化** - 专注状态通过文件保存，重启插件后可恢复
2. **提前结束** - 提前结束会删除状态文件，不会保留记录
3. **专注完成** - 正常完成的番茄钟会保留在笔记中，包含完整的开始和结束时间
4. **系统通知** - 专注完成时显示系统级通知，需要用户授权
