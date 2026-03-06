# 使用 dayjs 处理日期

## 问题背景

之前使用 `toLocaleDateString('en-CA')` 修复了时区问题，但使用 dayjs 是更好的解决方案，因为：
1. dayjs 是专门的日期处理库，API 更清晰
2. 支持插件扩展（如 utc、timezone 等）
3. 更好的跨时区支持
4. 代码可读性更好

## 设计原则

**不硬编码特定时区**，让 dayjs 使用用户本地时区，这样全球用户都能正确使用。

## 实施步骤

### 1. 安装 dayjs

```bash
npm install dayjs
```

### 2. 创建 dayjs 配置文件

创建 `src/utils/dayjs.ts`：
- 引入 dayjs 核心
- **不配置固定时区**，使用用户本地时区
- 导出配置好的 dayjs 实例

### 3. 修改 dateUtils.ts

将现有的日期工具函数改为使用 dayjs：
- `getTodayISO()` - 使用 dayjs 获取今天日期（本地时间）
- `toISODateString()` - 使用 dayjs 格式化日期（本地时间）
- 其他日期相关函数

### 4. 修改 projectStore.ts

- 使用 dayjs 获取当前日期（本地时间）
- 替换 `toLocaleDateString('en-CA')` 为 dayjs 的格式化方法

### 5. 修改 TodoSidebar.vue

- 使用 dayjs 计算明天日期（基于本地时间）
- 替换 `toLocaleDateString('en-CA')` 为 dayjs 的格式化方法

### 6. 修改 CalendarView.vue

- 使用 dayjs 处理日期计算（本地时间）

### 7. 修改 dialog.ts

- 使用 dayjs 处理日期选择器中的日期（本地时间）

### 8. 验证

- 确保所有日期功能正常工作
- 验证跨天（过12点）后刷新能正确显示新日期
- 确保不同时区的用户都能正常使用
