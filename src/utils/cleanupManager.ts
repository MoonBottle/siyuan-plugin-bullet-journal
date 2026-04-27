export class CleanupManager {
  private callbacks = new Set<() => void>();

  add(callback: () => void): void {
    this.callbacks.add(callback);
  }

  runAll(): void {
    const callbacks = Array.from(this.callbacks);
    this.callbacks.clear();

    for (const callback of callbacks) {
      callback();
    }
  }
}
