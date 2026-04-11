# 统一时间选择器实现计划

## 任务概览

基于设计文档，抽取可复用的时间选择组件，统一快速创建和详情页的时间设置交互。

## 任务列表

### 任务 1: 创建 TimeWheel 组件
**文件**: `src/components/time-picker/TimeWheel.vue`

**内容**:
- 从 QuickCreateDrawer.vue 抽取滚轮 HTML/CSS
- Props: `modelValue`, `options`, `label`
- 滚动监听自动选中
- 点击选中并滚动

**验证**:
- [ ] 滚动时自动吸附到中心项
- [ ] 点击项后滚动到中心
- [ ] 选中项高亮显示

---

### 任务 2: 创建 TimePickerSheet 组件
**文件**: `src/components/time-picker/TimePickerSheet.vue`

**内容**:
- 底部弹窗容器（复用现有 sheet 样式）
- 集成两个 TimeWheel（小时、分钟）
- 快捷时间按钮行（09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00, 18:00）
- 大字体显示当前选中时间
- 底部取消/确认按钮

**Props**:
```typescript
interface Props {
  modelValue: boolean;
  title?: string;
  time?: string; // "HH:mm"
}
```

**Events**:
```typescript
confirm(time: string): void
cancel(): void
```

**验证**:
- [ ] 打开时自动滚动到当前时间
- [ ] 点击快捷按钮自动滚动对应时间
- [ ] 滚轮滚动停止后更新显示
- [ ] 确认返回格式正确的 "HH:mm"

---

### 任务 3: 创建 TimeRangeSelector 组件
**文件**: `src/components/time-picker/TimeRangeSelector.vue`

**内容**:
- Radio 开关：全天 / 自定义时间
- 自定义模式下展开两行：开始时间、结束时间
- 点击时间行打开 TimePickerSheet
- 过渡动画

**Props**:
```typescript
interface Props {
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}
```

**Events**:
```typescript
update:isAllDay(value: boolean): void
update:startTime(value: string): void
update:endTime(value: string): void
```

**验证**:
- [ ] 默认选中"全天"
- [ ] 切换到"自定义"时展开时间行（带动画）
- [ ] 点击时间行打开选择器
- [ ] 选择时间后更新显示

---

### 任务 4: 创建 TimeSettingDrawer 组件
**文件**: `src/components/time-picker/TimeSettingDrawer.vue`

**内容**:
- 底部抽屉容器
- 内嵌 TimeRangeSelector
- 底部保存/取消按钮
- 内部验证逻辑

**Props**:
```typescript
interface Props {
  modelValue: boolean;
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

**内部状态**:
```typescript
const tempIsAllDay = ref(props.isAllDay);
const tempStartTime = ref(props.startTime);
const tempEndTime = ref(props.endTime);

const canSave = computed(() => {
  if (tempIsAllDay.value) return true;
  return !!tempStartTime.value && !!tempEndTime.value;
});
```

**验证**:
- [ ] 打开时复制 props 到临时状态
- [ ] 自定义时间未填完整时保存按钮禁用
- [ ] 点击保存返回完整数据
- [ ] 点击取消不修改数据

---

### 任务 5: 重构 QuickCreateDrawer
**文件**: `src/tabs/mobile/drawers/QuickCreateDrawer.vue`

**修改内容**:
1. 移除旧的时间选择相关代码（time-wheels, time-picker sheet 等）
2. 引入 TimeRangeSelector 组件
3. 更新 itemForm 数据结构，添加 `isAllDay` 字段
4. 更新 canSubmit 验证逻辑
5. 更新提交时的数据处理

**数据变更**:
```typescript
// 原结构
const itemForm = ref({
  content: '',
  date: '',
  startTime: '',
  endTime: '',
});

// 新结构
const itemForm = ref({
  content: '',
  date: '',
  isAllDay: true,      // 新增
  startTime: '',
  endTime: '',
});
```

**验证**:
- [ ] 默认显示"全天"
- [ ] 切换到自定义时间后必须填完整才能保存
- [ ] 提交时正确传递 isAllDay 字段

---

### 任务 6: 重构 MobileItemDetail 时间部分
**文件**: `src/tabs/mobile/drawers/MobileItemDetail.vue`

**修改内容**:
1. 移除旧的时间编辑逻辑
2. 添加 TimeSettingDrawer 组件
3. 点击时间行打开抽屉
4. 处理保存事件更新数据

**验证**:
- [ ] 显示"全天"或"HH:mm~HH:mm"
- [ ] 点击打开时间设置抽屉
- [ ] 抽屉内操作后正确更新显示

---

### 任务 7: 添加 i18n 文本
**文件**: `src/i18n/zh_CN.ts`, `src/i18n/en_US.ts`

**新增键值**:
```yaml
mobile:
  time:
    allDay: "全天" / "All Day"
    customTime: "自定义时间" / "Custom Time"
    startTime: "开始时间" / "Start Time"
    endTime: "结束时间" / "End Time"
    selectTime: "选择时间" / "Select Time"
    timeSetting: "时间设置" / "Time Setting"
    hour: "时" / "Hour"
    minute: "分" / "Minute"
```

---

### 任务 8: 数据迁移兼容
**文件**: `src/utils/itemUtils.ts` (或相关数据转换文件)

**内容**:
```typescript
export function migrateItemTimeData(item: any): Item {
  if (item.isAllDay === undefined) {
    item.isAllDay = !item.startTime && !item.endTime;
  }
  return item;
}
```

在数据加载时调用，确保旧数据兼容。

---

## 依赖关系

```
TimeWheel
    ↓
TimePickerSheet (依赖 TimeWheel)
    ↓
TimeRangeSelector (依赖 TimePickerSheet)
    ↓
TimeSettingDrawer (依赖 TimeRangeSelector)
    ↓
QuickCreateDrawer, MobileItemDetail
```

## 执行顺序

按任务编号 1-8 顺序执行，每个任务完成后验证再进入下一个。

## 测试检查点

### 功能测试
- [ ] 滚轮滚动和吸附正常
- [ ] 快捷时间按钮点击后滚轮滚动到对应位置
- [ ] 全天/自定义切换动画流畅
- [ ] 快速创建页保存按钮状态正确
- [ ] 详情页抽屉保存按钮状态正确
- [ ] 时间数据正确保存和显示

### 兼容性测试
- [ ] iOS Safari 滚轮正常
- [ ] Android Chrome 滚轮正常
- [ ] 小屏幕设备显示正常

### i18n 测试
- [ ] 中文模式文本正确
- [ ] 英文模式文本正确

## 预估工时

| 任务 | 预估时间 |
|------|---------|
| 任务 1: TimeWheel | 1h |
| 任务 2: TimePickerSheet | 1.5h |
| 任务 3: TimeRangeSelector | 1.5h |
| 任务 4: TimeSettingDrawer | 1h |
| 任务 5: 重构 QuickCreateDrawer | 1.5h |
| 任务 6: 重构 MobileItemDetail | 1h |
| 任务 7: i18n | 0.5h |
| 任务 8: 数据兼容 | 0.5h |
| **总计** | **约 8-9 小时** |

## 风险点

1. **移动端滚轮性能** - iOS 上 CSS scroll-snap 可能有兼容性问题，需要测试
2. **数据格式兼容** - 确保 isAllDay 字段的向后兼容处理
3. **抽屉动画冲突** - TimeSettingDrawer 嵌套在 ItemDetail 抽屉内，可能有动画冲突

## 回滚方案

如需回滚，保留原 QuickCreateDrawer 的时间选择代码注释，可随时恢复。
