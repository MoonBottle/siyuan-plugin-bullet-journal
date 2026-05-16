// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';

const mockWriteBlock = vi.hoisted(() => vi.fn(async () => true));

vi.mock('@/i18n', () => ({
  t: vi.fn(() => ''),
}));

vi.mock('@/utils/dateUtils', () => ({
  formatTimeRange: vi.fn(() => ''),
  formatDateLabel: vi.fn((date: string) => date),
  calculateDuration: vi.fn(() => ''),
}));

vi.mock('@/parser/priorityParser', () => ({
  PRIORITY_CONFIG: {
    high: { label: '高' },
    medium: { label: '中' },
    low: { label: '低' },
  },
}));

vi.mock('@/utils/displayUtils', () => ({
  formatReminderDisplay: vi.fn(() => 'reminder'),
}));

vi.mock('@/parser/recurringParser', () => ({
  generateRepeatRuleMarker: vi.fn(() => 'repeat'),
  generateEndConditionMarker: vi.fn(() => ''),
}));

vi.mock('@/stores', () => ({
  useSettingsStore: () => ({
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
  }),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}));

vi.mock('@/mobile/components/pickers/MobilePriorityPicker.vue', () => ({
  default: defineComponent({
    name: 'MobilePriorityPickerStub',
    setup() {
      return () => null;
    },
  }),
}));

vi.mock('@/mobile/components/pickers/MobileDatePicker.vue', () => ({
  default: defineComponent({
    name: 'MobileDatePickerStub',
    emits: ['confirm', 'update:modelValue'],
    setup(_, { emit }) {
      return () => h('button', {
        'data-testid': 'mobile-date-confirm',
        onClick: () => emit('confirm', '2026-05-05'),
      }, 'confirm-date');
    },
  }),
}));

vi.mock('@/mobile/drawers/confirm/MobileConfirmDrawer.vue', () => ({
  default: defineComponent({
    name: 'MobileConfirmDrawerStub',
    setup() {
      return () => null;
    },
  }),
}));

vi.mock('@/mobile/components/time-picker', () => ({
  TimeSettingDrawer: defineComponent({
    name: 'TimeSettingDrawerStub',
    setup() {
      return () => null;
    },
  }),
}));

async function mountItemDetail(props: Record<string, unknown>) {
  const { default: MobileItemDetail } = await import('@/mobile/drawers/item/MobileItemDetail.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const events: Array<{ name: string; payload: unknown }> = [];
  const app = createApp(MobileItemDetail, {
    ...props,
    onRefresh: () => {
      events.push({ name: 'refresh', payload: undefined });
    },
    'onUpdate:modelValue': (payload: unknown) => {
      events.push({ name: 'update:modelValue', payload });
    },
  });
  app.mount(container);
  await nextTick();

  return {
    events,
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('MobileItemDetail actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses BlockWriter setContent when saving edited content', async () => {
    const mounted = await mountItemDetail({
      modelValue: true,
      item: {
        blockId: 'block-1',
        content: '旧内容',
        date: '2026-05-01',
        status: 'pending',
      },
    });

    (document.body.querySelector('.content-row.editable') as HTMLDivElement | null)?.click();
    await nextTick();

    const input = document.body.querySelector('.content-edit-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (input) {
      input.value = '新的事项';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    (document.body.querySelector('.edit-action-btn.confirm') as HTMLButtonElement | null)?.click();
    await Promise.resolve();
    await nextTick();

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setContent', newItemContent: '新的事项' },
    );
    expect(mounted.events).toContainEqual({ name: 'refresh', payload: undefined });

    mounted.unmount();
  });

  it('uses BlockWriter addDate when changing the item date', async () => {
    const mounted = await mountItemDetail({
      modelValue: true,
      item: {
        blockId: 'block-2',
        content: '迁移日期',
        date: '2026-05-01',
        startDateTime: '2026-05-01 14:00',
        endDateTime: '2026-05-01 15:00',
        siblingItems: [{ date: '2026-05-03' }],
        status: 'pending',
      },
    });

    const dateRow = Array.from(document.body.querySelectorAll('.info-item.editable'))
      .find(node => node.textContent?.includes('日期')) as HTMLElement | undefined;
    dateRow?.click();
    await nextTick();

    (document.body.querySelector('[data-testid="mobile-date-confirm"]') as HTMLButtonElement | null)?.click();
    await Promise.resolve();
    await nextTick();

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-2' },
      {
        type: 'addDate',
        date: '2026-05-05',
        startTime: '14:00',
        endTime: '15:00',
        allDay: false,
        originalDate: '2026-05-01',
        siblingItems: [
          { date: '2026-05-03' },
          {
            date: '2026-05-01',
            startDateTime: '2026-05-01 14:00',
            endDateTime: '2026-05-01 15:00',
            timePrecision: undefined,
          },
        ],
        timePrecision: undefined,
      },
    );
    expect(mounted.events).toContainEqual({ name: 'refresh', payload: undefined });

    mounted.unmount();
  });
});
