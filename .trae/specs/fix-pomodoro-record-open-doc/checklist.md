# Checklist

- [x] PomodoroRecordList.vue 中的 `handleRecordClick` 函数不再使用 `(window as any).siyuan?.app`
- [x] PomodoroRecordList.vue 中的 `handleRecordClick` 函数使用 `usePlugin()` 获取插件实例
- [x] PomodoroRecordList.vue 中的 `handleRecordClick` 函数使用可靠的 `openTab` 调用方式
- [ ] 文档未打开时点击专注记录不会报错
- [ ] 文档已打开时点击专注记录能正常跳转
