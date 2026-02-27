# Checklist

- [ ] README.md 中的语言切换链接已修复
- [ ] README_zh_CN.md 中的语言切换链接已修复
- [ ] vite.config.ts 中不再包含 asset 目录的复制配置
- [ ] src/index.ts 中已添加 uninstall() 方法
- [ ] uninstall() 方法正确调用 removeData('settings') 删除插件数据
- [ ] uninstall() 方法包含错误处理，使用 showMessage 显示错误信息
