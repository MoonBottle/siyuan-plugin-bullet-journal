export interface HabitDockNavigationTarget {
  habitId: string;
  date?: string;
  recordBlockId?: string;
}

let pendingHabitDockTarget: HabitDockNavigationTarget | null = null;

export function setPendingHabitDockTarget(target: HabitDockNavigationTarget | null): void {
  pendingHabitDockTarget = target ? { ...target } : null;
}

export function consumePendingHabitDockTarget(): HabitDockNavigationTarget | null {
  const target = pendingHabitDockTarget;
  pendingHabitDockTarget = null;
  return target;
}
