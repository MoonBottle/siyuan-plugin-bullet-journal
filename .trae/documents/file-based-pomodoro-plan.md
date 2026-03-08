# 文件存储番茄钟状态计划

## 目标
将专注状态的存储方式从思源块属性改为文件存储，使用思源的 `putFile` 接口保存进行中的番茄钟信息，只在完成时才写入到文档中。

## 方案概述

### 存储方式变更

**原方案：**
- 开始专注：创建块 + 设置块属性（custom-pomodoro-status/running 等）
- 状态恢复：遍历块查找 running 状态的番茄钟
- 完成时：更新块内容 + 更新块属性为 completed

**新方案：**
- 开始专注：使用 `putFile` 保存番茄钟信息到插件数据文件，不创建文档块
- 状态恢复：读取文件获取进行中的番茄钟
- 完成时：
  1. 删除文件中的进行中的番茄钟记录
  2. 在文档中创建完整的番茄钟块（🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss）

### 文件存储设计

**文件路径：** `/data/storage/pensieve/bullet-journal/active-pomodoro.json`

**文件内容格式：**
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

### API 使用

| 操作 | API | 用途 |
|------|-----|------|
| 保存进行中的番茄钟 | `putFile` | 写入 active-pomodoro.json |
| 读取进行中的番茄钟 | `getFile` | 读取 active-pomodoro.json |
| 删除进行中的番茄钟 | `removeFile` | 删除 active-pomodoro.json |
| 完成时创建块 | `appendBlock` | 在事项下添加番茄钟块 |

## 详细步骤

### Step 1: 创建文件存储工具模块
文件：`src/utils/pomodoroStorage.ts`

```typescript
/**
 * 保存进行中的番茄钟到文件
 */
export async function saveActivePomodoro(
  plugin: any,
  data: ActivePomodoroData
): Promise<boolean>

/**
 * 读取进行中的番茄钟
 */
export async function loadActivePomodoro(
  plugin: any
): Promise<ActivePomodoroData | null>

/**
 * 删除进行中的番茄钟文件
 */
export async function removeActivePomodoro(
  plugin: any
): Promise<boolean>

/**
 * 检查是否有进行中的番茄钟
 */
export async function hasActivePomodoro(
  plugin: any
): Promise<boolean>
```

### Step 2: 修改 PomodoroStore
文件：`src/stores/pomodoroStore.ts`

**修改 `startPomodoro()`：**
- 不再调用 `appendBlock` 和 `setBlockAttrs`
- 改为调用 `saveActivePomodoro()` 保存到文件
- 设置本地专注状态

**修改 `completePomodoro()`：**
- 调用 `removeActivePomodoro()` 删除文件
- 调用 `appendBlock` 在事项下创建完整的番茄钟块
- 显示完成通知

**修改 `cancelPomodoro()`：**
- 调用 `removeActivePomodoro()` 删除文件
- 清理本地状态

**修改 `restorePomodoro()`：**
- 调用 `loadActivePomodoro()` 读取文件
- 计算剩余时间并恢复倒计时
- 如果已过期，自动标记为完成

### Step 3: 修改 PomodoroDock
文件：`src/tabs/PomodoroDock.vue`

**修改状态恢复逻辑：**
- 不再遍历块属性查找 running 状态的番茄钟
- 改为调用 `loadActivePomodoro()` 从文件读取

### Step 4: 清理不再使用的代码

**删除/修改内容：**
- 移除 `lineParser.ts` 中的块属性解析（可选，保留兼容性）
- 移除 `pomodoroStore.ts` 中对 `setBlockAttrs`、`getBlockAttrs` 的调用
- 更新 `ActivePomodoro` 类型，移除不必要的字段

## 数据结构变更

### ActivePomodoroData（新）
```typescript
export interface ActivePomodoroData {
  blockId: string;         // 事项块ID（完成时在此块下添加番茄钟）
  itemId: string;          // 事项ID
  itemContent: string;     // 事项内容
  startTime: number;       // 开始时间戳（毫秒）
  durationMinutes: number; // 设定时长（分钟）
  projectId?: string;      // 项目ID（可选）
  taskId?: string;         // 任务ID（可选）
}
```

### ActivePomodoro（Store 中使用）
```typescript
export interface ActivePomodoro extends ActivePomodoroData {
  remainingSeconds: number; // 剩余秒数（运行时计算）
}
```

## 文件变更

### 新增文件
- `src/utils/pomodoroStorage.ts` - 文件存储工具函数

### 修改文件
- `src/stores/pomodoroStore.ts` - 使用文件存储替代块属性
- `src/tabs/PomodoroDock.vue` - 从文件恢复状态
- `src/types/models.ts` - 更新类型定义

### 可选清理
- `src/parser/lineParser.ts` - 可选择移除块属性解析
- `src/utils/notification.ts` - 保留，用于完成通知

## 优势

1. **更简洁** - 不需要在思源中创建临时块和设置属性
2. **更高效** - 不需要遍历所有块来恢复状态
3. **更可靠** - 文件读写比块属性操作更直接
4. **更干净** - 用户的笔记中只保留已完成的番茄钟记录

## 验收标准

- [ ] 开始专注时保存到文件，不在文档中创建块
- [ ] 完成专注时删除文件，在文档中创建完整的番茄钟块
- [ ] 取消专注时删除文件，不在文档中创建块
- [ ] 插件重启后能从文件恢复专注状态
- [ ] 过期的番茄钟自动标记为完成并写入文档
- [ ] 完成时显示系统级通知
