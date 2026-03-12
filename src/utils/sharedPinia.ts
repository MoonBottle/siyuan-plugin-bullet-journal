/**
 * 插件内共享的 Pinia 实例
 * 独立模块避免循环依赖（PomodoroTimerDialog 等组件需在无 Pinia 的 Dialog 中挂载时使用）
 */
import type { Pinia } from 'pinia';

let sharedPinia: Pinia | null = null;

export function getSharedPinia(): Pinia | null {
  return sharedPinia;
}

export function setSharedPinia(pinia: Pinia | null): void {
  sharedPinia = pinia;
}
