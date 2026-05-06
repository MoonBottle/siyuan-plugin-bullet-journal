# SiYuan Native and Mobile Scheduled Notification Design

## Summary

This spec upgrades the plugin notification system to use SiYuan native notifications as the primary delivery backend, while keeping browser `Notification` and in-app `showMessage` as fallbacks.

The design intentionally splits behavior by platform:

- desktop keeps the current realtime scheduling model
- mobile adds scheduled native notifications, similar to `siyuan-plugin-task-horizon`

The goal is to make reminders and pomodoro notifications reliable on mobile even when the plugin is backgrounded, without regressing the existing desktop reminder flow.

## Goals

- Route all plugin notifications through a unified notification utility
- Prefer SiYuan native `sendNotification` on every platform
- Keep fallback order as `sendNotification -> Web Notification -> showMessage`
- Preserve desktop realtime reminders for items, habits, focus end, and break end
- Add mobile scheduled native notifications for item reminders, habit reminders, pomodoro focus end, and pomodoro break end
- Support notification cancellation and rebuild when reminder-related state changes

## Non-Goals

- No cross-device notification state sync
- No click-to-open callback guarantee for native notifications
- No redesign of reminder editing UI
- No attempt to replace existing desktop cron scheduling with delayed native scheduling
- No new push channel beyond the existing optional WeChat side effect

## Context

Current plugin behavior:

- `src/services/reminderService.ts` schedules item and habit reminders with `croner`
- `src/utils/notification.ts` currently prefers browser `Notification`
- `src/stores/pomodoroStore.ts` emits completion notifications through the same utility
- mobile currently lacks a true scheduled-notification path

Relevant external references:

- SiYuan exposes `sendNotification` and `cancelNotification` through `platformUtils`
- SiYuan issue `#17114` adds plugin-usable notification support on Android
- `siyuan-plugin-task-horizon` uses scheduled native notifications on mobile with local registry tracking, while keeping desktop in realtime mode

## Proposed Architecture

### Unified notification utility

`src/utils/notification.ts` becomes the single notification entry point for:

- immediate notifications
- scheduled native notifications
- scheduled native notification cancellation
- optional WeChat side effect

It should expose two clear capability groups:

1. Immediate notification APIs
   - used by desktop reminders
   - used by desktop pomodoro focus-end and break-end notifications
   - fallback order: native -> browser -> message

2. Scheduled native notification APIs
   - used only on mobile
   - use `sendNotification({ delayInSeconds })`
   - support cancellation through returned notification ids

### Platform split

Desktop:

- keep `ReminderService` realtime cron scheduling for item and habit reminders
- keep current pomodoro runtime-driven notification behavior
- do not maintain mobile scheduled-notification registry

Mobile:

- do not depend on foreground cron firing for reliable delivery
- build and maintain scheduled native notifications ahead of time
- store notification ids locally for later cancellation and reconciliation

## Notification Delivery Strategy

### Immediate delivery

The immediate delivery path should be:

1. try SiYuan native `sendNotification`
2. if native delivery is unavailable or fails, try browser `Notification`
3. if browser notification is unavailable or fails, call `showMessage`

This path stays shared by:

- desktop item reminders
- desktop habit reminders
- desktop pomodoro focus end
- desktop pomodoro break end
- any mobile foreground fallback that still chooses to surface an immediate message

### Scheduled delivery

The scheduled delivery path is mobile-only:

- compute `delayInSeconds` from target timestamp
- call native `sendNotification`
- persist the returned `notificationId` in a registry
- later cancel by `cancelNotification(notificationId)` when the schedule becomes invalid

Browser `Notification` is not part of scheduled delivery because it does not provide equivalent background reservation semantics.

## Mobile Scheduled Notification Scope

The mobile scheduler covers four kinds of future notifications:

- `reminder`: normal item reminder
- `habit`: habit reminder
- `pomodoro-focus-end`: focus session completion
- `pomodoro-break-end`: break completion

The scheduler does not attempt to reserve arbitrary far-future notifications. It should stay conservative and align with the current reminder scan model:

- item reminders: near-future window, aligned with the current 24-hour scheduling horizon unless implementation discovers a strong reason to widen it
- habit reminders: same practical near-future window
- pomodoro focus/break: always schedule the active session end if it exists

## Registry Design

Create a lightweight local registry for mobile scheduled notifications, stored in plugin-owned local storage.

Suggested storage key:

- `task-assistant-mobile-notification-registry`

Each record stores:

- `entryKey`: stable business key
- `notificationId`: id returned by native `sendNotification`
- `scheduledAt`: target trigger timestamp
- `delayInSeconds`: delay used when scheduling
- `planKey`: stable signature for change detection
- `kind`: `reminder | habit | pomodoro-focus-end | pomodoro-break-end`
- `status`: `scheduled | canceled | stale`
- `updatedAt`

### Stable keys

Recommended key shapes:

- item reminder: `blockId + date + reminderTime`
- habit reminder: reuse the current habit reminder key generated by reminder expansion
- pomodoro focus end: `itemBlockId + expectedFocusEndAt`
- pomodoro break end: `breakSessionId + expectedBreakEndAt`

If the current break model lacks a stable `breakSessionId`, use a derived key such as:

- `activePomodoroId + breakStartAt + breakEndAt`

### Plan key semantics

`planKey` should represent the full configuration that matters for the scheduled notification. If the same `entryKey` exists with the same `planKey`, the scheduler should skip rescheduling. If the `planKey` changes, the old notification should be canceled and replaced.

