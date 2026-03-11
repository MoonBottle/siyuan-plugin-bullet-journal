# 修复年度热力图布局 Spec

## Why
年度热力图的小方格超出了卡片容器，底部被截断。需要让小方格自适应高度，始终保持在卡片容器内。

## What Changes
- 修改 `AnnualHeatmap.vue` 的 CSS 布局
- 让小方格自适应容器高度，不超出卡片边界

## Impact
- Affected code: `src/components/pomodoro/stats/AnnualHeatmap.vue`

## ADDED Requirements
### Requirement: 热力图自适应布局
The system SHALL 确保热力图小方格始终保持在卡片容器内，不超出边界。

#### Scenario: 正常显示
- **WHEN** 用户查看年度热力图
- **THEN** 所有小方格都显示在卡片容器内
- **AND** 小方格高度自适应，不超出容器底部

## MODIFIED Requirements
无

## REMOVED Requirements
无
