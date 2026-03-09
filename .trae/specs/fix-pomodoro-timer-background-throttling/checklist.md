# Checklist

- [x] `startTimer()` 方法使用 `Date.now()` 时间戳计算经过时间
- [x] `setInterval` 回调中不再使用 `accumulatedSeconds++` 累加
- [x] 添加了 `visibilitychange` 事件监听，页面重新可见时校准时间
- [x] `stopTimer()` 方法正确清理事件监听器
- [x] 后台运行 2-3 分钟后，dock 计时与实际时间一致
- [x] 悬浮窗和 dock 的时间显示保持一致
