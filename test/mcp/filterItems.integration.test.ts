/**
 * filter_items 集成测试 - 多日期事项验证
 * 测试数据来自 test-data/multi-date-test.md
 * 需要在 .env 中配置 SIYUAN_TOKEN 和 SIYUAN_API_URL
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SiYuanClient } from '@/mcp/siyuan-client';
import { loadSettings } from '@/mcp/dataLoader';
import { executeFilterItems, type FilterItemOutput } from '@/mcp/filterItems';
import { executeListProjects } from '@/mcp/listProjects';
import type { ProjectDirectory } from '@/types/models';

const token = process.env.SIYUAN_TOKEN;
const apiUrl = process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';

const TEST_PROJECT_NAME = '多日期事项测试文档';

describe.skipIf(!token)('filter_items 集成测试 - 多日期事项', () => {
  let client: SiYuanClient;
  let directories: ProjectDirectory[];
  let testProjectId: string;
  let allItems: FilterItemOutput[];

  async function fetchItems(): Promise<FilterItemOutput[]> {
    const result = await executeFilterItems(client, directories, { projectId: testProjectId });
    return result.items;
  }

  function getItemsByContent(content: string): FilterItemOutput[] {
    return allItems.filter(i => i.content === content);
  }

  beforeAll(async () => {
    client = new SiYuanClient({ apiUrl, token: token! });
    const settings = await loadSettings(client);
    directories = settings.directories || [];

    const projectsResult = await executeListProjects(client, directories, {});
    const project = projectsResult.projects.find(p => p.name === TEST_PROJECT_NAME);
    if (!project) {
      throw new Error(`未找到测试项目: ${TEST_PROJECT_NAME}`);
    }
    testProjectId = project.id;

    allItems = await fetchItems();
  });

  describe('基础验证', () => {
    it('应找到测试项目', () => {
      expect(testProjectId).toBeDefined();
      expect(allItems.length).toBeGreaterThan(0);
    });

    it('事项应属于正确的项目', () => {
      allItems.forEach(item => {
        expect(item.projectName).toBe(TEST_PROJECT_NAME);
      });
    });
  });

  describe('单日期事项验证', () => {
    it('单日期事项A: date=2026-03-06, status=pending, 无时间', async () => {
      const items = getItemsByContent('单日期事项A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '单日期事项A',
        date: '2026-03-06',
        status: 'pending'
      });
      expect(items[0].startDateTime).toBeUndefined();
      expect(items[0].endDateTime).toBeUndefined();
    });

    it('单日期事项B: date=2026-03-10, time=14:00~15:00, status=pending', async () => {
      const items = getItemsByContent('单日期事项B');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '单日期事项B',
        date: '2026-03-10',
        startDateTime: '14:00:00',
        endDateTime: '15:00:00',
        status: 'pending'
      });
    });

    it('单日期事项C: date=2026-03-15, status=completed', async () => {
      const items = getItemsByContent('单日期事项C');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '单日期事项C',
        date: '2026-03-15',
        status: 'completed'
      });
    });

    it('单日期事项D: date=2026-03-20, status=abandoned', async () => {
      const items = getItemsByContent('单日期事项D');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '单日期事项D',
        date: '2026-03-20',
        status: 'abandoned'
      });
    });
  });

  describe('多日期事项验证（英文逗号）', () => {
    it('多日期英文A: 展开为3条，日期为 06, 10, 15', async () => {
      const items = getItemsByContent('多日期英文A');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-06', '2026-03-10', '2026-03-15']);
      items.forEach((item) => {
        expect(item.content).toBe('多日期英文A');
        expect(item.status).toBe('pending');
        expect(item.startDateTime).toBeUndefined();
        expect(item.endDateTime).toBeUndefined();
      });
    });

    it('多日期英文B: 展开为2条，每条有对应时间', async () => {
      const items = getItemsByContent('多日期英文B');
      expect(items).toHaveLength(2);

      const item10 = items.find(i => i.date === '2026-03-10');
      expect(item10).toBeDefined();
      expect(item10).toMatchObject({
        content: '多日期英文B',
        date: '2026-03-10',
        startDateTime: '09:00:00',
        endDateTime: '10:00:00',
        status: 'pending'
      });

      const item12 = items.find(i => i.date === '2026-03-12');
      expect(item12).toBeDefined();
      expect(item12).toMatchObject({
        content: '多日期英文B',
        date: '2026-03-12',
        startDateTime: '14:00:00',
        endDateTime: '15:00:00',
        status: 'pending'
      });
    });
  });

  describe('多日期事项验证（中文逗号）', () => {
    it('多日期中文A: 中文逗号分隔，展开为3条', async () => {
      const items = getItemsByContent('多日期中文A');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-06', '2026-03-10', '2026-03-15']);
      items.forEach((item) => {
        expect(item.content).toBe('多日期中文A');
        expect(item.status).toBe('pending');
      });
    });

    it('多日期中文B: 中文逗号分隔，带时间', async () => {
      const items = getItemsByContent('多日期中文B');
      expect(items).toHaveLength(2);

      const item10 = items.find(i => i.date === '2026-03-10');
      expect(item10).toMatchObject({
        startDateTime: '09:00:00',
        endDateTime: '10:00:00'
      });

      const item12 = items.find(i => i.date === '2026-03-12');
      expect(item12).toMatchObject({
        startDateTime: '14:00:00',
        endDateTime: '15:00:00'
      });
    });
  });

  describe('多日期事项验证（混合逗号）', () => {
    it('多日期混合: 中英文逗号混合，展开为3条', async () => {
      const items = getItemsByContent('多日期混合');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-06', '2026-03-10', '2026-03-15']);
    });
  });

  describe('日期范围验证（完整格式）', () => {
    it('范围完整A: 2026-03-10~2026-03-12 展开为3条', async () => {
      const items = getItemsByContent('范围完整A');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
      items.forEach((item) => {
        expect(item.content).toBe('范围完整A');
        expect(item.status).toBe('pending');
        expect(item.startDateTime).toBeUndefined();
        expect(item.endDateTime).toBeUndefined();
      });
    });

    it('范围完整B: 5天范围，每天共享相同时间 09:00~17:00', async () => {
      const items = getItemsByContent('范围完整B');
      expect(items).toHaveLength(5);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual([
        '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'
      ]);
      items.forEach((item) => {
        expect(item.startDateTime).toBe('09:00:00');
        expect(item.endDateTime).toBe('17:00:00');
        expect(item.status).toBe('pending');
      });
    });
  });

  describe('日期范围验证（简写格式）', () => {
    it('范围简写A: 简写格式 03-10~03-12 展开为3条', async () => {
      const items = getItemsByContent('范围简写A');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
    });

    it('范围简写B: 简写格式带时间 09:00~10:00', async () => {
      const items = getItemsByContent('范围简写B');
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.startDateTime).toBe('09:00:00');
        expect(item.endDateTime).toBe('10:00:00');
      });
    });
  });

  describe('混合模式验证', () => {
    it('混合场景A: 复杂日期组合，展开为5条', async () => {
      const items = getItemsByContent('混合场景A');
      expect(items).toHaveLength(5);

      const item06 = items.find(i => i.date === '2026-03-06');
      expect(item06).toMatchObject({
        startDateTime: '09:00:00',
        endDateTime: '09:30:00'
      });

      ['2026-03-10', '2026-03-11', '2026-03-12'].forEach((d) => {
        const item = items.find(i => i.date === d);
        expect(item).toMatchObject({
          startDateTime: '14:00:00',
          endDateTime: '15:00:00'
        });
      });

      const item15 = items.find(i => i.date === '2026-03-15');
      expect(item15).toMatchObject({
        startDateTime: '10:00:00',
        endDateTime: '11:00:00'
      });
    });

    it('混合场景B: 展开为5条，status=completed', async () => {
      const items = getItemsByContent('混合场景B');
      expect(items).toHaveLength(5);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual([
        '2026-03-06', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-15'
      ]);
      items.forEach((item) => {
        expect(item.status).toBe('completed');
      });
    });

    it('混合场景C: 跨月范围 2026-03-28~2026-04-02 展开为6条', async () => {
      const items = getItemsByContent('混合场景C');
      expect(items).toHaveLength(6);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual([
        '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
        '2026-04-01', '2026-04-02'
      ]);
    });
  });

  describe('状态筛选验证', () => {
    it('completed 状态事项验证', async () => {
      const result = await executeFilterItems(client, directories, {
        status: 'completed',
        projectId: testProjectId
      });
      const completedItems = result.items;

      const completedNames = [...new Set(completedItems.map(i => i.content))];
      expect(completedNames).toContain('单日期事项C');
      expect(completedNames).toContain('混合场景B');
      expect(completedNames).toContain('状态完成A');
      expect(completedNames).toContain('状态完成B');
      expect(completedNames).toContain('有序多日期B');

      const itemC = completedItems.find(i => i.content === '单日期事项C');
      expect(itemC?.date).toBe('2026-03-15');
    });

    it('abandoned 状态事项验证', async () => {
      const result = await executeFilterItems(client, directories, {
        status: 'abandoned',
        projectId: testProjectId
      });
      const abandonedItems = result.items;

      const abandonedNames = [...new Set(abandonedItems.map(i => i.content))];
      expect(abandonedNames).toContain('单日期事项D');
      expect(abandonedNames).toContain('状态放弃A');
      expect(abandonedNames).toContain('状态放弃B');
    });

    it('pending 状态事项验证', async () => {
      const result = await executeFilterItems(client, directories, {
        status: 'pending',
        projectId: testProjectId
      });
      const pendingItems = result.items;

      const pendingNames = [...new Set(pendingItems.map(i => i.content))];
      expect(pendingNames).toContain('单日期事项A');
      expect(pendingNames).toContain('单日期事项B');
      expect(pendingNames).toContain('多日期英文A');
      expect(pendingNames).toContain('多日期中文A');
      expect(pendingNames).not.toContain('单日期事项C');
      expect(pendingNames).not.toContain('单日期事项D');
    });
  });

  describe('边界情况验证', () => {
    it('边界单时间: 只有开始时间 09:00:00', async () => {
      const items = getItemsByContent('边界单时间');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '边界单时间',
        date: '2026-03-06',
        startDateTime: '09:00:00'
      });
      expect(items[0].endDateTime).toBeUndefined();
    });

    it('边界时间范围: 09:00:00~10:00:00', async () => {
      const items = getItemsByContent('边界时间范围');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '边界时间范围',
        date: '2026-03-06',
        startDateTime: '09:00:00',
        endDateTime: '10:00:00'
      });
    });

    it('边界年底: 跨年日期 2026-12-30, 2026-12-31, 2027-01-01', async () => {
      const items = getItemsByContent('边界年底');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
    });

    it('边界闰年: 2024-02-28, 2024-02-29, 2024-03-01', async () => {
      const items = getItemsByContent('边界闰年');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
    });
  });

  describe('任务层级验证', () => {
    it('层级事项A: date=2026-03-10, time=09:00~10:00', async () => {
      const items = getItemsByContent('层级事项A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '层级事项A',
        date: '2026-03-10',
        startDateTime: '09:00:00',
        endDateTime: '10:00:00'
      });
    });

    it('层级事项B: date=2026-03-11, time=14:00~15:00', async () => {
      const items = getItemsByContent('层级事项B');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '层级事项B',
        date: '2026-03-11',
        startDateTime: '14:00:00',
        endDateTime: '15:00:00'
      });
    });

    it('层级事项C: date=2026-03-12', async () => {
      const items = getItemsByContent('层级事项C');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '层级事项C',
        date: '2026-03-12'
      });
    });

    it('层级事项D: date=2026-03-13', async () => {
      const items = getItemsByContent('层级事项D');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '层级事项D',
        date: '2026-03-13'
      });
    });
  });

  describe('链接测试（缩进格式）', () => {
    it('链接缩进A: date=2026-03-10', async () => {
      const items = getItemsByContent('链接缩进A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '链接缩进A',
        date: '2026-03-10'
      });
    });

    it('链接缩进B: 展开为2条', async () => {
      const items = getItemsByContent('链接缩进B');
      expect(items).toHaveLength(2);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-06', '2026-03-10']);
    });

    it('链接缩进C: date=2026-03-15', async () => {
      const items = getItemsByContent('链接缩进C');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '链接缩进C',
        date: '2026-03-15'
      });
    });
  });

  describe('链接测试（不缩进格式）', () => {
    it('链接不缩进A: date=2026-03-20', async () => {
      const items = getItemsByContent('链接不缩进A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '链接不缩进A',
        date: '2026-03-20'
      });
    });

    it('链接不缩进B: 展开为2条', async () => {
      const items = getItemsByContent('链接不缩进B');
      expect(items).toHaveLength(2);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-25', '2026-03-26']);
    });
  });

  describe('链接测试（无序列表格式）', () => {
    it('链接无序A: date=2026-03-28', async () => {
      const items = getItemsByContent('链接无序A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '链接无序A',
        date: '2026-03-28'
      });
    });

    it('链接无序B: 展开为2条', async () => {
      const items = getItemsByContent('链接无序B');
      expect(items).toHaveLength(2);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-03-29', '2026-03-30']);
    });
  });

  describe('有序列表测试', () => {
    it('有序事项A: date=2026-04-01', async () => {
      const items = getItemsByContent('有序事项A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '有序事项A',
        date: '2026-04-01'
      });
    });

    it('有序事项B: date=2026-04-02, time=09:00~10:00', async () => {
      const items = getItemsByContent('有序事项B');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '有序事项B',
        date: '2026-04-02',
        startDateTime: '09:00:00',
        endDateTime: '10:00:00'
      });
    });

    it('有序子事项A: date=2026-04-03', async () => {
      const items = getItemsByContent('有序子事项A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '有序子事项A',
        date: '2026-04-03'
      });
    });

    it('有序事项C: date=2026-04-04', async () => {
      const items = getItemsByContent('有序事项C');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '有序事项C',
        date: '2026-04-04'
      });
    });
  });

  describe('有序列表多日期', () => {
    it('有序多日期A: 展开为3条', async () => {
      const items = getItemsByContent('有序多日期A');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-04-05', '2026-04-10', '2026-04-15']);
      items.forEach((item) => {
        expect(item.status).toBe('pending');
      });
    });

    it('有序多日期B: 展开为3条, status=completed', async () => {
      const items = getItemsByContent('有序多日期B');
      expect(items).toHaveLength(3);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-04-06', '2026-04-07', '2026-04-08']);
      items.forEach((item) => {
        expect(item.status).toBe('completed');
      });
    });
  });

  describe('有序列表链接测试', () => {
    it('有序链接A: date=2026-04-20', async () => {
      const items = getItemsByContent('有序链接A');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        content: '有序链接A',
        date: '2026-04-20'
      });
    });

    it('有序链接B: 展开为2条', async () => {
      const items = getItemsByContent('有序链接B');
      expect(items).toHaveLength(2);
      const dates = items.map(i => i.date).sort();
      expect(dates).toEqual(['2026-04-21', '2026-04-22']);
    });
  });

  describe('日期筛选验证', () => {
    it('筛选 2026-03-06 的事项', async () => {
      const result = await executeFilterItems(client, directories, {
        projectId: testProjectId,
        startDate: '2026-03-06',
        endDate: '2026-03-06'
      });
      const items = result.items;

      const names = [...new Set(items.map(i => i.content))];
      expect(names).toContain('单日期事项A');
      expect(names).toContain('多日期英文A');
      expect(names).toContain('多日期中文A');
      expect(names).toContain('多日期混合');
      expect(names).toContain('链接缩进B');
      expect(names).toContain('边界单时间');
      expect(names).toContain('边界时间范围');

      items.forEach((item) => {
        expect(item.date).toBe('2026-03-06');
      });
    });

    it('筛选 2026-03-10 的事项', async () => {
      const result = await executeFilterItems(client, directories, {
        projectId: testProjectId,
        startDate: '2026-03-10',
        endDate: '2026-03-10'
      });
      const items = result.items;

      const names = [...new Set(items.map(i => i.content))];
      expect(names).toContain('单日期事项B');
      expect(names).toContain('多日期英文A');
      expect(names).toContain('多日期中文A');
      expect(names).toContain('多日期混合');
      expect(names).toContain('范围完整A');
      expect(names).toContain('范围完整B');
      expect(names).toContain('范围简写A');
      expect(names).toContain('范围简写B');
      expect(names).toContain('混合场景A');
      expect(names).toContain('混合场景B');
      expect(names).toContain('状态完成A');
      expect(names).toContain('状态放弃A');
      expect(names).toContain('状态完成B');
      expect(names).toContain('状态放弃B');
      expect(names).toContain('层级事项A');
      expect(names).toContain('链接缩进A');
      expect(names).toContain('链接缩进B');

      items.forEach((item) => {
        expect(item.date).toBe('2026-03-10');
      });
    });

    it('筛选日期范围 2026-03-10~2026-03-12', async () => {
      const result = await executeFilterItems(client, directories, {
        projectId: testProjectId,
        startDate: '2026-03-10',
        endDate: '2026-03-12'
      });
      const items = result.items;

      items.forEach((item) => {
        const d = item.date;
        expect(d >= '2026-03-10' && d <= '2026-03-12').toBe(true);
      });

      const names = [...new Set(items.map(i => i.content))];
      expect(names).toContain('范围完整A');
      expect(names).toContain('范围简写A');
      expect(names).toContain('层级事项A');
    });

    it('筛选跨月范围 2026-03-28~2026-04-02', async () => {
      const result = await executeFilterItems(client, directories, {
        projectId: testProjectId,
        startDate: '2026-03-28',
        endDate: '2026-04-02'
      });
      const items = result.items;

      const dates = [...new Set(items.map(i => i.date))].sort();
      expect(dates).toContain('2026-03-28');
      expect(dates).toContain('2026-03-29');
      expect(dates).toContain('2026-03-30');
      expect(dates).toContain('2026-03-31');
      expect(dates).toContain('2026-04-01');
      expect(dates).toContain('2026-04-02');

      const names = [...new Set(items.map(i => i.content))];
      expect(names).toContain('混合场景C');
      expect(names).toContain('链接无序A');
    });
  });
});
