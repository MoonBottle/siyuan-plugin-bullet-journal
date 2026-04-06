# Calendar Pomodoro Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display pomodoro records as semi-transparent red background time blocks on the calendar day view, with duration labels and total focus time shown on event bars.

**Architecture:** Use FullCalendar's background event feature to render pomodoro records as non-interactive background blocks on the time axis. Each `PomodoroRecord` with `startTime`/`endTime` becomes a background event. Event bars gain a total focus time label on the right side. Settings control visibility.

**Tech Stack:** Vue 3 + FullCalendar 6 + Pinia + TypeScript + SCSS

---

### Task 1: Add settings fields and i18n

**Files:**
- Modify: `src/settings/types.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Add fields to CalendarSettings area in SettingsData**

In `src/settings/types.ts`, add 2 new fields to the `SettingsData` interface (after `lunchBreakEnd: string;`, around line 46):

```ts
  showPomodoroBlocks?: boolean;     // 日历日视图是否显示番茄钟时间块，默认 true
  showPomodoroTotal?: boolean;      // 事项条是否显示专注总时长，默认 true
```

Add defaults in `defaultSettings` (after `lunchBreakEnd: '13:00',`, around line 82):

```ts
  showPomodoroBlocks: true,
  showPomodoroTotal: true,
```

- [ ] **Step 2: Add zh_CN i18n keys**

In `src/i18n/zh_CN.json`, inside the `settings.calendar` object (after `"defaultViewDesc"` line, around line 139), add:

```json
      "showPomodoroBlocks": "显示番茄钟时间块",
      "showPomodoroBlocksDesc": "在日历日视图的时间轴上显示番茄钟专注时段",
      "showPomodoroTotal": "显示专注总时长",
      "showPomodoroTotalDesc": "在事项条右侧显示该事项的专注总时长",
      "pomodoroTotalLabel": "共专注{minutes}分钟"
```

- [ ] **Step 3: Add en_US i18n keys**

In `src/i18n/en_US.json`, inside the `settings.calendar` object (after `"defaultViewDesc"` line, around line 139), add:

```json
      "showPomodoroBlocks": "Show Pomodoro Blocks",
      "showPomodoroBlocksDesc": "Display pomodoro focus periods on the calendar day view timeline",
      "showPomodoroTotal": "Show Total Focus Time",
      "showPomodoroTotalDesc": "Display total focus time on the right side of event bars",
      "pomodoroTotalLabel": "{minutes}min total"
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add src/settings/types.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: add calendar pomodoro blocks settings and i18n"
```

---

### Task 2: Add settings UI in CalendarConfigSection

**Files:**
- Modify: `src/components/settings/CalendarConfigSection.vue`

- [ ] **Step 1: Add setting items to template**

In `src/components/settings/CalendarConfigSection.vue`, add after the existing `SySettingItem` for defaultView (before `</SySettingItemList>`), import `SySwitch` and add two toggle items:

Replace the entire template section with:

```html
<template>
  <SySettingsSection icon="iconCalendar" :title="t('settings').calendar.title">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').calendar.defaultView"
        :description="t('settings').calendar.defaultViewDesc"
      >
        <SySelect
          :model-value="calendarDefaultView"
          :options="viewOptions"
          @update:model-value="$emit('update:calendarDefaultView', $event)"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').calendar.showPomodoroBlocks"
        :description="t('settings').calendar.showPomodoroBlocksDesc"
      >
        <SySwitch
          :model-value="showPomodoroBlocks ?? true"
          @update:model-value="$emit('update:showPomodoroBlocks', $event)"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').calendar.showPomodoroTotal"
        :description="t('settings').calendar.showPomodoroTotalDesc"
      >
        <SySwitch
          :model-value="showPomodoroTotal ?? true"
          @update:model-value="$emit('update:showPomodoroTotal', $event)"
        />
      </SySettingItem>
    </SySettingItemList>
  </SySettingsSection>
</template>
```

Update the `<script setup>` to add new props, emits, and import:

```ts
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';

defineProps<{
  calendarDefaultView: string;
  showPomodoroBlocks?: boolean;
  showPomodoroTotal?: boolean;
}>();

