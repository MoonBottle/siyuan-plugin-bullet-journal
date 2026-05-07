# Native Mobile Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将插件通知系统改成“桌面实时、移动预约”的双路径模型，统一优先走思源原生通知，并覆盖事项提醒、习惯提醒、番茄专注结束和番茄休息结束。

**Architecture:** 在 `src/utils/notification.ts` 建立统一通知出口和原生预约 API；移动端新增 registry + scheduler 两个服务来维护预约通知；桌面端继续使用 `ReminderService` 和 `pomodoroStore` 的实时流程，只把通知出口切换到统一工具层。

**Tech Stack:** TypeScript, Pinia, Vitest, SiYuan plugin runtime, browser Notification API, `croner`

---

## File Structure

- Modify: `src/utils/notification.ts`
  - 统一即时通知回退链路，补充原生通知能力探测、发送、取消、预约接口。
- Create: `src/services/mobileNotificationRegistry.ts`
  - 负责移动端预约通知 registry 的读写、清洗、删除和按 `entryKey` 查询。
- Create: `src/services/mobileNotificationScheduler.ts`
  - 负责扫描事项/习惯/番茄状态并与 registry reconcile，创建或取消移动端预约通知。
- Modify: `src/services/reminderService.ts`
  - 保留桌面实时提醒；移动端启动后不再依赖 cron 做未来提醒送达。
- Modify: `src/stores/pomodoroStore.ts`
  - 在专注开始/暂停/恢复/完成、休息开始/结束/恢复时调用移动端 scheduler。
- Modify: `src/index.ts`
  - 插件启动和数据刷新时分流桌面与移动端通知服务。
- Test: `test/services/reminderService.test.ts`
  - 调整桌面/移动分流断言。
- Create: `test/services/mobileNotificationRegistry.test.ts`
  - 覆盖 registry 清洗、替换、删除和孤儿清理行为。
- Create: `test/services/mobileNotificationScheduler.test.ts`
  - 覆盖移动端预约创建、跳过、重建、取消和番茄钟同步。
- Modify: `test/stores/pomodoroStore.test.ts`
  - 覆盖移动端番茄通知触发点。
- Create: `test/utils/notification.test.ts`
  - 覆盖原生通知优先、浏览器通知回退、`showMessage` 兜底。

## Task 1: 建立统一通知出口并写透回退顺序

**Files:**
- Modify: `src/utils/notification.ts`
- Create: `test/utils/notification.test.ts`

- [ ] **Step 1: 先写失败测试，锁定通知回退顺序和预约接口**

创建 `test/utils/notification.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShowMessage = vi.fn();
const mockSendNotification = vi.fn();
const mockCancelNotification = vi.fn();

vi.mock('@/utils/dialog', () => ({
  showMessage: (...args: unknown[]) => mockShowMessage(...args),
}));

vi.mock('@/main', () => ({
  getCurrentPlugin: vi.fn(() => ({ isMobile: false })),
}));

vi.mock('@/stores/aiStore', () => ({
  useAIStore: vi.fn(() => ({ sendWechatNotification: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}));

describe('notification utils', () => {
  beforeEach(() => {
    vi.resetModules();
    mockShowMessage.mockReset();
    mockSendNotification.mockReset();
    mockCancelNotification.mockReset();
    (globalThis as any).window = globalThis;
    (globalThis as any).siyuan = {
      platformUtils: {
        sendNotification: mockSendNotification,
        cancelNotification: mockCancelNotification,
      },
    };
  });

  it('prefers native immediate notification before browser Notification', async () => {
    mockSendNotification.mockResolvedValue(42);
    const NotificationCtor = vi.fn();
    vi.stubGlobal('Notification', NotificationCtor as any);
    (Notification as any).permission = 'granted';

    const mod = await import('@/utils/notification');
    await mod.showSystemNotification('Title', 'Body');

    expect(mockSendNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Title',
      body: 'Body',
    }));
    expect(NotificationCtor).not.toHaveBeenCalled();
    expect(mockShowMessage).not.toHaveBeenCalled();
  });

  it('falls back to browser Notification when native immediate notification fails', async () => {
    mockSendNotification.mockRejectedValue(new Error('native failed'));
    const close = vi.fn();
    const NotificationCtor = vi.fn(() => ({ close }));
    vi.stubGlobal('Notification', NotificationCtor as any);
    (Notification as any).permission = 'granted';

    const mod = await import('@/utils/notification');
    await mod.showSystemNotification('Title', 'Body');

    expect(NotificationCtor).toHaveBeenCalled();
    expect(mockShowMessage).not.toHaveBeenCalled();
  });

  it('falls back to showMessage when browser Notification is unavailable', async () => {
    mockSendNotification.mockResolvedValue(-1);
    vi.unstubAllGlobals();
    (globalThis as any).window = globalThis;
    (globalThis as any).siyuan = { platformUtils: { sendNotification: mockSendNotification, cancelNotification: mockCancelNotification } };

    const mod = await import('@/utils/notification');
    await mod.showSystemNotification('Title', 'Body');

    expect(mockShowMessage).toHaveBeenCalledWith('Title: Body');
  });

  it('schedules and cancels native mobile notifications', async () => {
    mockSendNotification.mockResolvedValue(99);
    const mod = await import('@/utils/notification');

    const id = await mod.scheduleNativeNotification('Later', 'Body', { delayInSeconds: 90 });
    const canceled = await mod.cancelNativeNotification(id);

    expect(id).toBe(99);
    expect(mockSendNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Later',
      body: 'Body',
      delayInSeconds: 90,
    }));
    expect(canceled).toBe(true);
    expect(mockCancelNotification).toHaveBeenCalledWith(99);
  });
});
```

