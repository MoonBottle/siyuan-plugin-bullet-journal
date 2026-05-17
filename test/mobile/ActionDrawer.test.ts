// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';

const mockWriteBlock = vi.hoisted(() => vi.fn(async () => true));

vi.mock('@/i18n', () => ({
  t: vi.fn(() => ''),
}));

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    add: () => ({
      format: () => '2026-05-02',
    }),
  }),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}));

async function mountDrawer(props: Record<string, unknown>) {
  const { default: ActionDrawer } = await import('@/mobile/drawers/action/ActionDrawer.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const events: Array<{ name: string; payload: unknown }> = [];
  const app = createApp(ActionDrawer, {
    ...props,
    'onUpdate:modelValue': (payload: unknown) => {
      events.push({ name: 'update:modelValue', payload });
    },
  });
  app.mount(container);
  await nextTick();

  return {
    events,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('ActionDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses BlockWriter setStatus when completing an item', async () => {
    const mounted = await mountDrawer({
      modelValue: true,
      item: {
        blockId: 'block-1',
        content: '整理资料',
        date: '2026-05-01',
        status: 'pending',
      },
    });

    (document.body.querySelector('.action-complete') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setStatus', status: 'completed' },
    );
    expect(mounted.events).toEqual([
      { name: 'update:modelValue', payload: false },
    ]);

    mounted.unmount();
  });

  it('uses BlockWriter addDate when migrating an item', async () => {
    const mounted = await mountDrawer({
      modelValue: true,
      item: {
        blockId: 'block-2',
        content: '迁移事项',
        date: '2026-05-01',
        startDateTime: '2026-05-01 09:00',
        endDateTime: '2026-05-01 10:00',
        siblingItems: [{ date: '2026-05-03' }],
        status: 'pending',
      },
    });

    (document.body.querySelector('.action-migrate') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-2' },
      {
        type: 'addDate',
        date: '2026-05-02',
        status: 'pending',
        startTime: '09:00',
        endTime: '10:00',
        allDay: false,
        originalDate: '2026-05-01',
        siblingItems: [
          { date: '2026-05-03' },
          {
            date: '2026-05-01',
            startDateTime: '2026-05-01 09:00',
            endDateTime: '2026-05-01 10:00',
            timePrecision: undefined,
          },
        ],
        timePrecision: undefined,
      },
    );
    expect(mounted.events).toEqual([
      { name: 'update:modelValue', payload: false },
    ]);

    mounted.unmount();
  });
});
