# 重构 Tooltip 实现计划

## 目标
将 `src/index.ts` 中底栏计时器的 tooltip 实现从使用 `b3-tooltips` CSS 类改为使用 `src/utils/dialog.ts` 中的 `showIconTooltip`/`hideIconTooltip` 函数实现。

## 背景
- 当前实现：使用思源原生的 `b3-tooltips b3-tooltips__nw` CSS 类实现 tooltip
- 目标实现：使用 `dialog.ts` 中已封装的 `showIconTooltip`/`hideIconTooltip` 函数
- 优势：自定义 tooltip 挂载到 body，不受父元素 overflow 影响，且位置计算更智能（自动处理边界情况）

## 具体变更

### 1. HTML 结构修改
**文件**: `src/index.ts` 第 1072-1087 行

**当前代码**:
```html
<div class="timer-icon b3-tooltips b3-tooltips__nw" aria-label="${t('pomodoro').dockTitle}"></div>
<div class="timer-text"></div>
<div class="timer-skip-btn b3-tooltips b3-tooltips__nw" style="display:none" data-tooltip="${t('settings').pomodoro.skipBreak}">
  <svg>...</svg>
</div>
<div class="timer-end-btn b3-tooltips b3-tooltips__nw" style="display:none" data-tooltip="${t('pomodoroActive').endFocus}">
  <svg>...</svg>
</div>
<div class="timer-control b3-tooltips b3-tooltips__nw" aria-label="${t('pomodoro').startFocus}">
  <svg>...</svg>
</div>
```

**修改后**:
- 移除所有 `b3-tooltips b3-tooltips__nw` 类
- 将 `aria-label` 和 `data-tooltip` 属性统一改为 `data-tooltip` 存储 tooltip 文本

### 2. 事件绑定修改
在创建底栏计时器元素后，为这些按钮绑定 `mouseenter`/`mouseleave` 事件：

```typescript
import { showIconTooltip, hideIconTooltip } from '@/utils/dialog';

// 绑定 tooltip 事件
const bindTooltip = (selector: string, text: string) => {
  const el = this.statusBarTimerEl.querySelector(selector);
  if (el) {
    el.addEventListener('mouseenter', () => showIconTooltip(el as HTMLElement, text));
    el.addEventListener('mouseleave', hideIconTooltip);
  }
};

bindTooltip('.timer-icon', t('pomodoro').dockTitle);
bindTooltip('.timer-skip-btn', t('settings').pomodoro.skipBreak);
bindTooltip('.timer-end-btn', t('pomodoroActive').endFocus);
bindTooltip('.timer-control', t('pomodoro').startFocus);
```

### 3. 需要修改的文件
1. `src/index.ts`:
   - 修改第 1072-1087 行的 HTML 模板，移除 `b3-tooltips` 类，统一使用 `data-tooltip` 属性
   - 在创建元素后添加事件绑定代码（大约在第 1088 行之后）
   - 添加 `showIconTooltip` 和 `hideIconTooltip` 的导入

## 验证点
- [ ] 鼠标悬停在计时器图标上时显示 "番茄钟" tooltip
- [ ] 鼠标悬停在跳过按钮上时显示 "跳过休息" tooltip
- [ ] 鼠标悬停在结束按钮上时显示 "结束专注" tooltip
- [ ] 鼠标悬停在控制按钮上时显示 "开始专注" tooltip
- [ ] Tooltip 位置正确，不会超出视口边界
- [ ] 鼠标移开后 tooltip 正确隐藏
