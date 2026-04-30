import { describe, expect, it } from 'vitest';
import { parseKramdown } from '@/parser/core';

describe('习惯行斜杠命令输入中的解析稳定性', () => {
  it('习惯定义行在输入 /dk 过程中不应从解析结果中消失', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
喝水 🎯2026-04-19 8杯 🔄每天/dk
{: id="habit-block" }
喝水 2/8杯 📅2026-04-30
{: id="record-block" }
`;

    const project = parseKramdown(kramdown, 'test-doc');

    expect(project).not.toBeNull();
    expect(project!.habits).toHaveLength(1);
    expect(project!.habits[0].blockId).toBe('habit-block');
    expect(project!.habits[0].type).toBe('count');
    expect(project!.habits[0].target).toBe(8);
    expect(project!.habits[0].frequency?.type).toBe('daily');
    expect(project!.habits[0].records).toHaveLength(1);
    expect(project!.habits[0].records[0].blockId).toBe('record-block');
  });

  it('习惯 record 行在输入 /dk 过程中也不应丢失当前习惯上下文', () => {
    const kramdown = `# 测试项目
{: id="doc-block" type="doc" }
早起 🎯2026-04-19 🔄每天
{: id="habit-block" }
早起 📅2026-04-30 ✅/dk
{: id="record-block" }
`;

    const project = parseKramdown(kramdown, 'test-doc');

    expect(project).not.toBeNull();
    expect(project!.habits).toHaveLength(1);
    expect(project!.habits[0].records).toHaveLength(1);
    expect(project!.habits[0].records[0].blockId).toBe('record-block');
    expect(project!.habits[0].records[0].date).toBe('2026-04-30');
  });
});
