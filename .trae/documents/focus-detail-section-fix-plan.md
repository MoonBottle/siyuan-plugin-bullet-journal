# FocusDetailSection 组件修改计划

## 用户反馈
- 添加 year 选项
- 月份标签不用去掉"月"字

## 问题分析

### 1. 本周/上周文案显示问题（主要问题）
- **问题**: 从截图看，FocusDetailSection 的周视图在 offset=0 时显示"周"，offset=-1 时应该显示"上周"但实际显示"周"
- **位置**: FocusDetailSection.vue 第 122-127 行
- **当前代码**:
```javascript
if (props.range === 'week') {
  if (props.rangeOffset === 0) return t('pomodoroStats').week;  // 显示"周"
  const w = dayjs().add(props.rangeOffset, 'week');
  const start = w.startOf('week').add(1, 'day');
  const end = w.endOf('week').add(1, 'day');
  return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`;
}
```
- **对比**: FocusTrendChart.vue 第 93-99 行正确处理了本周/上周
```javascript
case 'week': {
  if (offset.value === 0) return t('pomodoroStats').week;  // 周
  if (offset.value === -1) return t('pomodoroStats').lastWeek;  // 上周
  const w = dayjs().add(offset.value, 'week');
  const start = w.startOf('week').add(1, 'day');
  const end = w.endOf('week').add(1, 'day');
  return `${start.format('M月D日')} - ${end.format('M月D日')}`;
}
```
- **分析**: FocusTrendChart 显示正确，FocusDetailSection 缺少 offset=-1 时返回"上周"的逻辑

### 2. 下拉选项顺序问题
- **问题**: 时间范围下拉选项顺序需要统一为：日、周、月、年
- **位置**: FocusDetailSection.vue 第 79-83 行
- **当前代码**:
```javascript
const rangeOptions = computed(() => [
  { label: t('pomodoroStats').today, value: 'today' },
  { label: t('pomodoroStats').week, value: 'week' },
  { label: t('pomodoroStats').month, value: 'month' }
]);
```
- **需要**: 添加 year 选项，并调整顺序为 日、周、月、年

## 需要修改的文件

### 1. FocusDetailSection.vue

#### 修改 1: 下拉选项添加 year 并调整顺序为 日、周、月、年
```javascript
// 第 79-83 行
// 从:
const rangeOptions = computed(() => [
  { label: t('pomodoroStats').today, value: 'today' },
  { label: t('pomodoroStats').week, value: 'week' },
  { label: t('pomodoroStats').month, value: 'month' }
]);

// 改为:
const rangeOptions = computed(() => [
  { label: t('pomodoroStats').today, value: 'today' },
  { label: t('pomodoroStats').week, value: 'week' },
  { label: t('pomodoroStats').month, value: 'month' },
  { label: t('pomodoroStats').year, value: 'year' }
]);
```

#### 修改 2: 添加 year 的日期范围计算
```javascript
// 第 87-114 行 rangeDates computed 中添加 year case
// 在 month case 后添加:
case 'year': {
  const y = base.add(props.rangeOffset, 'year');
  start = y.startOf('year');
  end = y.endOf('year');
  break;
}
```

#### 修改 3: 添加 year 的标签显示
```javascript
// 第 116-134 行 rangeLabel computed 中添加 year case
// 在 month case 后添加:
if (props.range === 'year') {
  const y = dayjs().add(props.rangeOffset, 'year');
  return y.format('YYYY');
}
```

#### 修改 4: 周标签添加"上周"判断（核心修复）
```javascript
// 第 122-127 行
// 从:
if (props.range === 'week') {
  if (props.rangeOffset === 0) return t('pomodoroStats').week;
  const w = dayjs().add(props.rangeOffset, 'week');
  const start = w.startOf('week').add(1, 'day');
  const end = w.endOf('week').add(1, 'day');
  return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`;
}

// 改为:
if (props.range === 'week') {
  if (props.rangeOffset === 0) return t('pomodoroStats').week;
  if (props.rangeOffset === -1) return t('pomodoroStats').lastWeek;
  const w = dayjs().add(props.rangeOffset, 'week');
  const start = w.startOf('week').add(1, 'day');
  const end = w.endOf('week').add(1, 'day');
  return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`;
}
```

#### 修改 5: Props 类型添加 year
```javascript
// 第 62-65 行
// 从:
const props = defineProps<{
  range: 'today' | 'week' | 'month';
  rangeOffset: number;
}>();

// 改为:
const props = defineProps<{
  range: 'today' | 'week' | 'month' | 'year';
  rangeOffset: number;
}>();
```

#### 修改 6: Emit 类型添加 year
```javascript
// 第 67-70 行
// 从:
const emit = defineEmits<{
  'update:range': [value: 'today' | 'week' | 'month'];
  'update:rangeOffset': [value: number];
}>();

// 改为:
const emit = defineEmits<{
  'update:range': [value: 'today' | 'week' | 'month' | 'year'];
  'update:rangeOffset': [value: number];
}>();
```

### 2. FocusTrendChart.vue

#### 修改: 下拉选项顺序调整为 日、周、月、年
```javascript
// 第 45-50 行
// 从:
const dimensionOptions = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '日', value: 'day' }
];

// 改为:
const dimensionOptions = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' }
];
```

## 实施步骤

1. 修改 FocusDetailSection.vue
   - 下拉选项添加 year，顺序调整为 日、周、月、年
   - rangeDates 添加 year 的计算逻辑
   - rangeLabel 添加 year 的显示逻辑
   - 周标签添加"上周"判断（offset === -1）
   - Props 和 Emit 类型添加 year

2. 修改 FocusTrendChart.vue
   - 下拉选项顺序调整为 日、周、月、年