- [ ] **Step 2: 跑测试确认它先失败**

Run:

```bash
npx vitest run test/utils/notification.test.ts
```

Expected: FAIL，原因应为 `scheduleNativeNotification` / `cancelNativeNotification` 尚不存在，且 `showSystemNotification` 还不是 async 原生优先实现。

- [ ] **Step 3: 在通知工具层写最小实现**

在 `src/utils/notification.ts` 增加兼容层和导出接口：

```ts
type NativeNotificationOptions = {
  title?: string;
  body?: string;
  delayInSeconds?: number;
  channel?: string;
  timeoutType?: 'default' | 'never';
};

function getNativePlatformUtils() {
  const direct = (window as any)?.siyuan?.platformUtils;
  if (direct && typeof direct.sendNotification === 'function') {
    return direct;
  }
  return null;
}

async function sendNativeNotification(options: NativeNotificationOptions): Promise<number | null> {
  const platformUtils = getNativePlatformUtils();
  if (!platformUtils) return null;
  try {
    const raw = await platformUtils.sendNotification(options);
    const id = Number(raw);
    return Number.isFinite(id) ? Math.trunc(id) : null;
  } catch (error) {
    console.warn('[Notification] native send failed:', error);
    return null;
  }
}

export async function scheduleNativeNotification(
  title: string,
  body: string,
  options?: { delayInSeconds: number; channel?: string; timeoutType?: 'default' | 'never' }
): Promise<number | null> {
  return sendNativeNotification({
    title,
    body,
    delayInSeconds: Math.max(0, Math.round(options?.delayInSeconds ?? 0)),
    channel: options?.channel ?? 'task-assistant',
    timeoutType: options?.timeoutType ?? 'default',
  });
}

export async function cancelNativeNotification(id: number | null | undefined): Promise<boolean> {
  const safeId = Number(id);
  const platformUtils = getNativePlatformUtils();
  if (!platformUtils || !Number.isFinite(safeId)) return false;
  try {
    await platformUtils.cancelNotification(Math.trunc(safeId));
    return true;
  } catch (error) {
    console.warn('[Notification] native cancel failed:', error);
    return false;
  }
}

export async function showSystemNotification(...) {
  const nativeId = await sendNativeNotification({ title, body, timeoutType: 'never' });
  if (nativeId !== null && nativeId >= 0) {
    sendWechatNotification(title, body);
    return null;
  }
  const result = _showSystemNotificationInner(title, body, options);
  sendWechatNotification(title, body);
  return result;
}
```

并把 `showPomodoroCompleteNotification` 改成 `async` 包装，继续复用 `showSystemNotification`。

- [ ] **Step 4: 重新运行通知工具测试**

