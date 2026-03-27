/**
 * 脏文档追踪器
 * 用于 ws-main 事件触发的文档定向刷新
 */

class DirtyDocTracker {
  private dirtyDocIds: Set<string> = new Set();

  /**
   * 标记文档为脏（需要重新加载）
   * ws-main 事件触发时调用
   */
  markDirty(docIds: string[]): void {
    docIds.forEach(id => this.dirtyDocIds.add(id));
    console.log('[DirtyDocTracker] Marked dirty:', docIds);
  }

  /**
   * 获取所有脏文档 ID
   * projectStore.refresh 开始时调用
   */
  getDirtyDocs(): string[] {
    return Array.from(this.dirtyDocIds);
  }

  /**
   * 清除指定文档的脏标记
   * projectStore.refresh 完成后调用
   */
  clearDirty(docIds: string[]): void {
    docIds.forEach(id => this.dirtyDocIds.delete(id));
  }

  /**
   * 是否有脏文档
   */
  hasDirtyDocs(): boolean {
    return this.dirtyDocIds.size > 0;
  }

  /**
   * 清空所有脏标记
   */
  clearAll(): void {
    this.dirtyDocIds.clear();
  }
}

// 导出单例，全局共享
export const dirtyDocTracker = new DirtyDocTracker();
