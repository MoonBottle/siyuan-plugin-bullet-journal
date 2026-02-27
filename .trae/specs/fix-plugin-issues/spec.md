# 修复插件问题 Spec

## Why
根据代码审查反馈，需要修复以下三个问题：
1. README 文件中的链接使用了相对路径，在 SiYuan 插件市场中无法正常跳转
2. asset 目录中的文件没有被使用，但被打包到 dist 中，增加了包体积
3. 插件卸载时没有删除插件配置文件

## What Changes
- **修复 README 链接**: 将相对路径 `./README_zh_CN.md` 和 `./README.md` 改为绝对路径
- **移除未使用的 asset 目录打包**: 从 vite.config.ts 中移除 asset 目录的复制配置
- **添加卸载清理逻辑**: 在插件类中添加 `uninstall()` 方法，删除插件数据

## Impact
- Affected specs: 插件打包配置、插件生命周期管理
- Affected code: README.md, README_zh_CN.md, vite.config.ts, src/index.ts

## ADDED Requirements
### Requirement: 插件卸载时清理数据
The system SHALL 在插件卸载时删除插件存储的数据文件

#### Scenario: 用户卸载插件
- **WHEN** 用户卸载插件时
- **THEN** 插件应调用 `this.removeData('settings')` 删除设置数据
- **AND** 错误处理应使用 `showMessage` 显示友好的错误信息

## MODIFIED Requirements
### Requirement: README 链接格式
**原需求**: README 文件使用相对路径链接
**修改后**: README 文件应使用适合 SiYuan 插件市场的链接格式

### Requirement: 构建配置
**原需求**: vite.config.ts 复制 asset 目录到 dist
**修改后**: vite.config.ts 不再复制 asset 目录

## REMOVED Requirements
### Requirement: Asset 目录打包
**Reason**: asset 目录中的文件仅用于 GitHub 展示，不需要打包到插件中
**Migration**: 无需迁移，GitHub 上的图片链接仍然有效
