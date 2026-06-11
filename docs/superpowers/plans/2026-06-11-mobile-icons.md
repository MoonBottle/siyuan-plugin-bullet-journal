# Mobile 端图标统一为 iconTa 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 将 Mobile 端 7 个文件中的 SiYuan 内置图标替换为 iconTa 自定义图标。

**架构：** 纯字符串替换，无逻辑变更。

**技术栈：** Vue 3 + TypeScript

---

### 任务 1：替换 ActionDrawer.vue 图标

**文件：** `src/mobile/drawers/action/ActionDrawer.vue`

- [ ] **替换 5 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |
| `#iconClock` | `#iconTaTimer` |
| `#iconForward` | `#iconTaSkipForward` |
| `#iconInfo` | `#iconTaInfo` |
| `#iconCalendar` | `#iconTaCalendar` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/drawers/action/ActionDrawer.vue
git commit -m "style(ActionDrawer): 替换为 iconTa 自定义图标"
```

---

### 任务 2：替换 MobileItemDetail.vue 图标

**文件：** `src/mobile/drawers/item/MobileItemDetail.vue`

- [ ] **替换 4 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |
| `#iconClock` | `#iconTaTimer` |
| `#iconForward` | `#iconTaSkipForward` |
| `#iconCalendar` | `#iconTaCalendar` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/drawers/item/MobileItemDetail.vue
git commit -m "style(MobileItemDetail): 替换为 iconTa 自定义图标"
```

---

### 任务 3：替换 MobileTodoList.vue 图标

**文件：** `src/mobile/components/todo/MobileTodoList.vue`

- [ ] **替换 1 种图标**

| 原值 | 新值 |
|------|------|
| `#iconClock` | `#iconTaTimer` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/components/todo/MobileTodoList.vue
git commit -m "style(MobileTodoList): 替换为 iconTa 自定义图标"
```

---

### 任务 4：替换 SettingsDrawer.vue 图标

**文件：** `src/mobile/drawers/settings/SettingsDrawer.vue`

- [ ] **替换 2 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |
| `#iconInfo` | `#iconTaInfo` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/drawers/settings/SettingsDrawer.vue
git commit -m "style(SettingsDrawer): 替换为 iconTa 自定义图标"
```

---

### 任务 5：替换 QuickCreateDrawer.vue 图标

**文件：** `src/mobile/drawers/quick-create/QuickCreateDrawer.vue`

- [ ] **替换 4 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |
| `#iconClock` | `#iconTaTimer` |
| `#iconInfo` | `#iconTaInfo` |
| `#iconCalendar` | `#iconTaCalendar` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/drawers/quick-create/QuickCreateDrawer.vue
git commit -m "style(QuickCreateDrawer): 替换为 iconTa 自定义图标"
```

---

### 任务 6：替换 MobileWeixinSheet.vue 图标

**文件：** `src/mobile/drawers/weixin/MobileWeixinSheet.vue`

- [ ] **替换 1 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/drawers/weixin/MobileWeixinSheet.vue
git commit -m "style(MobileWeixinSheet): 替换为 iconTa 自定义图标"
```

---

### 任务 7：替换 MobileTaskCard.vue 图标

**文件：** `src/mobile/components/todo/MobileTaskCard.vue`

- [ ] **替换 1 种图标**

| 原值 | 新值 |
|------|------|
| `#iconCheck` | `#iconTaCheck` |

- [ ] **运行 typecheck + lint**

- [ ] **Commit**

```bash
git add src/mobile/components/todo/MobileTaskCard.vue
git commit -m "style(MobileTaskCard): 替换为 iconTa 自定义图标"
```

---

### 任务 8：全量验证

- [ ] **运行全部测试**：`npm run test`
- [ ] **运行 lint**：`npm run lint`
- [ ] **运行 typecheck**：`npm run typecheck`
