# 统一时间选择器设计文档

## 背景与问题

当前快速创建和详情页的时间设置逻辑不一致：

- **快速创建**：两个独立按钮"开始/结束"，可单独为空，数据可能不完整
- **详情页**：显示"全天"或"09:00~17:00"，点击后跳转到时间选择抽屉

## 目标

1. 统一两个页面的时间数据模型
2. 明确"全天" vs "自定义时间"的切换逻辑
3. 自定义时间模式下，必须同时填写开始和结束时间
4. 保存按钮根据时间完整性动态启用/禁用

## 组件拆分

### 组件结构

```
TimeRangeSelector (时间范围选择器 - 主组件)
├── TimeWheel (时间滚轮 - 复用)
│   ├── wheel-container (滚动容器)
│   ├── wheel-item (时间项)
│   └── wheel-indicator (选中指示器)
├── TimePickerSheet (时间选择弹窗 - 复用)
│   ├── TimeWheel (小时)
│   ├── TimeWheel (分钟)
│   └── 快捷时间按钮 (09:00, 10:00...)
└── 业务逻辑 (isAllDay 切换、时间验证)

使用方式：
- QuickCreateDrawer: 直接内嵌 TimeRangeSelector
- MobileItemDetail: TimeSettingDrawer 内嵌 TimeRangeSelector
```

---

## 设计方案

### 组件 1: TimeWheel (时间滚轮)

**功能**：可滚动的数字选择器，支持 00-23 或 00-55

**Props**:
```typescript
interface TimeWheelProps {
  modelValue: string;        // 当前选中的值，如 "09" 或 "30"
  options: string[];         // 选项列表，如 ["00", "01", ...] 或 ["00", "05", ...]
  label?: string;            // 标签文字，如 "时" / "分"
}
```

**Events**:
```typescript
update:modelValue(value: string): void  // 选中值变化时触发
```

**Features**:
- CSS scroll-snap 吸附效果
- 滚动停止后自动选中中间项
- 点击项自动滚动到中心
- 选中项高亮显示

---

### 组件 2: TimePickerSheet (时间选择弹窗)

**功能**：底部弹出的时间选择抽屉，包含双滚轮和快捷按钮

**Props**:
```typescript
interface TimePickerSheetProps {
  modelValue: boolean;       // 显示/隐藏
  title?: string;            // 标题，如 "选择开始时间"
  time: string;              // 当前时间，如 "09:00"
}
```

**Events**:
```typescript
confirm(time: string): void  // 确认选择，返回 "HH:mm"
cancel(): void              // 取消
```

**Features**:
- 复用 TimeWheel 组件
- 顶部显示当前选中时间大字体
- 快捷时间按钮行（09:00, 10:00, 14:00...）
- 点击快捷时间自动滚动滚轮

---

### 组件 3: TimeRangeSelector (时间范围选择器)

**功能**：主业务组件，包含全天切换和时间行

**Props**:
```typescript
interface TimeRangeSelectorProps {
  isAllDay: boolean;         // 是否全天
  startTime?: string;        // 开始时间 "HH:mm"
  endTime?: string;          // 结束时间 "HH:mm"
}
```

**Events**:
```typescript
update:isAllDay(value: boolean): void
update:startTime(value: string): void
update:endTime(value: string): void
```

**内部使用**：
- TimePickerSheet 用于选择具体时间

---

### 组件 4: TimeSettingDrawer (时间设置抽屉) - 仅详情页使用

**功能**：详情页专用的时间设置抽屉，底部有保存/取消按钮

**Props**:
```typescript
interface TimeSettingDrawerProps {
  modelValue: boolean;       // 显示/隐藏
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}
```

**Events**:
```typescript
save(payload: { isAllDay: boolean; startTime?: string; endTime?: string }): void
cancel(): void
```

**内部使用**：
- TimeRangeSelector 作为内容区
- 底部添加"取消/保存"按钮
- 内部验证时间完整性

---

## 页面实现

### 1. 快速创建页 (QuickCreateDrawer)

#### 交互流程

```
┌─────────────────────────────┐
│  时间范围                     │
│  ○ 全天  ● 自定义时间         │ ← TimeRangeSelector
│                             │
│  ┌─────────────────────┐    │
│  │ 开始时间    09:00 > │    │
│  ├─────────────────────┤    │
│  │ 结束时间    17:00 > │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

#### 代码示例

```vue
<template>
  <TimeRangeSelector
    v-model:is-all-day="itemForm.isAllDay"
    v-model:start-time="itemForm.startTime"
    v-model:end-time="itemForm.endTime"
  />
