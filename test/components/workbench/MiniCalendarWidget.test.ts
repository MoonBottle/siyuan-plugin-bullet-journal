// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import type { CalendarEvent } from '@/types/models';

const {
  mockGetFilteredCalendarEvents,
  mockCalendarPrev,
  mockCalendarNext,
  mockCalendarToday,
} = vi.hoisted(() => ({
  mockGetFilteredCalendarEvents: vi.fn(),
  mockCalendarPrev: vi.fn(),
  mockCalendarNext: vi.fn(),
  mockCalendarToday: vi.fn(),
}));

vi.mock('@/components/calendar/CalendarView.vue', () => ({
  default: defineComponent({
    name: 'CalendarViewStub',
    props: ['events', 'initialView'],
    emits: ['navigated'],
    setup(props, { emit, expose }) {
      expose({
        prev: mockCalendarPrev,
        next: mockCalendarNext,
        today: mockCalendarToday,
        getTitle: () => 'May 2, 2026',
        getDate: () => new Date('2026-05-02T00:00:00'),
      });

      return () => h('div', {
        'data-testid': 'calendar-view-stub',
        'data-event-count': String((props.events ?? []).length),
        'data-initial-view': props.initialView,
        onClick: () => emit('navigated'),
      });
    },
  }),
}));

vi.mock('@/components/workbench/widgets/useSafeProjectStore', () => ({
  useSafeProjectStore: () => ({
    getFilteredCalendarEvents: mockGetFilteredCalendarEvents,
  }),
}));

async function mountWidget(widgetConfig: Record<string, unknown>) {
  const { default: MiniCalendarWidget } = await import('@/components/workbench/widgets/MiniCalendarWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MiniCalendarWidget, {
    widget: {
      id: 'widget-1',
      type: 'miniCalendar',
      title: 'Calendar',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      config: widgetConfig,
    },
  });

  app.use(createPinia());
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('MiniCalendarWidget', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders CalendarView with filtered events and fixed day view', async () => {
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'Daily Standup',
        start: '2026-05-02T09:00:00',
        end: '2026-05-02T09:30:00',
        allDay: false,
        extendedProps: {
          hasItems: false,
          docId: 'doc-1',
          lineNumber: 1,
        },
      },
      {
        id: 'event-2',
        title: 'Review',
        start: '2026-05-02T14:00:00',
        end: '2026-05-02T15:00:00',
        allDay: false,
        extendedProps: {
          hasItems: false,
          docId: 'doc-2',
          lineNumber: 2,
        },
      },
    ];
    mockGetFilteredCalendarEvents.mockReturnValue(events);

    const mounted = await mountWidget({
      groupId: 'group-a',
      view: 'timeGridDay',
    });

    expect(mockGetFilteredCalendarEvents).toHaveBeenCalledWith('group-a');
    expect(mounted.container.querySelector('[data-testid="calendar-view-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-event-count="2"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-initial-view="timeGridDay"]')).not.toBeNull();

    mounted.unmount();
  });

  it('shows the day header and reuses calendar navigation controls in day view widgets', async () => {
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'Daily Standup',
        start: '2026-05-02T09:00:00',
        end: '2026-05-02T11:00:00',
        allDay: false,
        extendedProps: {
          hasItems: false,
          docId: 'doc-1',
          lineNumber: 1,
          date: '2026-05-02',
        },
      },
    ];
    mockGetFilteredCalendarEvents.mockReturnValue(events);

    const mounted = await mountWidget({
      groupId: 'group-a',
      view: 'timeGridDay',
    });
    await new Promise(resolve => setTimeout(resolve, 120));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="workbench-mini-calendar-day-header"]')).not.toBeNull();
    expect(mounted.container.textContent).toContain('May 2, 2026');
    expect(mounted.container.textContent).toContain('Work Hours 2:00');

    const buttons = mounted.container.querySelectorAll('.workbench-widget-mini-calendar__header .block__icon');
    (buttons[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (buttons[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (buttons[2] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mockCalendarPrev).toHaveBeenCalled();
    expect(mockCalendarNext).toHaveBeenCalled();
    expect(mockCalendarToday).toHaveBeenCalled();

    mounted.unmount();
  });
});
