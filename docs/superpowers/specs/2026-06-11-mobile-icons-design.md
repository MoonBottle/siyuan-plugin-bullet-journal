# Mobile 端图标统一为 iconTa 设计

## 背景

Mobile 端当前混用 SiYuan 内置图标（`#iconXxx`）和自定义图标（`#iconTaXxx`）。需要将 `icons.ts` 中已有对应 `iconTa` 版本的图标全部替换，统一视觉风格。

## 映射关系

| SiYuan 内置 | iconTa 对应 |
|---|---|
| `#iconCheck` | `#iconTaCheck` |
| `#iconClock` | `#iconTaTimer` |
| `#iconForward` | `#iconTaSkipForward` |
| `#iconInfo` | `#iconTaInfo` |
| `#iconCalendar` | `#iconTaCalendar` |

## 不替换的图标

以下 SiYuan 内置图标在 `icons.ts` 中没有 iconTa 对应，保持不变：
iconDown、iconRight、iconClose、iconFolder、iconList、iconEdit、iconSearch、iconAdd、iconRefresh、iconLeft、iconMark、iconFire、iconLeaf、iconEye、iconSettings、iconCircle、iconInbox、iconCopy、iconWeixin、iconCloseRound、iconHistory

## 涉及文件

- ActionDrawer.vue — iconCheck、iconClock、iconForward、iconInfo、iconCalendar
- MobileItemDetail.vue — iconCheck、iconClock、iconForward、iconCalendar
- MobileTodoList.vue — iconClock
- SettingsDrawer.vue — iconCheck、iconInfo
- QuickCreateDrawer.vue — iconClock、iconInfo、iconCalendar、iconCheck
- MobileWeixinSheet.vue — iconCheck
- MobileTaskCard.vue — iconCheck

## 变更

纯字符串替换，无逻辑变更。每个文件中将 `#iconCheck` → `#iconTaCheck`、`#iconClock` → `#iconTaTimer`、`#iconForward` → `#iconTaSkipForward`、`#iconInfo` → `#iconTaInfo`、`#iconCalendar` → `#iconTaCalendar`。