</template>

<script setup>
const itemForm = ref({
  content: '',
  date: dayjs().format('YYYY-MM-DD'),
  isAllDay: true,           // 新增
  startTime: '',
  endTime: '',
  priority: undefined,
});

const canSubmit = computed(() => {
  if (!selectedProjectId.value) return false;
  if (!taskInput.value.trim()) return false;
  if (!itemForm.value.content.trim()) return false;
  
  // 自定义时间必须完整
  if (!itemForm.value.isAllDay) {
    if (!itemForm.value.startTime || !itemForm.value.endTime) return false;
  }
  
  return true;
});
</script>
```

---

### 2. 详情页 (MobileItemDetail)

#### 交互流程

```
┌─────────────────────────────┐
│  时间              全天   >  │ ← 点击打开 TimeSettingDrawer
└─────────────────────────────┘

              ↓

┌─────────────────────────────┐
│         时间设置              │ ← TimeSettingDrawer
│                             │
│  ○ 全天                      │ ← TimeRangeSelector
│  ● 自定义时间                 │
│                             │
│  ┌─────────────────────┐    │
│  │ 开始时间    09:00   │    │
│  │ 结束时间    17:00   │    │
│  └─────────────────────┘    │
│                             │
│  [取消]        [保存]        │ ← 抽屉底部按钮
└─────────────────────────────┘
```

#### 代码示例

```vue
<template>
  <!-- 列表显示 -->
  <div class="info-item" @click="openTimeDrawer">
    <span>时间</span>
    <span>{{ displayTime }}</span>
  </div>
  
  <!-- 时间设置抽屉 -->
  <TimeSettingDrawer
    v-model="showTimeDrawer"
    :is-all-day="item.isAllDay"
    :start-time="item.startTime"
    :end-time="item.endTime"
    @save="onTimeSave"
    @cancel="showTimeDrawer = false"
  />
</template>
```

---

## 数据结构

### 事项数据结构更新

```typescript
interface Item {
  id: string;
  content: string;
  date: string;
  isAllDay: boolean;        // 新增：是否全天
  startTime?: string;       // 格式: "HH:mm"
  endTime?: string;         // 格式: "HH:mm"
  priority?: PriorityLevel;
  // ... 其他字段
}
```

### 向后兼容

现有数据迁移逻辑：
```typescript
function migrateItem(item: any): Item {
  // 旧数据没有 isAllDay 字段
  if (item.isAllDay === undefined) {
    item.isAllDay = !item.startTime && !item.endTime;
  }
  return item;
}
```

---

## i18n 文本

```yaml
mobile:
  time:
    allDay: "全天"
    customTime: "自定义时间"
    startTime: "开始时间"
    endTime: "结束时间"
    selectTime: "选择时间"
    timeSetting: "时间设置"
    hour: "时"
    minute: "分"
```

---

## 文件结构

```
src/components/time-picker/
├── TimeWheel.vue              # 时间滚轮
├── TimePickerSheet.vue        # 时间选择弹窗
├── TimeRangeSelector.vue      # 时间范围选择器
└── TimeSettingDrawer.vue      # 时间设置抽屉(详情页用)
```

---

## 实现顺序

1. **TimeWheel** - 基础组件，可独立测试
2. **TimePickerSheet** - 依赖 TimeWheel
3. **TimeRangeSelector** - 依赖 TimePickerSheet，包含业务逻辑
4. **TimeSettingDrawer** - 依赖 TimeRangeSelector，仅详情页
5. **QuickCreateDrawer** - 替换现有时间区域
6. **MobileItemDetail** - 添加时间设置抽屉

---

## 验收标准

- [ ] TimeWheel 滚动流畅，吸附效果正常
- [ ] TimePickerSheet 快捷按钮能正确滚动滚轮
- [ ] TimeRangeSelector 切换全天/自定义时展开/收起动画正常
- [ ] 快速创建页默认全天，保存按钮可用
- [ ] 自定义时间模式下，必须填写完整才能保存
- [ ] 详情页时间设置抽屉验证逻辑正确
- [ ] 所有 i18n 文本正确显示
- [ ] 组件在 iOS/Android 移动端表现一致
