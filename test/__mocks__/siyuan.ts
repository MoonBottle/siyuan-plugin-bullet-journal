/**
 * siyuan 包 mock
 * 用于测试时模拟思源 API
 */
import { vi } from 'vitest';

export const openTab = vi.fn();

// 其他可能需要的导出
export const showMessage = vi.fn();
export const fetchSyncPost = vi.fn();
export const fetchPost = vi.fn();