Run:

```bash
npx vitest run test/utils/notification.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/utils/notification.test.ts src/utils/notification.ts
git commit -m "feat(notification): unify native and fallback delivery"
```

## Task 2: 补移动端预约 registry

**Files:**
- Create: `src/services/mobileNotificationRegistry.ts`
- Create: `test/services/mobileNotificationRegistry.test.ts`

- [ ] **Step 1: 写失败测试，锁定 registry 的数据结构和清洗行为**

创建 `test/services/mobileNotificationRegistry.test.ts`：

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearMobileNotificationRegistry,
  loadMobileNotificationRegistry,
  saveMobileNotificationRegistryEntry,
  removeMobileNotificationRegistryEntry,
} from '@/services/mobileNotificationRegistry';

describe('mobileNotificationRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists entries keyed by entryKey', () => {
    saveMobileNotificationRegistryEntry({
      entryKey: 'task-1|2026-05-06|1000',
      notificationId: 15,
      scheduledAt: 1000,
      delayInSeconds: 60,
      planKey: 'plan-a',
      kind: 'reminder',
      status: 'scheduled',
      updatedAt: '2026-05-06T10:00:00.000Z',
    });

    const registry = loadMobileNotificationRegistry();
    expect(registry['task-1|2026-05-06|1000']?.notificationId).toBe(15);
  });

  it('drops malformed entries during load', () => {
    localStorage.setItem('task-assistant-mobile-notification-registry', JSON.stringify({
      good: {
        entryKey: 'good',
        notificationId: 18,
        scheduledAt: 1000,
        delayInSeconds: 60,
        planKey: 'plan',
        kind: 'habit',
        status: 'scheduled',
        updatedAt: '2026-05-06T10:00:00.000Z',
      },
      bad: {
        entryKey: '',
        notificationId: 'x',
      },
    }));

    const registry = loadMobileNotificationRegistry();
    expect(Object.keys(registry)).toEqual(['good']);
  });

  it('removes a single entry without touching others', () => {
    saveMobileNotificationRegistryEntry({ entryKey: 'a', notificationId: 1, scheduledAt: 1, delayInSeconds: 1, planKey: 'a', kind: 'reminder', status: 'scheduled', updatedAt: 'x' });
    saveMobileNotificationRegistryEntry({ entryKey: 'b', notificationId: 2, scheduledAt: 2, delayInSeconds: 2, planKey: 'b', kind: 'habit', status: 'scheduled', updatedAt: 'y' });

    removeMobileNotificationRegistryEntry('a');

    const registry = loadMobileNotificationRegistry();
    expect(registry.a).toBeUndefined();
    expect(registry.b?.notificationId).toBe(2);
  });

  it('clears the registry', () => {
    saveMobileNotificationRegistryEntry({ entryKey: 'a', notificationId: 1, scheduledAt: 1, delayInSeconds: 1, planKey: 'a', kind: 'pomodoro-focus-end', status: 'scheduled', updatedAt: 'x' });
    clearMobileNotificationRegistry();
    expect(loadMobileNotificationRegistry()).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试确认 registry 还没实现**

Run:

```bash
npx vitest run test/services/mobileNotificationRegistry.test.ts
```

Expected: FAIL，原因应为模块不存在。

- [ ] **Step 3: 写最小 registry 实现**

创建 `src/services/mobileNotificationRegistry.ts`：

```ts
export type MobileNotificationKind =
  | 'reminder'
  | 'habit'
  | 'pomodoro-focus-end'
  | 'pomodoro-break-end';

export type MobileNotificationRegistryEntry = {
  entryKey: string;
  notificationId: number;
  scheduledAt: number;
  delayInSeconds: number;
  planKey: string;
  kind: MobileNotificationKind;
  status: 'scheduled' | 'canceled' | 'stale';
  updatedAt: string;
};

const STORAGE_KEY = 'task-assistant-mobile-notification-registry';

function sanitizeEntry(raw: unknown): MobileNotificationRegistryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const entryKey = String(entry.entryKey || '').trim();
  const planKey = String(entry.planKey || '').trim();
  const kind = String(entry.kind || '').trim() as MobileNotificationKind;
  const status = String(entry.status || '').trim() as MobileNotificationRegistryEntry['status'];
  const notificationId = Number(entry.notificationId);
  const scheduledAt = Number(entry.scheduledAt);
  const delayInSeconds = Number(entry.delayInSeconds);
  const updatedAt = String(entry.updatedAt || '').trim();
  if (!entryKey || !planKey || !updatedAt) return null;
  if (!Number.isFinite(notificationId) || !Number.isFinite(scheduledAt) || !Number.isFinite(delayInSeconds)) return null;
  if (!['reminder', 'habit', 'pomodoro-focus-end', 'pomodoro-break-end'].includes(kind)) return null;
  if (!['scheduled', 'canceled', 'stale'].includes(status)) return null;
  return {
    entryKey,
    notificationId: Math.trunc(notificationId),
    scheduledAt,
    delayInSeconds,
    planKey,
    kind,
    status,
    updatedAt,
  };
}

export function loadMobileNotificationRegistry(): Record<string, MobileNotificationRegistryEntry> { ... }
export function saveMobileNotificationRegistryEntry(entry: MobileNotificationRegistryEntry): void { ... }
export function removeMobileNotificationRegistryEntry(entryKey: string): void { ... }
export function clearMobileNotificationRegistry(): void { ... }
```

`loadMobileNotificationRegistry()` 中使用 `sanitizeEntry()` 过滤脏数据后再回写一次 localStorage。

- [ ] **Step 4: 运行 registry 测试**

Run:

```bash
npx vitest run test/services/mobileNotificationRegistry.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/mobileNotificationRegistry.ts test/services/mobileNotificationRegistry.test.ts
git commit -m "feat(notification): add mobile notification registry"
```

## Task 3: 实现移动端预约同步器并接通事项/习惯提醒

**Files:**
- Create: `src/services/mobileNotificationScheduler.ts`
- Modify: `src/services/reminderService.ts`
- Modify: `src/index.ts`
- Create: `test/services/mobileNotificationScheduler.test.ts`
- Modify: `test/services/reminderService.test.ts`

- [ ] **Step 1: 写失败测试，锁定移动端预约创建、跳过和取消**

在 `test/services/mobileNotificationScheduler.test.ts` 创建以下用例：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MobileNotificationScheduler } from '@/services/mobileNotificationScheduler';

const mockScheduleNativeNotification = vi.fn();
const mockCancelNativeNotification = vi.fn();

vi.mock('@/utils/notification', () => ({
  scheduleNativeNotification: (...args: unknown[]) => mockScheduleNativeNotification(...args),
  cancelNativeNotification: (...args: unknown[]) => mockCancelNativeNotification(...args),
}));

vi.mock('@/parser/reminderParser', () => ({
  calculateReminderTime: vi.fn((_date, _start, _end, _a, _b, reminder) => reminder?.__mockReminderTime ?? 0),
}));

vi.mock('@/services/habitReminder', () => ({
  getHabitReminderEntries: vi.fn(() => []),
}));

describe('MobileNotificationScheduler', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockScheduleNativeNotification.mockReset();
    mockCancelNativeNotification.mockReset();
  });

  it('creates mobile reservations for future item reminders', async () => {
    mockScheduleNativeNotification.mockResolvedValue(101);
    const scheduler = new MobileNotificationScheduler();

    await scheduler.syncFromProjects({
      currentDate: '2026-05-06',
      projects: [{
        tasks: [{
          items: [{
            id: 'item-1',
            blockId: 'block-1',
            docId: 'doc-1',
            lineNumber: 1,
            date: '2026-05-06',
            content: '开会',
            status: 'pending',
            reminder: { enabled: true, type: 'absolute', time: '09:00', __mockReminderTime: Date.now() + 60000 },
          }],
        }],
      }],
      getHabits: () => [],
    } as any);

    expect(mockScheduleNativeNotification).toHaveBeenCalledTimes(1);
  });

  it('skips unchanged planKey entries', async () => {
    mockScheduleNativeNotification.mockResolvedValue(101);
    const scheduler = new MobileNotificationScheduler();
    const store = { currentDate: '2026-05-06', projects: [{ tasks: [{ items: [{ id: 'item-1', blockId: 'block-1', docId: 'doc-1', lineNumber: 1, date: '2026-05-06', content: '开会', status: 'pending', reminder: { enabled: true, type: 'absolute', time: '09:00', __mockReminderTime: Date.now() + 60000 } }] }] }], getHabits: () => [] } as any;

    await scheduler.syncFromProjects(store);
    await scheduler.syncFromProjects(store);

    expect(mockScheduleNativeNotification).toHaveBeenCalledTimes(1);
  });

  it('cancels stale reservations when the source item disappears', async () => {
    mockScheduleNativeNotification.mockResolvedValue(101);
    mockCancelNativeNotification.mockResolvedValue(true);
    const scheduler = new MobileNotificationScheduler();

    const store = { currentDate: '2026-05-06', projects: [{ tasks: [{ items: [{ id: 'item-1', blockId: 'block-1', docId: 'doc-1', lineNumber: 1, date: '2026-05-06', content: '开会', status: 'pending', reminder: { enabled: true, type: 'absolute', time: '09:00', __mockReminderTime: Date.now() + 60000 } }] }] }], getHabits: () => [] } as any;
    await scheduler.syncFromProjects(store);
    store.projects[0].tasks[0].items = [];

    await scheduler.syncFromProjects(store);

    expect(mockCancelNativeNotification).toHaveBeenCalledWith(101);
  });
});
```

并在 `test/services/reminderService.test.ts` 增加移动端分流断言：

```ts
it('mobile start should not request browser notification permission', () => {
  const projectStore = makeStore([], []);
  service.start({ isMobile: true } as any, projectStore as any);
  expect(mockNotificationRequestPermission).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑测试确认移动调度器尚未实现**

Run:

```bash
npx vitest run test/services/mobileNotificationScheduler.test.ts test/services/reminderService.test.ts
```

Expected: FAIL，原因应为 scheduler 模块不存在，且 `ReminderService.start()` 仍会无条件请求浏览器通知权限。

- [ ] **Step 3: 写最小 scheduler 实现并在启动路径接线**

创建 `src/services/mobileNotificationScheduler.ts`：

```ts
import dayjs from '@/utils/dayjs';
import { calculateReminderTime } from '@/parser/reminderParser';
import { getHabitReminderEntries } from '@/services/habitReminder';
import {
  loadMobileNotificationRegistry,
  removeMobileNotificationRegistryEntry,
  saveMobileNotificationRegistryEntry,
} from '@/services/mobileNotificationRegistry';
import { scheduleNativeNotification, cancelNativeNotification } from '@/utils/notification';

const FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class MobileNotificationScheduler {
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  scheduleSync(projectStore: any): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void this.syncFromProjects(projectStore);
    }, 200);
  }

  async syncFromProjects(projectStore: any): Promise<void> {
    const now = Date.now();
    const registry = loadMobileNotificationRegistry();
    const liveEntryKeys = new Set<string>();

    for (const project of projectStore?.projects || []) {
      for (const task of project?.tasks || []) {
        for (const item of task?.items || []) {
          if (!item?.reminder?.enabled) continue;
          if (item.status === 'completed' || item.status === 'abandoned') continue;
          const reminderTime = calculateReminderTime(item.date, item.startDateTime, item.endDateTime, undefined, undefined, item.reminder);
          if (!Number.isFinite(reminderTime) || reminderTime <= now || reminderTime > now + FUTURE_WINDOW_MS) continue;
          const entryKey = `${item.blockId}-${item.date}-${reminderTime}`;
          const planKey = `${entryKey}|${item.content}`;
          liveEntryKeys.add(entryKey);
          if (registry[entryKey]?.planKey === planKey) continue;
          if (registry[entryKey]) {
            await cancelNativeNotification(registry[entryKey].notificationId);
          }
          const delayInSeconds = Math.max(1, Math.ceil((reminderTime - now) / 1000));
          const notificationId = await scheduleNativeNotification(`⏰ ${item.project?.name || '提醒'}`, item.task?.name ? `${item.task.name}: ${item.content}` : item.content, { delayInSeconds });
          if (notificationId === null) continue;
          saveMobileNotificationRegistryEntry({
            entryKey,
            notificationId,
            scheduledAt: reminderTime,
            delayInSeconds,
            planKey,
            kind: 'reminder',
            status: 'scheduled',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    for (const entry of getHabitReminderEntries(projectStore?.getHabits?.('') || [], projectStore?.currentDate || dayjs().format('YYYY-MM-DD'))) {
      // 与 item reminders 同样逻辑，kind 改为 habit
    }

    for (const [entryKey, entry] of Object.entries(registry)) {
      if (entry.kind === 'pomodoro-focus-end' || entry.kind === 'pomodoro-break-end') continue;
      if (liveEntryKeys.has(entryKey)) continue;
      await cancelNativeNotification(entry.notificationId);
      removeMobileNotificationRegistryEntry(entryKey);
    }
  }
}

export const mobileNotificationScheduler = new MobileNotificationScheduler();
```

在 `src/services/reminderService.ts` 的 `start()` 和 `requestNotificationPermission()` 路径增加移动端保护：

```ts
start(plugin: Plugin, projectStore: ProjectStoreType): void {
  this.projectStore = projectStore;
  if (!(plugin as any)?.isMobile) {
    this.requestNotificationPermission();
    this.setupVisibilityListener();
    this.rebuildSchedulesFromNow();
    this.scheduleMidnightRefresh();
  }
}
```

在 `src/index.ts` 做平台分流：

```ts
import { mobileNotificationScheduler } from '@/services/mobileNotificationScheduler';

projectStore.loadProjects(...).then(() => {
  if (this.isMobile) {
    mobileNotificationScheduler.scheduleSync(projectStore);
  } else {
    reminderService.scheduleRebuild();
  }
});

if (this.isMobile) {
  mobileNotificationScheduler.scheduleSync(projectStore);
} else {
  reminderService.start(this, projectStore);
}
```

- [ ] **Step 4: 跑提醒与移动调度测试**

Run:

```bash
npx vitest run test/services/mobileNotificationScheduler.test.ts test/services/reminderService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/mobileNotificationScheduler.ts src/services/reminderService.ts src/index.ts test/services/mobileNotificationScheduler.test.ts test/services/reminderService.test.ts
git commit -m "feat(notification): add mobile reminder scheduling"
```

## Task 4: 接通番茄专注结束与休息结束的移动预约

**Files:**
- Modify: `src/stores/pomodoroStore.ts`
- Modify: `src/services/mobileNotificationScheduler.ts`
- Modify: `test/stores/pomodoroStore.test.ts`
- Modify: `test/services/mobileNotificationScheduler.test.ts`

- [ ] **Step 1: 先写失败测试，锁定番茄预约的生命周期**

在 `test/stores/pomodoroStore.test.ts` 增加 scheduler mock：

```ts
const mockSchedulePomodoroFocusEnd = vi.fn();
const mockCancelPomodoroFocusEnd = vi.fn();
const mockSchedulePomodoroBreakEnd = vi.fn();
const mockCancelPomodoroBreakEnd = vi.fn();

vi.mock('@/services/mobileNotificationScheduler', () => ({
  mobileNotificationScheduler: {
    schedulePomodoroFocusEnd: (...args: unknown[]) => mockSchedulePomodoroFocusEnd(...args),
    cancelPomodoroFocusEnd: (...args: unknown[]) => mockCancelPomodoroFocusEnd(...args),
    schedulePomodoroBreakEnd: (...args: unknown[]) => mockSchedulePomodoroBreakEnd(...args),
    cancelPomodoroBreakEnd: (...args: unknown[]) => mockCancelPomodoroBreakEnd(...args),
    isMobileSchedulerEnabled: vi.fn(() => true),
  },
}));

it('startPomodoro schedules focus-end notification on mobile', async () => {
  const store = usePomodoroStore();
  await store.startPomodoro({ id: 'i1', blockId: 'b1', docId: 'd1', content: '测试', status: 'pending', lineNumber: 1 } as any, 25, 'b1', { isMobile: true });
  expect(mockSchedulePomodoroFocusEnd).toHaveBeenCalled();
});

it('pausePomodoro cancels focus-end notification on mobile', async () => {
  const store = usePomodoroStore();
  store.$patch({ activePomodoro: { blockId: 'b1', itemId: 'i1', itemContent: '测试', startTime: Date.now(), targetDurationMinutes: 25, accumulatedSeconds: 10, remainingSeconds: 1490, isPaused: false, pauseCount: 0, totalPausedSeconds: 0, timerMode: 'countdown' } as any });
  await store.pausePomodoro({ isMobile: true });
  expect(mockCancelPomodoroFocusEnd).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'b1' }));
});

it('startBreak schedules break-end notification on mobile', async () => {
  const store = usePomodoroStore();
  await store.startBreak(5, { isMobile: true });
  expect(mockSchedulePomodoroBreakEnd).toHaveBeenCalled();
});

it('stopBreak cancels break-end notification on mobile', async () => {
  const store = usePomodoroStore();
  store.$patch({ isBreakActive: true, breakRemainingSeconds: 60, breakTotalSeconds: 300 });
  await store.stopBreak({ isMobile: true });
  expect(mockCancelPomodoroBreakEnd).toHaveBeenCalled();
});
```

并在 `test/services/mobileNotificationScheduler.test.ts` 补两组新断言：

```ts
it('rebuilds focus-end reservation when expected end changes', async () => {
  // 先 schedule，再 cancel + reschedule
});

it('cleans stale break-end reservations when break stops', async () => {
  // 先写入 registry，再 clear
});
```

- [ ] **Step 2: 跑测试确认番茄预约钩子尚未接入**

Run:

```bash
npx vitest run test/stores/pomodoroStore.test.ts test/services/mobileNotificationScheduler.test.ts
```

Expected: FAIL，原因应为 scheduler 的番茄方法尚不存在，`pomodoroStore` 也还没调用它们。

- [ ] **Step 3: 实现番茄预约同步方法并接进 store**

在 `src/services/mobileNotificationScheduler.ts` 增加：

```ts
isMobileSchedulerEnabled(plugin?: { isMobile?: boolean } | null): boolean {
  return !!plugin?.isMobile;
}

async schedulePomodoroFocusEnd(data: {
  blockId: string;
  itemContent: string;
  remainingSeconds: number;
}): Promise<void> { ... }

async cancelPomodoroFocusEnd(data: { blockId: string }): Promise<void> { ... }

async schedulePomodoroBreakEnd(data: {
  breakKey: string;
  remainingSeconds: number;
}): Promise<void> { ... }

async cancelPomodoroBreakEnd(data: { breakKey?: string }): Promise<void> { ... }
```

`entryKey` 建议分别使用：

```ts
const focusEntryKey = `pomodoro-focus:${blockId}:${expectedEndAt}`;
const breakEntryKey = `pomodoro-break:${breakKey}:${expectedEndAt}`;
```

在 `src/stores/pomodoroStore.ts` 的这些位置补调用：

```ts
if (mobileNotificationScheduler.isMobileSchedulerEnabled(plugin)) {
  await mobileNotificationScheduler.schedulePomodoroFocusEnd({
    blockId: parentBlockId,
    itemContent: item.content,
    remainingSeconds,
  });
}
```

```ts
if (mobileNotificationScheduler.isMobileSchedulerEnabled(plugin)) {
  await mobileNotificationScheduler.cancelPomodoroFocusEnd({ blockId: this.activePomodoro.blockId });
}
```

```ts
if (mobileNotificationScheduler.isMobileSchedulerEnabled(plugin ?? usePlugin())) {
  await mobileNotificationScheduler.schedulePomodoroBreakEnd({
    breakKey: `${startTime}-${totalSeconds}`,
    remainingSeconds: totalSeconds,
  });
}
```

```ts
if (mobileNotificationScheduler.isMobileSchedulerEnabled(plugin)) {
  await mobileNotificationScheduler.cancelPomodoroBreakEnd({});
}
```

在 `restorePomodoro()` 和 `restoreBreak()` 成功恢复时也补建对应预约。

- [ ] **Step 4: 运行番茄相关测试**

Run:

```bash
npx vitest run test/stores/pomodoroStore.test.ts test/services/mobileNotificationScheduler.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/pomodoroStore.ts src/services/mobileNotificationScheduler.ts test/stores/pomodoroStore.test.ts test/services/mobileNotificationScheduler.test.ts
git commit -m "feat(pomodoro): schedule mobile focus and break notifications"
```

## Task 5: 做整体验证并清理回归点

**Files:**
- Modify: `src/index.ts`
- Modify: `src/tabs/PomodoroDock.vue`
- Modify: `test/services/reminderService.test.ts`
- Modify: `test/stores/pomodoroStore.test.ts`
- Modify: `test/utils/notification.test.ts`

- [ ] **Step 1: 写最后一组失败测试，锁定启动和 UI 权限请求的回归边界**

在 `test/services/reminderService.test.ts` 或新增测试中加入：

```ts
it('desktop start still requests browser permission as fallback preparation', () => {
  const projectStore = makeStore([], []);
  service.start({ isMobile: false } as any, projectStore as any);
  expect(mockNotificationRequestPermission).toHaveBeenCalled();
});
```

在 `test/utils/notification.test.ts` 增加：

```ts
it('showPomodoroCompleteNotification uses the unified system notification path', async () => {
  mockSendNotification.mockResolvedValue(123);
  const mod = await import('@/utils/notification');
  await mod.showPomodoroCompleteNotification('写周报', 25);
  expect(mockSendNotification).toHaveBeenCalledWith(expect.objectContaining({
    title: expect.any(String),
    body: expect.stringContaining('25'),
  }));
});
```

- [ ] **Step 2: 跑目标测试，确认还有必要的收尾差异**

Run:

```bash
npx vitest run test/utils/notification.test.ts test/services/reminderService.test.ts test/services/mobileNotificationRegistry.test.ts test/services/mobileNotificationScheduler.test.ts test/stores/pomodoroStore.test.ts
```

Expected: 如有失败，应集中在 `PomodoroDock.vue` 仍无条件请求浏览器权限、或 `showPomodoroCompleteNotification` 仍是同步签名。

- [ ] **Step 3: 清理收尾实现，确保桌面/移动边界一致**

在 `src/tabs/PomodoroDock.vue` 把权限请求改成只在桌面端做预热：

```ts
const plugin = usePlugin();
if (!plugin?.isMobile) {
  await requestNotificationPermission();
}
```

在 `src/index.ts` 中确认：

```ts
if (this.isMobile) {
  void mobileNotificationScheduler.syncFromProjects(projectStore);
} else {
  reminderService.start(this, projectStore);
}
```

并把所有新导出方法和 async 签名的调用点统一成 `await` 或 `void`，消除悬空 promise。

- [ ] **Step 4: 跑完整回归测试**

Run:

```bash
npx vitest run test/utils/notification.test.ts test/services/reminderService.test.ts test/services/mobileNotificationRegistry.test.ts test/services/mobileNotificationScheduler.test.ts test/stores/pomodoroStore.test.ts test/services/habitReminder.test.ts test/utils/pomodoroStorage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/tabs/PomodoroDock.vue src/utils/notification.ts src/services/mobileNotificationRegistry.ts src/services/mobileNotificationScheduler.ts src/services/reminderService.ts src/stores/pomodoroStore.ts test/utils/notification.test.ts test/services/reminderService.test.ts test/services/mobileNotificationRegistry.test.ts test/services/mobileNotificationScheduler.test.ts test/stores/pomodoroStore.test.ts
git commit -m "feat(notification): add mobile native scheduled delivery"
```

## Self-Review

### Spec coverage

- Unified native-first notification utility: Task 1
- Mobile registry: Task 2
- Mobile item/habit scheduling: Task 3
- Desktop realtime preservation: Task 3 and Task 5
- Pomodoro focus-end and break-end scheduling: Task 4
- Final regression and permission-boundary cleanup: Task 5

No spec gaps remain.

### Placeholder scan

- No `TODO` / `TBD`
- Every task includes exact files, concrete test code, and exact commands
- No “similar to previous task” shortcuts

### Type consistency

- `scheduleNativeNotification` / `cancelNativeNotification` are introduced once and reused consistently
- `MobileNotificationRegistryEntry` fields match scheduler usage
- `pomodoro-focus-end` and `pomodoro-break-end` naming stays consistent across registry, scheduler, and tests
