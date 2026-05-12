import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  currentLocale,
  mockFormat,
  mockAddFormat,
  mockSubtractFormat,
  createDocWithMd,
  pushMsg,
  openDocument,
  getOrCreateTaskAssistantNotebook,
  expandDocTree,
} = vi.hoisted(() => ({
  currentLocale: {
    value: 'zh_CN',
  },
  mockFormat: vi.fn(() => '2026-05-12'),
  mockAddFormat: vi.fn(() => '2026-05-13'),
  mockSubtractFormat: vi.fn(() => '2026-05-11'),
  createDocWithMd: vi.fn(async () => 'doc-id'),
  pushMsg: vi.fn(async () => {}),
  openDocument: vi.fn(async () => {}),
  getOrCreateTaskAssistantNotebook: vi.fn(async () => ({
    id: 'notebook-id',
    name: 'Task Assistant',
  })),
  expandDocTree: vi.fn(),
}));

vi.mock('@/utils/dayjs', () => ({
  default: vi.fn(() => ({
    format: mockFormat,
    add: vi.fn(() => ({
      format: mockAddFormat,
    })),
    subtract: vi.fn(() => ({
      format: mockSubtractFormat,
    })),
  })),
}));

vi.mock('@/i18n', () => ({
  getCurrentLocale: () => currentLocale.value,
  t: (key: string) => {
    if (key === 'taskTag')
      return '#任务';
    if (key === 'dateMarker')
      return '📅';
    if (key === 'statusTag') {
      return {
        completed: '#已完成',
        abandoned: '#已放弃',
      };
    }
    if (key === 'todo')
      return {
        exampleDocCreated: '示例文档已创建',
        exampleDocFailed: '创建示例文档失败',
      };
    if (key === 'common.notebookCreateFailed')
      return '创建任务助手笔记本失败';
    return key;
  },
}));

vi.mock('@/api', () => ({
  createDocWithMd,
  pushMsg,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocument,
}));

vi.mock('@/utils/notebookUtils', () => ({
  getOrCreateTaskAssistantNotebook,
}));

vi.mock('siyuan', () => ({
  expandDocTree,
}));

describe('exampleDocUtils', () => {
  beforeEach(() => {
    currentLocale.value = 'zh_CN';
    createDocWithMd.mockClear();
    pushMsg.mockClear();
    openDocument.mockClear();
    getOrCreateTaskAssistantNotebook.mockClear();
    expandDocTree.mockClear();
  });

  it('builds a layered Chinese onboarding example', async () => {
    const { generateExampleContent } = await import('@/utils/exampleDocUtils');

    const content = generateExampleContent();

    expect(content).toContain('## 任务助手示例');
    expect(content).toContain('整理日报 📅2026-05-12');
    expect(content).toContain('复盘会议 📅2026-05-12 18:00');
    expect(content).toContain('整理日报 📅2026-05-12\n\n复盘会议 📅2026-05-12 18:00');
    expect(content).toContain('你也可以在 daily note 里直接写独立事项');
    expect(content).toContain('## 事项和番茄钟');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('专注结束后会自动在事项下追加一条番茄记录');
    expect(content).toContain('## 任务和事项');
    expect(content).toContain('首页改版 #任务 @L1');
    expect(content).toContain('整理需求反馈 📅2026-05-11 #已完成\n\n设计首页原型 📅2026-05-12 🔥');
    expect(content).toContain('设计首页原型 📅2026-05-12 🔥');
    expect(content).toContain('评审视觉稿 📅2026-05-13 ⏰14:00');
    expect(content).toContain('创建或编辑习惯，推荐使用 /xg /habit');
    expect(content).toContain('## 常用斜杠命令');
    expect(content).toContain('/jt /today');
    expect(content).toContain('/xg /habit');
    expect(content).not.toContain('这是一个已放弃的事项');

    const standaloneIndex = content.indexOf('## 快速开始');
    const pomodoroIndex = content.indexOf('## 事项和番茄钟');
    const projectIndex = content.indexOf('## 任务和事项');
    const moreIndex = content.indexOf('## 更多玩法');
    const slashIndex = content.indexOf('## 常用斜杠命令');

    expect(standaloneIndex).toBeGreaterThanOrEqual(0);
    expect(pomodoroIndex).toBeGreaterThan(standaloneIndex);
    expect(projectIndex).toBeGreaterThan(pomodoroIndex);
    expect(moreIndex).toBeGreaterThan(projectIndex);
    expect(slashIndex).toBeGreaterThan(moreIndex);
  });

  it('builds a layered English onboarding example', async () => {
    currentLocale.value = 'en_US';
    const { generateExampleContent } = await import('@/utils/exampleDocUtils');

    const content = generateExampleContent();

    expect(content).toContain('## Task Assistant Example');
    expect(content).toContain('## Quick Start');
    expect(content).toContain('You can also add standalone items in a daily note');
    expect(content).toContain('Write daily summary 📅2026-05-12\n\nReview meeting notes 📅2026-05-12 18:00');
    expect(content).toContain('## Items and Pomodoro');
    expect(content).toContain('Pomodoro focus example 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('## Tasks and Items');
    expect(content).toContain('## More Examples');
    expect(content).toContain('## Common Slash Commands');
    expect(content).toContain('/jt /today');
    expect(content).toContain('/xg /habit');
    expect(content).toContain('Create or edit habits with /xg /habit');
    expect(content).not.toContain('This is an abandoned item');
  });

  it('passes the structured content into document creation', async () => {
    const { createExampleDocument } = await import('@/utils/exampleDocUtils');

    await createExampleDocument();

    expect(getOrCreateTaskAssistantNotebook).toHaveBeenCalledTimes(1);
    expect(createDocWithMd).toHaveBeenCalledTimes(1);
    expect(createDocWithMd.mock.calls[0][2]).toContain('## 快速开始');
    expect(createDocWithMd.mock.calls[0][2]).toContain('/xg /habit');
    expect(openDocument).toHaveBeenCalledWith('doc-id');
    expect(expandDocTree).toHaveBeenCalledWith({ id: 'doc-id', isSetCurrent: true });
  });
});
