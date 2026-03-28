/**
 * 任务列表勾选触发重复事项测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 依赖
vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(),
}));

vi.mock('@/stores', () => ({
  useProjectStore: vi.fn(),
}));

vi.mock('@/services/recurringService', () => ({
  shouldCreateNextOccurrence: vi.fn(() => true),
  createNextOccurrence: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
  Events: {
    DATA_REFRESH: 'data:refresh',
  },
  broadcastDataRefresh: vi.fn(),
}));

describe('任务列表完成检测', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该检测到包含 protyle-task--done 的 update 操作', () => {
    const op = {
      action: 'update',
      id: 'test-block-id',
      data: '<div class="li protyle-task--done" data-node-id="test-block-id">...</div>',
    };

    const hasDoneClass = op.data.includes('protyle-task--done');
    expect(hasDoneClass).toBe(true);
  });

  it('不应该检测未完成的任务列表', () => {
    const op = {
      action: 'update',
      id: 'test-block-id',
      data: '<div class="li" data-node-id="test-block-id">...</div>',
    };

    const hasDoneClass = op.data.includes('protyle-task--done');
    expect(hasDoneClass).toBe(false);
  });

  it('应该正确处理 transactions 数据结构', () => {
    const wsData = {
      cmd: 'transactions',
      data: [
        {
          timestamp: 1774658981745,
          doOperations: [
            {
              action: 'update',
              id: '20260328083906-sp5h33r',
              data: '<div class="li protyle-task--done" data-node-id="20260328083906-sp5h33r"><div class="protyle-action protyle-action--task"><svg><use xlink:href="#iconCheck"></use></svg></div><div>图片压缩和懒加载 @2026-04-01 ⏰07:20 🔁每天</div></div>',
            },
          ],
          undoOperations: [
            {
              action: 'update',
              data: '<div class="li" data-node-id="20260328083906-sp5h33r"><div class="protyle-action protyle-action--task"><svg><use xlink:href="#iconUncheck"></use></svg></div><div>图片压缩和懒加载 @2026-04-01 ⏰07:20 🔁每天</div></div>',
            },
          ],
        },
      ],
      context: {
        rootIDs: ['20260327225245-f6zxrh4'],
      },
    };

    // 验证数据结构
    expect(wsData.cmd).toBe('transactions');
    expect(Array.isArray(wsData.data)).toBe(true);
    expect(wsData.data[0].doOperations).toBeDefined();
    expect(wsData.data[0].doOperations[0].action).toBe('update');
    expect(wsData.data[0].doOperations[0].data.includes('protyle-task--done')).toBe(true);
  });

  it('应该忽略非 update 操作', () => {
    const op = {
      action: 'insert',
      id: 'test-block-id',
      data: '<div class="li protyle-task--done">...</div>',
    };

    expect(op.action).not.toBe('update');
  });

  it('应该忽略 data 不是字符串的操作', () => {
    const op = {
      action: 'update',
      id: 'test-block-id',
      data: { some: 'object' },
    };

    expect(typeof op.data).not.toBe('string');
  });
});

describe('任务列表完成 - 与 undoOperations 比较', () => {
  it('应该触发：undoOperations 没有完成标记，doOperations 有完成标记', () => {
    const transaction = {
      timestamp: 1774702613518,
      doOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个已完成的事项 📅2026-03-28 🔁每月 ✅</div>',
        },
      ],
      undoOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个事项 📅2026-03-28 🔁每月</div>',
        },
      ],
    };

    const op = transaction.doOperations[0];
    const undoOp = transaction.undoOperations.find((u: any) => u.id === op.id && u.action === 'update');
    
    const hasDoneMarker = op.data.includes('✅') || op.data.includes('#done') || op.data.includes('#已完成');
    const hadDoneMarker = undoOp?.data?.includes('✅') || undoOp?.data?.includes('#done') || undoOp?.data?.includes('#已完成');
    const isNewCompletion = hasDoneMarker && !hadDoneMarker;
    
    expect(isNewCompletion).toBe(true);
  });

  it('不应该触发：undoOperations 已有完成标记，doOperations 也有完成标记（普通编辑）', () => {
    const transaction = {
      timestamp: 1774702613518,
      doOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个已完成的事项 📅2026-03-28 🔁每月<wbr></div>',
        },
      ],
      undoOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个已完成的事项 📅2026-03-28 🔁每月 </div>',
        },
      ],
    };

    const op = transaction.doOperations[0];
    const undoOp = transaction.undoOperations.find((u: any) => u.id === op.id && u.action === 'update');
    
    const hasDoneMarker = op.data.includes('✅') || op.data.includes('#done') || op.data.includes('#已完成');
    const hadDoneMarker = undoOp?.data?.includes('✅') || undoOp?.data?.includes('#done') || undoOp?.data?.includes('#已完成');
    const isNewCompletion = hasDoneMarker && !hadDoneMarker;
    
    expect(isNewCompletion).toBe(false);
  });

  it('不应该触发：undoOperations 和 doOperations 都没有完成标记', () => {
    const transaction = {
      timestamp: 1774702613518,
      doOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个事项 📅2026-03-28 🔁每月 已修改</div>',
        },
      ],
      undoOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div>这是一个事项 📅2026-03-28 🔁每月</div>',
        },
      ],
    };

    const op = transaction.doOperations[0];
    const undoOp = transaction.undoOperations.find((u: any) => u.id === op.id && u.action === 'update');
    
    const hasDoneMarker = op.data.includes('✅') || op.data.includes('#done') || op.data.includes('#已完成');
    const hadDoneMarker = undoOp?.data?.includes('✅') || undoOp?.data?.includes('#done') || undoOp?.data?.includes('#已完成');
    const isNewCompletion = hasDoneMarker && !hadDoneMarker;
    
    expect(isNewCompletion).toBe(false);
  });

  it('应该触发任务列表勾选完成：undoOperations 无 protyle-task--done', () => {
    const transaction = {
      timestamp: 1774658981745,
      doOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div class="li protyle-task--done">任务内容</div>',
        },
      ],
      undoOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div class="li">任务内容</div>',
        },
      ],
    };

    const op = transaction.doOperations[0];
    const undoOp = transaction.undoOperations.find((u: any) => u.id === op.id && u.action === 'update');
    
    const hasDoneClass = op.data.includes('protyle-task--done');
    const hadDoneClass = undoOp?.data?.includes('protyle-task--done');
    const isNewCompletion = hasDoneClass && !hadDoneClass;
    
    expect(isNewCompletion).toBe(true);
  });

  it('不应该触发：已勾选的任务列表再次编辑', () => {
    const transaction = {
      timestamp: 1774658981745,
      doOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div class="li protyle-task--done">任务内容已修改</div>',
        },
      ],
      undoOperations: [
        {
          action: 'update',
          id: 'block-1',
          data: '<div class="li protyle-task--done">任务内容</div>',
        },
      ],
    };

    const op = transaction.doOperations[0];
    const undoOp = transaction.undoOperations.find((u: any) => u.id === op.id && u.action === 'update');
    
    const hasDoneClass = op.data.includes('protyle-task--done');
    const hadDoneClass = undoOp?.data?.includes('protyle-task--done');
    const isNewCompletion = hasDoneClass && !hadDoneClass;
    
    expect(isNewCompletion).toBe(false);
  });
});

describe('任务列表完成 - blockId 提取', () => {
  it('应该从 HTML 中提取第二个 data-node-id 作为内容块 ID', () => {
    // 实际 WebSocket 数据结构
    const op = {
      action: 'update',
      id: '20260328083906-sp5h33r',  // 列表项块 ID
      data: '<div data-marker="*" data-subtype="t" data-node-id="20260328083906-sp5h33r" data-type="NodeListItem" class="li protyle-task--done" updated="20260328084941"><div class="protyle-action protyle-action--task" draggable="true"><svg><use xlink:href="#iconCheck"></use></svg></div><div data-node-id="20260328083901-8c76lw2" data-type="NodeParagraph" class="p" updated="20260328083901"><div contenteditable="true" spellcheck="false">图片压缩和懒加载 @2026-04-01 ⏰07:20 🔁每天</div><div class="protyle-attr" contenteditable="false">​</div></div><div class="protyle-attr" contenteditable="false">​</div></div>',
    };

    // 提取 data-node-id
    const dataNodeIdMatch = op.data.match(/data-node-id="([^"]+)"/g);
    expect(dataNodeIdMatch).toBeDefined();
    expect(dataNodeIdMatch!.length).toBeGreaterThanOrEqual(2);
    
    // 第二个 data-node-id 是内容块的 ID
    const secondMatch = dataNodeIdMatch![1];
    const idMatch = secondMatch.match(/data-node-id="([^"]+)"/);
    expect(idMatch).toBeDefined();
    expect(idMatch![1]).toBe('20260328083901-8c76lw2');
  });

  it('如果只有一个 data-node-id，应该使用 op.id', () => {
    const op = {
      action: 'update',
      id: '20260328083906-sp5h33r',
      data: '<div data-node-id="20260328083906-sp5h33r" class="li protyle-task--done">...</div>',
    };

    const dataNodeIdMatch = op.data.match(/data-node-id="([^"]+)"/g);
    let contentBlockId = op.id;
    
    if (dataNodeIdMatch && dataNodeIdMatch.length >= 2) {
      const secondMatch = dataNodeIdMatch[1];
      const idMatch = secondMatch.match(/data-node-id="([^"]+)"/);
      if (idMatch) {
        contentBlockId = idMatch[1];
      }
    }

    expect(contentBlockId).toBe('20260328083906-sp5h33r');
  });
});
