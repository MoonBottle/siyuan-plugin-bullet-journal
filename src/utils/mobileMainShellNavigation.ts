export type MobileMainShellTab = 'todo' | 'pomodoro' | 'habit' | 'more';

export interface MobileMainShellNavigationTarget {
  tab: MobileMainShellTab;
}

let pendingMobileMainShellTabTarget: MobileMainShellNavigationTarget | null = null;

export function setPendingMobileMainShellTabTarget(target: MobileMainShellNavigationTarget | null): void {
  pendingMobileMainShellTabTarget = target ? { ...target } : null;
}

export function consumePendingMobileMainShellTabTarget(): MobileMainShellNavigationTarget | null {
  const target = pendingMobileMainShellTabTarget;
  pendingMobileMainShellTabTarget = null;
  return target;
}