## Desktop Flow

Desktop stays close to the current architecture.

### Item and habit reminders

- `ReminderService` still starts on desktop
- it still rebuilds cron jobs after refresh and visibility changes
- when a reminder fires, it calls the unified immediate-notification API

### Pomodoro notifications

- `pomodoroStore` continues to drive focus-end and break-end notifications from runtime state
- completion paths still use the unified immediate-notification API

### Desktop behavior preserved

- `notifiedKeys` de-duplication remains in `ReminderService`
- browser-notification click handlers can still open `siyuan://blocks/...`
- realtime rebuilding on foreground return remains intact

## Mobile Flow

Mobile uses a scheduler/reconciler instead of relying on foreground cron execution.

### Initialization

On plugin load:

- desktop starts `ReminderService`
- mobile starts a new `MobileNotificationScheduler`

### Item and habit synchronization

On mobile, the scheduler should:

- scan future item reminders and habit reminders
- build `entryKey` and `planKey` for each target
- compare them against the registry
- skip unchanged entries
- cancel and recreate changed entries
- cancel and remove entries whose source reminder disappeared, completed, or became abandoned

### Pomodoro synchronization

On mobile, pomodoro session changes should update scheduled notifications immediately:

- start focus: schedule `pomodoro-focus-end`
- pause focus: cancel `pomodoro-focus-end`
- resume focus: recreate `pomodoro-focus-end` with the new expected end time
- complete focus and enter break: cancel focus-end, schedule `pomodoro-break-end`
- skip break / finish break / cancel timer: cancel `pomodoro-break-end`
- restore persisted active focus or break: rebuild the corresponding scheduled notification

## Trigger Points

### Plugin lifecycle

`src/index.ts`

- onload:
  - desktop: start `ReminderService`
  - mobile: initialize `MobileNotificationScheduler`
- unload:
  - stop the active notification services and timers cleanly

### Data refresh

Existing refresh points should branch by platform:

- desktop: `reminderService.scheduleRebuild()`
- mobile: `mobileNotificationScheduler.scheduleSync()`

This should be wired where project data refresh and dirty-document reconciliation already happen today.

### Pomodoro state transitions

`src/stores/pomodoroStore.ts` should notify the mobile scheduler when:

- focus starts
- focus pauses
- focus resumes
- focus completes
- break starts
- break ends
- break is skipped
- a persisted session is restored

## Error Handling and Limits

### Native immediate notification failures

If native immediate notification fails:

- fall back to browser `Notification`
- then fall back to `showMessage`

### Native scheduled notification failures

If mobile scheduled native notification fails:

- do not try to emulate scheduled delivery with browser `Notification`
- record the failure and leave the registry entry absent or marked stale
- keep foreground runtime behavior as a best-effort fallback while the app remains active

### Native click behavior

SiYuan native notifications do not expose the same click callback model as browser `Notification`.

Therefore:

- browser fallback on desktop may still support click-to-open block behavior
- mobile scheduled native notifications only guarantee delivery, not click-to-open

This is an intentional capability boundary, not a bug.

### Registry cleanup

At startup and during sync:

- remove malformed records
- remove expired records
- remove orphaned records that no longer map to existing reminders or active pomodoro sessions
- cancel native notifications before deleting valid orphaned scheduled entries when ids are available

## File-Level Direction

### Expected modified files

- `src/utils/notification.ts`
- `src/services/reminderService.ts`
- `src/stores/pomodoroStore.ts`
- `src/index.ts`

### Expected new files

- `src/services/mobileNotificationScheduler.ts`
- `src/services/mobileNotificationRegistry.ts`

These names are directional. Final filenames may shift slightly if a stronger local naming pattern exists.

## Testing Strategy

### Notification utility tests

Add or extend tests to verify:

- native immediate notification success bypasses browser `Notification`
- native immediate failure falls back to browser `Notification`
- browser unavailability or failure falls back to `showMessage`
- scheduled native notification returns and stores usable ids

### Reminder service tests

Extend `test/services/reminderService.test.ts` to verify:

- desktop keeps realtime scheduling behavior
- mobile path does not rely on realtime cron delivery for future reminders

### Mobile scheduler tests

Add `test/services/mobileNotificationScheduler.test.ts` for:

- creating new scheduled entries
- skipping unchanged `planKey`
- canceling and rebuilding changed reminders
- clearing completed or abandoned item reminders
- synchronizing habit reminders
- startup cleanup of orphaned entries

### Pomodoro tests

Extend `test/stores/pomodoroStore.test.ts` to verify:

- start focus schedules `pomodoro-focus-end` on mobile
- pause cancels focus-end
- resume recreates focus-end
- break start creates `pomodoro-break-end`
- break skip or break completion cancels break-end
- restored persisted state rebuilds the correct scheduled entry

## Risks and Tradeoffs

- Two notification execution models will coexist: desktop realtime and mobile scheduled
- Native scheduled notifications do not preserve browser click behavior
- Registry bugs could cause duplicate or stale scheduled notifications if reconciliation is incomplete
- Pomodoro restoration must be handled carefully to avoid double scheduling after app restart

These tradeoffs are acceptable because they match actual platform capabilities and the proven `task-horizon` approach.

## Recommendation

Implement the platform split directly:

- desktop remains realtime
- mobile adopts scheduled native notifications with registry-backed reconciliation

This keeps the current desktop reminder model stable while solving the real reliability gap on mobile for reminders, focus-end, and break-end notifications.
