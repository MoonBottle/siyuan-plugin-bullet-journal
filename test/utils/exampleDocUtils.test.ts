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
    expect(content).toContain('不想手写日期时，可用 /jt 和 /mt');
    expect(content).toContain('## 事项和番茄钟');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('专注结束后会自动在事项下追加一条番茄记录');
    expect(content).toContain('## 任务和事项');
    expect(content).toContain('首页改版 #任务 @L1');
    expect(content).toContain('整理需求反馈 📅2026-05-11 #已完成');
    expect(content).toContain('发布准备 #任务 @L1');
    expect(content).toContain('设计首页原型 📅2026-05-12 🔥');
    expect(content).toContain('评审视觉稿 📅2026-05-13 ⏰14:00');
    expect(content).toContain('这里的 #任务 表示“任务”，@L1 表示任务级别');
    expect(content).toContain('下面带 📅 日期的行是这个任务里的具体事项');
    expect(content).toContain('## 优先级');
    expect(content).toContain('先把事项内容写出来，再用 /yx 添加优先级标记');
    expect(content).toContain('## 提醒');
    expect(content).toContain('先写事项内容，再用 /tx 补一个提醒时间');
    expect(content).toContain('## 重复');
    expect(content).toContain('先写事项内容，再用 /cf 把它变成重复事项');
    expect(content).toContain('## 更多玩法');
    expect(content).toContain('### 习惯');
    expect(content).toContain('创建或编辑习惯，推荐使用 /xg，不建议一开始手写这些标记');
    expect(content).toContain('### 多日期');
    expect(content).toContain('先写事项内容，再补多个日期');
    expect(content).toContain('### 链接');
    expect(content).toContain('查看接口变更 📅2026-05-13\n\n[需求文档](https://example.com/spec)');
    expect(content).toContain('先写事项，再把相关链接放在下面');
    expect(content).toContain('## 常用斜杠命令');
    expect(content).toContain('- /jt：添加今日事项');
    expect(content).toContain('- /xg：创建或编辑习惯');
    expect(content).not.toContain('/today');
    expect(content).not.toContain('/habit');
    expect(content).not.toContain('这是一个已放弃的事项');

    const standaloneIndex = content.indexOf('## 快速开始');
    const pomodoroIndex = content.indexOf('## 事项和番茄钟');
    const projectIndex = content.indexOf('## 任务和事项');
    const priorityIndex = content.indexOf('## 优先级');
    const reminderIndex = content.indexOf('## 提醒');
    const recurringIndex = content.indexOf('## 重复');
    const moreIndex = content.indexOf('## 更多玩法');
    const slashIndex = content.indexOf('## 常用斜杠命令');

    expect(standaloneIndex).toBeGreaterThanOrEqual(0);
    expect(pomodoroIndex).toBeGreaterThan(standaloneIndex);
    expect(projectIndex).toBeGreaterThan(pomodoroIndex);
    expect(priorityIndex).toBeGreaterThan(projectIndex);
    expect(reminderIndex).toBeGreaterThan(priorityIndex);
    expect(recurringIndex).toBeGreaterThan(reminderIndex);
    expect(moreIndex).toBeGreaterThan(recurringIndex);
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
    expect(content).toContain('Skip manual dates with /today and /tomorrow');
    expect(content).toContain('## Items and Pomodoro');
    expect(content).toContain('Pomodoro focus example 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('## Tasks and Items');
    expect(content).toContain('Here, #任务 marks a task, and @L1 is its level');
    expect(content).toContain('The lines with 📅 dates below it are the actual items');
    expect(content).toContain('## Priority');
    expect(content).toContain('use /priority to add the priority marker');
    expect(content).toContain('## Reminders');
    expect(content).toContain('use /reminder to attach a reminder time');
    expect(content).toContain('## Recurring');
    expect(content).toContain('use /recurring to turn it into a repeating item');
    expect(content).toContain('## More Examples');
    expect(content).toContain('### Habits');
    expect(content).toContain('Create or edit habits with /habit instead of typing the markers manually');
    expect(content).toContain('### Multiple Dates');
    expect(content).toContain('then add more dates when one item belongs to multiple days');
    expect(content).toContain('### Links');
    expect(content).toContain('Review API changes 📅2026-05-13\n\n[Spec doc](https://example.com/spec)');
    expect(content).toContain('Put the item first, then keep the related link under it');
    expect(content).toContain('## Common Slash Commands');
    expect(content).toContain('- /today: Add today\'s item');
    expect(content).toContain('- /habit: Create or edit habits');
    expect(content).not.toContain('/jt');
    expect(content).not.toContain('/xg');
    expect(content).not.toContain('This is an abandoned item');
  });

  it('passes the structured content into document creation', async () => {
    const { createExampleDocument } = await import('@/utils/exampleDocUtils');

    await createExampleDocument();

    expect(getOrCreateTaskAssistantNotebook).toHaveBeenCalledTimes(1);
    expect(createDocWithMd).toHaveBeenCalledTimes(1);
    expect(createDocWithMd.mock.calls[0][2]).toContain('## 快速开始');
    expect(createDocWithMd.mock.calls[0][2]).toContain('### 习惯');
    expect(createDocWithMd.mock.calls[0][2]).toContain('/xg');
    expect(openDocument).toHaveBeenCalledWith('doc-id');
    expect(expandDocTree).toHaveBeenCalledWith({ id: 'doc-id', isSetCurrent: true });
  });
});
