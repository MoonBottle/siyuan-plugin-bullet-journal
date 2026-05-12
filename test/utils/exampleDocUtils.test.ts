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
    expect(content).toContain('跟进发布问题 📅2026-05-13');
    expect(content).toContain('整理日报 📅2026-05-12\n\n跟进发布问题 📅2026-05-13');
    expect(content).toContain('然后在编辑器里输入 / 打开斜杠命令，用 /jt 或 /mt 给当前行补日期');
    expect(content).toContain('在斜杠命令里，/jt 会把当前行标记为今天的事项，/mt 会把当前行标记为明天的事项');
    expect(content).toContain('## 事项状态');
    expect(content).toContain('整理会议结论 📅2026-05-12 #已完成');
    expect(content).toContain('放弃旧方案 📅2026-05-11 ❌');
    expect(content).toContain('事项完成后，可用 /wc 把当前行标记为已完成；不再处理时，可用 /fq 标记为已放弃');
    expect(content).toContain('## 事项和番茄钟');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25');
    expect(content).toContain('番茄专注示例 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('专注结束后会自动在事项下追加一条番茄记录');
    expect(content).toContain('## 任务和事项');
    expect(content).toContain('首页改版 #任务');
    expect(content).toContain('整理需求反馈 📅2026-05-11 #已完成');
    expect(content).toContain('发布准备 #任务');
    expect(content).toContain('设计首页原型 📅2026-05-12 🔥');
    expect(content).toContain('评审视觉稿 📅2026-05-12 ⏰14:00');
    expect(content).toContain('这里的 #任务 表示“任务”');
    expect(content).toContain('下面带 📅 日期的行是这个任务里的具体事项');
    expect(content).toContain('## 优先级');
    expect(content).toContain('首页细化 #任务');
    expect(content).toContain('首页细化 #任务\n\n设计首页原型 📅2026-05-12 🔥');
    expect(content).toContain('先把事项内容写出来，再用 /yxj 添加优先级标记');
    expect(content).toContain('优先级标记里，🔥 表示高优先级，🌱 表示中优先级，🍃 表示低优先级');
    expect(content).toContain('## 提醒');
    expect(content).toContain('评审准备 #任务');
    expect(content).toContain('评审准备 #任务\n\n评审视觉稿 📅2026-05-12 ⏰14:00');
    expect(content).toContain('先写事项内容，再用 /tx 补一个提醒时间');
    expect(content).toContain('## 重复');
    expect(content).toContain('工作日例行 #任务');
    expect(content).toContain('工作日例行 #任务\n\n同步每日进展 📅2026-05-12 🔁工作日');
    expect(content).toContain('先写事项内容，再用 /cf 把它变成重复事项');
    expect(content).toContain('当你把当前事项标记为完成后，插件会自动生成下一次工作日事项');
    expect(content).toContain('## 更多玩法');
    expect(content).toContain('### 习惯');
    expect(content).toContain('创建或编辑习惯，推荐使用 /xg；需要打卡时，用 /dk 添加今天的打卡记录');
    expect(content).toContain('晨间拉伸 📅2026-05-12');
    expect(content).toContain('### 多日期');
    expect(content).toContain('培训准备 #任务');
    expect(content).toContain('培训准备 #任务\n\n整理培训资料 📅2026-05-12, 2026-05-13');
    expect(content).toContain('先写事项内容，再补多个日期');
    expect(content).toContain('### 链接');
    expect(content).toContain('发布说明整理 #任务');
    expect(content).toContain('查看接口变更 📅2026-05-12\n\n[需求文档](https://example.com/spec)');
    expect(content).toContain('先写事项，再把相关链接放在下面');
    expect(content).toContain('这样添加的链接会显示在事项详情里。按住 Ctrl 后左键点击事项行，即可打开事项详情');
    expect(content).toContain('## 常用斜杠命令');
    expect(content).toContain('- /jt：添加今日事项');
    expect(content).toContain('- /xg：创建或编辑习惯');
    expect(content).toContain('- /fq：标记为放弃');
    expect(content).toContain('- /dk：添加习惯打卡');
    expect(content).toContain('- /yxj：设置优先级');
    expect(content).not.toContain('/today');
    expect(content).not.toContain('/habit');
    expect(content).not.toContain('这是一个已放弃的事项');

    const standaloneIndex = content.indexOf('## 快速开始');
    const statusIndex = content.indexOf('## 事项状态');
    const pomodoroIndex = content.indexOf('## 事项和番茄钟');
    const projectIndex = content.indexOf('## 任务和事项');
    const priorityIndex = content.indexOf('## 优先级');
    const reminderIndex = content.indexOf('## 提醒');
    const recurringIndex = content.indexOf('## 重复');
    const moreIndex = content.indexOf('## 更多玩法');
    const slashIndex = content.indexOf('## 常用斜杠命令');

    expect(standaloneIndex).toBeGreaterThanOrEqual(0);
    expect(statusIndex).toBeGreaterThan(standaloneIndex);
    expect(pomodoroIndex).toBeGreaterThan(statusIndex);
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
    expect(content).toContain('Then type / in the editor to open slash commands, and use /today or /tomorrow to add a date');
    expect(content).toContain('Follow up on release issues 📅2026-05-13');
    expect(content).toContain('Write daily summary 📅2026-05-12\n\nFollow up on release issues 📅2026-05-13');
    expect(content).toContain('In slash commands, /today adds today\'s date to the current line, and /tomorrow adds tomorrow\'s date');
    expect(content).toContain('## Item Status');
    expect(content).toContain('Finish meeting notes 📅2026-05-12 #已完成');
    expect(content).toContain('Drop outdated draft 📅2026-05-11 ❌');
    expect(content).toContain('When an item is done, use /done to mark the current line as completed. If you no longer plan to do it, use /abandon to mark it as abandoned');
    expect(content).toContain('## Items and Pomodoro');
    expect(content).toContain('Pomodoro focus example 📅2026-05-12 10:00~10:25\n\n🍅2026-05-12 10:00:00~10:25:00');
    expect(content).toContain('## Tasks and Items');
    expect(content).toContain('Here, #任务 marks a task');
    expect(content).toContain('The lines with 📅 dates below it are the actual items');
    expect(content).toContain('## Priority');
    expect(content).toContain('Homepage polish #任务');
    expect(content).toContain('Homepage polish #任务\n\nDesign the homepage draft 📅2026-05-12 🔥');
    expect(content).toContain('use /priority to add the priority marker');
    expect(content).toContain('Priority markers use 🔥 for high priority, 🌱 for medium priority, and 🍃 for low priority');
    expect(content).toContain('## Reminders');
    expect(content).toContain('Design review prep #任务');
    expect(content).toContain('Design review prep #任务\n\nReview visual draft 📅2026-05-12 ⏰14:00');
    expect(content).toContain('use /reminder to attach a reminder time');
    expect(content).toContain('## Recurring');
    expect(content).toContain('Workday routine #任务');
    expect(content).toContain('Workday routine #任务\n\nDaily status sync 📅2026-05-12 🔁workday');
    expect(content).toContain('use /recurring to turn it into a repeating item');
    expect(content).toContain('after you mark this item as done, the plugin will automatically create the next workday occurrence');
    expect(content).toContain('## More Examples');
    expect(content).toContain('### Habits');
    expect(content).toContain('Create or edit habits with /habit, and use /checkin to add a check-in record');
    expect(content).toContain('Morning stretch 📅2026-05-12');
    expect(content).toContain('### Multiple Dates');
    expect(content).toContain('Workshop prep #任务');
    expect(content).toContain('Workshop prep #任务\n\nPrepare workshop material 📅2026-05-12, 2026-05-13');
    expect(content).toContain('then add more dates when one item belongs to multiple days');
    expect(content).toContain('### Links');
    expect(content).toContain('Release notes review #任务');
    expect(content).toContain('Review API changes 📅2026-05-12\n\n[Spec doc](https://example.com/spec)');
    expect(content).toContain('Put the item first, then keep the related link under it');
    expect(content).toContain('Links added this way appear in the item details. Press Ctrl and left-click the item line to open it');
    expect(content).toContain('## Common Slash Commands');
    expect(content).toContain('- /today: Add today\'s item');
    expect(content).toContain('- /habit: Create or edit habits');
    expect(content).toContain('- /abandon: Mark as abandoned');
    expect(content).toContain('- /checkin: Add a habit check-in');
    expect(content).toContain('- /priority: Set priority');
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
