# Pomodoro

The Pomodoro feature helps you time focus sessions in Task Assistant and automatically writes focus records into your notes, linked to items.

## Access

**Pomodoro Focus Dock**: Right-click top bar → Closed Panels → Pomodoro Focus

The sidebar will show the "Pomodoro Focus" panel.

## Interface

### When Not Focusing

- **Stats grid**: Today's pomodoros, today's focus duration, total pomodoros, total focus duration (based on pomodoro records in all project documents under the scan directories).
- **Focus record list**: History focus records grouped by date; each shows time range, linked item, and duration. Click a record to jump to the corresponding block in notes.
- **Top actions**: Play button "Start Focus", refresh button to reload data.

### When Focusing

- **Countdown ring**: Remaining time (MM:SS) and minutes focused so far.
- **Timeline**: Start time, expected end time, and progress bar.
- **Item info card**: Current project, task, item, and related links; click the card to open the document and go to that item.
- **Action buttons**: Pause / Resume, End Focus (saves the current pomodoro record).

## Start Focus

You can open the "Start Focus" modal from:

| Entry | Action |
|-------|--------|
| Pomodoro Focus Dock | Click the play icon at the top |
| Todo sidebar | Click "Start Focus" on an item |
| Calendar view | Click "Start Focus" on an item |
| Gantt chart | Click "Start Focus" on an item |
| Item block in notes | Right-click → Start Focus |

In the modal:

1. **Select todo item**: Left side lists "Overdue items" and "Today items" (both pending). Choose the item to focus on. If you opened from calendar/gantt/todo or by right-clicking an item, that item may be pre-selected and the list may be hidden.
2. **Set focus duration**: Quick 15 / 25 / 45 / 60 minutes, or custom 1–180 minutes.
3. Click "Start Focus" to begin. If you started from outside the Dock, the view will switch to the Pomodoro Focus Dock after starting.

## During Focus

- **Pause**: Timer pauses; you can "Resume" when you open the Dock again. Paused time is not counted.
- **Resume**: Continue from the current remaining time.
- **End Focus**: After confirming, this focus session is **appended as a pomodoro record under the current item block**, and a sound plays and a system notification may show (if allowed).

Focus state is persisted: after closing the Dock or restarting SiYuan, opening the Pomodoro Focus Dock again will restore the in-progress pomodoro (unfinished ones continue countdown, paused ones stay paused).

## Focus Record Format

After a focus session, the plugin inserts a line of Markdown under the corresponding item block, parsed as a pomodoro record. You can also write records manually in notes using the same format.

### Format 1 (No Pause)

```text
🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss
```

- Date and start/end time; `~` connects start and end.
- Example: `🍅2026-03-10 09:00:00~09:25:00`

### Format 2 (With Actual Duration)

When you paused during focus, the actual focus minutes are written:

```text
🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss
```

- `N` is the actual focus minutes (integer); comma can be Chinese or English.
- Example: `🍅20,2026-03-10 09:00:00~09:30:00` means 20 minutes of actual focus in a 30-minute window.

### Parsing and Association

- A pomodoro block **directly under an item block** is linked to that item; under a **task block** (and not under an item) it is linked to that task; otherwise to the project. The plugin uses this for stats and the "Focus record" list.

More format details in [Data Format - Pomodoro Records](./data-format.md#pomodoro-records).

## Notifications and Permissions

- When focus ends, if the browser/SiYuan allows notifications, a system reminder may appear; clicking it can focus the SiYuan window.
- The first time you use Pomodoro, the plugin may request notification permission; after allowing, you will get completion reminders.

## FAQ

### Why is "Today's Pomodoros" 0?

Stats come from parsed pomodoro records in project documents under the configured directories. Check: ① Directories are configured and saved; ② Project documents have lines starting with `🍅` in the correct format; ③ Click the refresh button in the Dock to reload data.

### Where are focus records written?

They are appended as the **next line (child block)** under the **current focus item's block**. Open that document in notes and look under the item to see the new `🍅...` line.

### Can I write pomodoro records manually?

Yes. Add a line starting with `🍅` under an item block using the formats above. After the plugin scans, they will be included in stats and the focus record list; clicking a record jumps to that block.