defineEmits<{
  'update:calendarDefaultView': [value: string];
  'update:showPomodoroBlocks': [value: boolean];
  'update:showPomodoroTotal': [value: boolean];
}>();

const viewOptions = [
  { value: 'dayGridMonth', label: t('calendar').month },
  { value: 'timeGridWeek', label: t('calendar').week },
  { value: 'timeGridDay', label: t('calendar').day },
  { value: 'listWeek', label: t('calendar').list }
];
```

- [ ] **Step 2: Wire up in SettingsDialog.vue**

In `src/components/settings/SettingsDialog.vue`, update the `CalendarConfigSection` usage (around line 60-63) to pass the new props:

```html
          <CalendarConfigSection
            v-show="sectionVisible('calendar')"
            v-model:calendar-default-view="local.calendarDefaultView"
            v-model:show-pomodoro-blocks="local.showPomodoroBlocks"
            v-model:show-pomodoro-total="local.showPomodoroTotal"
          />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/CalendarConfigSection.vue src/components/settings/SettingsDialog.vue
git commit -m "feat: add pomodoro blocks settings UI in CalendarConfigSection"
```

---

### Task 3: Add pomodoro-to-background-event converter

**Files:**
- Modify: `src/utils/dataConverter.ts`

- [ ] **Step 1: Add pomodoroBlocksToEvents static method**

In `src/utils/dataConverter.ts`, add a new public static method after `itemToCalendarEvent` (after line 100). This converts an array of `PomodoroRecord` into FullCalendar background events:

```ts
  /**
   * 将番茄钟记录转换为日历背景事件
   * 只为有 startTime 且有 endTime 的记录生成时间块
   * @param pomodoros 番茄钟记录数组
   * @param visibleDate 可选的可见日期，用于过滤只显示当天的记录
   */
  public static pomodoroBlocksToEvents(
    pomodoros: PomodoroRecord[] | undefined,
    visibleDate?: string
  ): CalendarEvent[] {
    if (!pomodoros || pomodoros.length === 0) return [];

    const events: CalendarEvent[] = [];

    for (const record of pomodoros) {
      // 必须有 startTime 和 endTime 才能定位到时间轴
      if (!record.startTime || !record.endTime) continue;

      // 如果指定了可见日期，只显示该日期的记录
      if (visibleDate && record.date !== visibleDate) continue;

      const durationMinutes = record.actualDurationMinutes ?? record.durationMinutes;
      const startDateTime = `${record.date}T${record.startTime}`;
      const endDateTime = `${record.date}T${record.endTime}`;

      events.push({
        id: `pomodoro-block-${record.id}`,
        title: '',
        start: startDateTime,
        end: endDateTime,
        allDay: false,
        display: 'background',
        backgroundColor: 'rgba(231, 76, 60, 0.15)',
        extendedProps: {
          isPomodoroBlock: true,
          pomodoroDurationMinutes: durationMinutes,
          pomodoroDescription: record.description,
        }
      });
    }

    return events;
  }
```

Also add `PomodoroRecord` to the import on line 5:

```ts
import type { Project, Task, Item, CalendarEvent, GanttTask, PomodoroRecord } from '@/types/models';
```

Note: The `CalendarEvent` type's `extendedProps` is defined with specific fields. Since `isPomodoroBlock`, `pomodoroDurationMinutes`, and `pomodoroDescription` are not in the interface, we'll need to handle this. FullCalendar accepts any object as `extendedProps`. The TypeScript type for `CalendarEvent.extendedProps` is defined in `src/types/models.ts`. Let's check if it uses an index signature.

Actually, since FullCalendar's `EventInput` type accepts `extendedProps` as `Record<string, any>`, and our `CalendarEvent` interface has specific fields, we should either:
1. Use type assertion, or
2. Add these optional fields to the `CalendarEvent.extendedProps` interface.

The cleaner approach is to add them to the interface. This is the next step.

- [ ] **Step 2: Update CalendarEvent type to support pomodoro blocks**

In `src/types/models.ts`, add 3 optional fields to the `extendedProps` of `CalendarEvent` interface (after the `pomodoros?: PomodoroRecord[];` line, around line 215):

```ts
    // 番茄钟时间块专用属性
    isPomodoroBlock?: boolean;
    pomodoroDurationMinutes?: number;
    pomodoroDescription?: string;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/utils/dataConverter.ts src/types/models.ts
