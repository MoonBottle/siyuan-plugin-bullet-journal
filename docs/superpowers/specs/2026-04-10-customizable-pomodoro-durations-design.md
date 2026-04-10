# 番茄钟专注/休息时长自定义设计

## 背景

用户反馈希望自定义番茄钟的专注和休息时长选项，而不是使用硬编码的默认值。

## 当前问题

| 位置 | 当前实现 | 问题 |
|------|---------|------|
| `PomodoroTimerDialog.vue` | `quickDurations = [15, 25, 45, 60]` 硬编码 | 无法自定义专注时长选项 |
| `PomodoroCompleteDialog.vue` | 休息按钮固定为 5/10/15 分钟 | 无法自定义休息时长选项 |
| 默认选中值 | 专注默认25分钟，休息默认第一个（5分钟） | 无法设置个人偏好默认值 |

## 设计目标

1. 允许用户自定义专注时长的 4 个预设按钮值
2. 允许用户自定义休息时长的 3 个预设按钮值
3. 允许用户设置默认专注时长和默认休息时长
4. 未配置时使用现有默认值（不写入配置）

## 数据模型变更

### 新增配置项（`PomodoroSettings`）

```typescript
export interface PomodoroSettings {
  // ... 现有配置项
  
  // 专注时长预设（4个），默认 [15, 25, 45, 60]
  focusDurationPresets?: number[];
  
  // 默认专注时长，必须在 presets 中，默认 25
  defaultFocusDuration?: number;
  
  // 休息时长预设（3个），默认 [5, 10, 15]
  breakDurationPresets?: number[];
  
  // 默认休息时长，必须在 presets 中，默认 5
  defaultBreakDuration?: number;
}
```

## UI 设计

### 设置页面布局

```
┌─────────────────────────────────────────┐
│  🍅 番茄钟                              │
│  专注计时、休息提醒与记录存储相关设置    │
├─────────────────────────────────────────┤
│  [现有设置项...]                        │
│  ─────────────────────────────────────  │
│                                         │
│  专注时长预设                          │
│  快速选择按钮的时长选项（分钟）          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  │ 15 │ │ 25 │ │ 45 │ │ 60 │           │
│  └────┘ └────┘ └────┘ └────┘           │
│                                         │
│  默认专注时长                          │
│  打开专注弹窗时默认选中的时长            │
│  ┌─────────────────┐                   │
│  │ ▼ 25 分钟       │                   │
│  └─────────────────┘                   │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  休息时长预设                          │
│  完成专注后休息的时长选项（分钟）        │
│  ┌────┐ ┌────┐ ┌────┐                  │
│  │  5 │ │ 10 │ │ 15 │                   │
│  └────┘ └────┘ └────┘                  │
│                                         │
│  默认休息时长                          │
│  休息弹窗默认选中的时长                  │
│  ┌─────────────────┐                   │
│  │ ▼ 5 分钟        │                   │
│  └─────────────────┘                   │
│                                         │
│  [其他现有设置项...]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 输入限制

| 配置项 | 范围 | 说明 |
|--------|------|------|
| 专注时长预设 | 1-180 分钟 | 4个数值，必须为正整数 |
| 默认专注时长 | 下拉选择，选项为 presets 中的值 | 默认25 |
| 休息时长预设 | 1-60 分钟 | 3个数值，必须为正整数 |
| 默认休息时长 | 下拉选择，选项为 presets 中的值 | 默认5 |

**注意**：默认时长使用下拉选择，选项动态从对应的预设值生成，确保始终合法。

### 首次打开设置页面

未自定义时，预填充默认值（代码兜底，不写入配置）：

```
专注时长预设:  [15] [25] [45] [60] 分钟
默认专注时长:  ▼ 25 分钟  (下拉选项: 15/25/45/60)
休息时长预设:  [5] [10] [15] 分钟
默认休息时长:  ▼ 5 分钟   (下拉选项: 5/10/15)
```

## 交互流程

### 1. 开始专注

```
点击 🍅 按钮
    ↓
打开专注弹窗
    ↓
显示自定义的4个预设按钮
    ↓
默认选中用户设置的 defaultFocusDuration
    ↓
用户可点击其他预设或输入自定义时长
    ↓
开始专注
```

### 2. 完成专注后休息

```
专注完成弹出休息选择
    ↓
显示自定义的3个休息预设按钮
    ↓
默认选中 defaultBreakDuration（高亮）
    ↓
用户点击开始休息或直接关闭
```

## 代码变更点

### 1. 类型定义（`src/settings/types.ts`）

- 在 `PomodoroSettings` 接口新增 4 个可选字段
- 在 `defaultPomodoroSettings` 常量中提供默认值

### 2. 设置页面（`src/components/settings/PomodoroConfigSection.vue`）

- 新增专注时长预设输入（4个数字输入框）
- 新增默认专注时长选择（SySelect 下拉框，选项从 presets 动态生成）
- 新增休息时长预设输入（3个数字输入框）
- 新增默认休息时长选择（SySelect 下拉框，选项从 presets 动态生成）

### 3. 专注弹窗（`src/components/pomodoro/PomodoroTimerDialog.vue`）

- 从硬编码 `quickDurations = [15, 25, 45, 60]` 改为读取配置
- 默认选中值从 25 改为读取 `defaultFocusDuration`
- 自定义输入框的默认值同步

### 4. 休息弹窗（`src/components/pomodoro/PomodoroCompleteDialog.vue`）

- 休息按钮从固定 5/10/15 改为读取 `breakDurationPresets`
- 默认选中 `defaultBreakDuration`（UI高亮或自动触发）

### 5. 国际化（`src/i18n/zh_CN.json` / `en_US.json`）

新增翻译键：
- `settings.pomodoro.focusDurationPresets`
- `settings.pomodoro.focusDurationPresetsDesc`
- `settings.pomodoro.defaultFocusDuration`
- `settings.pomodoro.defaultFocusDurationDesc`
- `settings.pomodoro.breakDurationPresets`
- `settings.pomodoro.breakDurationPresetsDesc`
- `settings.pomodoro.defaultBreakDuration`
- `settings.pomodoro.defaultBreakDurationDesc`

## 边界情况处理

1. **配置为空**：使用代码默认值 `[15,25,45,60]` 和 `[5,10,15]`
2. **配置数量不足**：按顺序取前4个/前3个，不足补默认值
3. **默认值不在预设中**：自动选择预设第一个
4. **输入非法值**：输入框限制只能输入1-180/1-60的正整数

## 兼容性

- 向后兼容：新增字段均为可选，旧配置无需迁移
- 默认值行为：未配置时与现有行为完全一致
