# 统一项目标签页顶栏样式 Spec

## Why
项目标签页 (ProjectTab) 的顶栏样式与日历标签页 (CalendarTab) 不一致。日历标签页使用了思源主题统一的 `.block__icons` 工具栏样式，而项目标签页使用了自定义的 `.tab-header` 样式。为了保持一致的用户体验，需要将项目标签页的顶栏样式修改为与日历标签页一致。

## What Changes
- 修改 ProjectTab.vue 的顶栏结构，从自定义的 `.tab-header` + `.tab-toolbar` 改为使用 `.block__icons` 样式
- 将刷新按钮从 SyButton 组件改为使用 `.block__icon` 图标按钮
- 保持分组选择器的功能和位置
- 保持整体布局和功能不变

## Impact
- 影响文件: `src/tabs/ProjectTab.vue`
- 视觉变化: 顶栏样式与日历标签页统一
- 功能变化: 无，仅样式调整

## ADDED Requirements
无新增功能

## MODIFIED Requirements
### Requirement: 项目标签页顶栏样式
项目标签页的顶栏 SHALL 使用与日历标签页一致的 `.block__icons` 样式。

#### Scenario: 正常显示
- **WHEN** 用户打开项目标签页
- **THEN** 顶栏显示为思源主题统一的工具栏样式
- **AND** 包含分组选择器下拉框
- **AND** 包含刷新图标按钮

#### Scenario: 交互功能
- **WHEN** 用户点击刷新按钮
- **THEN** 触发项目数据刷新
- **AND** 加载状态通过图标变化或提示反馈

## REMOVED Requirements
无移除功能
