import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { persistCalendarEventChange } from '@/utils/calendarEventChange';

const { mockShowMessage, mockWriteBlock } = vi.hoisted(() => ({
  mockShowMessage: vi.fn(),
  mockWriteBlock: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: mockShowMessage,
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}));

describe('persistCalendarEventChange', () => {
  beforeEach(() => {
    initI18n('zh_CN');
    vi.clearAllMocks();
  });

  it('persists moved timed events back to document blocks', async () => {
    mockWriteBlock.mockResolvedValue(true);

    const result = await persistCalendarEventChange({
      blockId: 'block-1',
      allDay: false,
      start: '2026-05-02T10:00:00',
      end: '2026-05-02T11:30:00',
      date: '2026-05-01',
      originalStartDateTime: '2026-05-01 09:00:00',
      originalEndDateTime: '2026-05-01 10:00:00',
      siblingItems: [
        {
          date: '2026-05-03',
          startDateTime: '2026-05-03 14:00:00',
          endDateTime: '2026-05-03 15:00:00',
        },
      ],
      status: 'pending',
    }, 'move');

    expect(result).toBe(true);
    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      {
        type: 'addDate',
        date: '2026-05-02',
        startTime: '10:00:00',
        endTime: '11:30:00',
        allDay: false,
        originalDate: '2026-05-01',
        siblingItems: [
          {
            date: '2026-05-03',
            startDateTime: '2026-05-03 14:00:00',
            endDateTime: '2026-05-03 15:00:00',
          },
          {
            date: '2026-05-01',
            startDateTime: '2026-05-01 09:00:00',
            endDateTime: '2026-05-01 10:00:00',
            timePrecision: 'second',
          },
        ],
        timePrecision: 'second',
      },
    );
    expect(mockShowMessage).toHaveBeenCalledTimes(1);
  });

  it('shows an error when blockId is missing', async () => {
    const result = await persistCalendarEventChange({
      start: '2026-05-02T10:00:00',
    }, 'resize');

    expect(result).toBe(false);
    expect(mockWriteBlock).not.toHaveBeenCalled();
    expect(mockShowMessage).toHaveBeenCalledTimes(1);
  });
});