git commit -m "feat: add pomodoro-to-background-event converter"
```

---

### Task 4: Integrate pomodoro blocks into CalendarView

**Files:**
- Modify: `src/tabs/CalendarTab.vue`
- Modify: `src/components/calendar/CalendarView.vue`

This is the core integration task. Changes:

1. CalendarTab passes pomodoro block events + settings to CalendarView
2. CalendarView merges pomodoro blocks into FullCalendar
3. CalendarView renders duration text on pomodoro blocks via `eventDidMount`
4. CalendarView shows total focus time on event bars in `renderEventContent`

- [ ] **Step 1: Compute pomodoro block events in CalendarTab**

In `src/tabs/CalendarTab.vue`, add a computed that generates pomodoro background events. First, add imports at the top of the `<script setup>`:

```ts
import { DataConverter } from '@/utils/dataConverter';
```

Add this computed after `filteredCalendarEvents` (around line 87):

```ts
// 番茄钟背景时间块事件
const pomodoroBlockEvents = computed(() => {
  if (!settingsStore.showPomodoroBlocks) return [];
  const events = filteredCalendarEvents.value;
  const allPomodoros: PomodoroRecord[] = [];
  const seenIds = new Set<string>();
  for (const event of events) {
    const pomodoros = event.extendedProps?.pomodoros;
    if (pomodoros) {
      for (const p of pomodoros) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allPomodoros.push(p);
        }
      }
    }
  }
  return DataConverter.pomodoroBlocksToEvents(allPomodoros);
});
```

Add `PomodoroRecord` to the type import:

```ts
import type { Item } from '@/types/models';
```

Change to:

```ts
import type { Item, PomodoroRecord } from '@/types/models';
```

- [ ] **Step 2: Merge events and pass to CalendarView**

In `src/tabs/CalendarTab.vue`, add a new computed that merges regular events with pomodoro blocks:

```ts
// 合并日历事件 + 番茄钟背景时间块
const allCalendarEvents = computed(() => {
  return [...filteredCalendarEvents.value, ...pomodoroBlockEvents.value];
});
```

Update the CalendarView binding (line 44) from `:events="filteredCalendarEvents"` to `:events="allCalendarEvents"`:

```html
      <CalendarView
        v-if="isSettingsLoaded"
        ref="calendarRef"
        :events="allCalendarEvents"
        :initial-view="currentView"
        :show-pomodoro-total="settingsStore.showPomodoroTotal"
        @event-click="handleEventClick"
        @event-drop="handleEventDrop"
        @event-resize="handleEventResize"
        @navigated="updateTitle"
        @day-view-from-click="handleDayViewFromClick"
        @week-view-from-click="handleWeekViewFromClick"
      />
```

- [ ] **Step 3: Update CalendarView to accept showPomodoroTotal prop**

In `src/components/calendar/CalendarView.vue`, update the Props interface (around line 132-135):

```ts
interface Props {
  events: CalendarEvent[];
  initialView?: string;
  showPomodoroTotal?: boolean;
}
```

- [ ] **Step 4: Add pomodoro block duration text in eventDidMount**

In `src/components/calendar/CalendarView.vue`, update the `eventDidMount` callback (around line 411-419). Add pomodoro block label rendering before the existing contextmenu/mouseenter listeners:

```ts
      eventDidMount: (info) => {
        // 番茄钟背景时间块：注入时长文字
        if (info.event.extendedProps?.isPomodoroBlock) {
          const duration = info.event.extendedProps.pomodoroDurationMinutes;
          if (duration && info.el) {
            const label = document.createElement('span');
            label.className = 'pomodoro-block-label';
            label.textContent = `${duration}min`;
            info.el.style.position = 'relative';
            info.el.appendChild(label);
          }
          return; // 背景事件不绑定右键菜单和悬浮预览
        }

        info.el.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          handleCalendarEventContextMenu(info, e);
        }, true);
        info.el.addEventListener('mouseenter', () => showEventTooltip(info));
        info.el.addEventListener('mouseleave', () => hideEventTooltip());
      },
```

- [ ] **Step 5: Add total focus time to event bar in renderEventContent**

In `src/components/calendar/CalendarView.vue`, update `renderEventContent` (around line 46-130). After the `line2` element is created and `titleEl` is appended (after `line2.appendChild(titleEl);`), add the pomodoro total display:

```ts
  // 专注总时长（仅事项级事件 + 有番茄钟记录 + 设置开启）
  if (isItem && props.showPomodoroTotal) {
    const pomodoros = arg.event.extendedProps?.pomodoros;
    if (pomodoros && pomodoros.length > 0) {
      const totalMinutes = pomodoros.reduce(
        (sum: number, p: any) => sum + (p.actualDurationMinutes ?? p.durationMinutes), 0
      );
      if (totalMinutes > 0) {
        const totalEl = document.createElement('span');
        totalEl.className = 'fc-event-pomodoro-total';
        const label = (t('settings').calendar as any).pomodoroTotalLabel ?? '{minutes}min';
        totalEl.textContent = ' ' + label.replace('{minutes}', String(totalMinutes));
        line2.appendChild(totalEl);
      }
    }
  }
```

Add `props` variable reference. Currently `renderEventContent` is a standalone arrow function, not inside setup context. Move it to be defined after the `props` definition or make it a function that takes `showPomodoroTotal` as a parameter. The simplest approach: since `renderEventContent` is defined in module scope before `defineProps`, we need to access the settings store directly.

Actually, looking at the code, `renderEventContent` is defined at line 46 as a standalone function, before `const props = defineProps<Props>()` at line 137. It references `pomodoroStore` directly. We can reference `settingsStore` the same way.

Change: the `showPomodoroTotal` check should use `settingsStore` directly (since `renderEventContent` is outside the props context). Replace `props.showPomodoroTotal` with `settingsStore.showPomodoroTotal`:

```ts
  // 专注总时长（仅事项级事件 + 有番茄钟记录 + 设置开启）
  if (isItem && settingsStore.showPomodoroTotal) {
```

And we can remove `showPomodoroTotal` from the CalendarView Props interface (keep it simple, use settingsStore directly like the existing code does for `pomodoroStore`).

Revert the Props interface back to:

```ts
interface Props {
  events: CalendarEvent[];
  initialView?: string;
}
```

And remove `show-pomodoro-total` from CalendarTab's CalendarView binding.

- [ ] **Step 6: Add SCSS styles for pomodoro blocks**

In `src/components/calendar/CalendarView.vue`, in the global `<style lang="scss">` block (non-scoped, around line 622), add these styles inside the `.fc` selector (after the existing styles, before the closing `}`):

```scss
  /* 番茄钟背景时间块 */
  .fc-bg-event {
    &.fc-event {
      cursor: default;
      opacity: 1;
    }

    .pomodoro-block-label {
      position: absolute;
      top: 2px;
      left: 4px;
      font-size: 10px;
      color: rgba(231, 76, 60, 0.7);
      white-space: nowrap;
      pointer-events: none;
      font-weight: 500;
    }
  }

  /* 事项条专注总时长 */
  .fc-event-pomodoro-total {
    font-size: 10px;
    opacity: 0.75;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: auto;
    color: var(--b3-theme-on-primary);
  }
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Success

- [ ] **Step 8: Commit**

```bash
git add src/tabs/CalendarTab.vue src/components/calendar/CalendarView.vue
git commit -m "feat: display pomodoro blocks and total time on calendar day view"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Success

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All pass

- [ ] **Step 3: Verify spec coverage**

Check that each spec requirement has corresponding implementation:
- [x] Background time blocks from PomodoroRecords with startTime/endTime
- [x] Duration text (e.g. "25min") on each block
- [x] Total focus time on event bar right side
- [x] `showPomodoroBlocks` setting (default true)
- [x] `showPomodoroTotal` setting (default true)
- [x] Only show records with both startTime and endTime
- [x] Semi-transparent tomato red color
- [x] Background events are non-interactive
