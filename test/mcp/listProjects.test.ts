/**
 * list_projects 测试
 * - buildListProjectsResult：纯函数单元测试
 * - executeListProjects：集成测试（需思源运行，在 .env 中配置 SIYUAN_TOKEN、SIYUAN_API_URL）
 */
import { describe, it, expect } from 'vitest';
import { buildListProjectsResult, executeListProjects } from '@/mcp/listProjects';
import { SiYuanClient } from '@/mcp/siyuan-client';
import { loadSettings } from '@/mcp/dataLoader';
import type { Project, Task } from '@/types/models';

const token = process.env.SIYUAN_TOKEN;
const apiUrl = process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';

function createMockTask(): Task {
  return { id: 't1', name: '任务', level: 'L1', items: [], lineNumber: 1 };
}

function createMockProject(overrides: Partial<Project>): Project {
  return {
    id: 'proj-1',
    name: '测试项目',
    path: '/test',
    tasks: [],
    ...overrides
  };
}

describe('buildListProjectsResult 单元测试', () => {
  it('无 groupId 时返回全部项目', () => {
    const projects: Project[] = [
      createMockProject({ id: 'p1', name: '项目1', groupId: 'g1', tasks: [createMockTask()] }),
      createMockProject({ id: 'p2', name: '项目2', groupId: 'g2', tasks: [] })
    ];
    const result = buildListProjectsResult(projects, {});
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'p1', name: '项目1', groupId: 'g1', taskCount: 1 });
    expect(result[1]).toMatchObject({ id: 'p2', name: '项目2', groupId: 'g2', taskCount: 0 });
  });

  it('有 groupId 时只返回匹配的项目', () => {
    const projects: Project[] = [
      createMockProject({ id: 'p1', groupId: 'g1', tasks: [] }),
      createMockProject({ id: 'p2', groupId: 'g2', tasks: [] }),
      createMockProject({ id: 'p3', groupId: 'g1', tasks: [] })
    ];
    const result = buildListProjectsResult(projects, { groupId: 'g1' });
    expect(result).toHaveLength(2);
    expect(result.every(p => p.groupId === 'g1')).toBe(true);
  });
});

describe.skipIf(!token)('list_projects 集成测试（真实思源 API）', () => {
  it('用真实参数 groupId 调用 executeListProjects，返回与 tool 一致的结构', async () => {
    const client = new SiYuanClient({ apiUrl, token });
    const { directories } = await loadSettings(client);

    const args = { groupId: 'group-1772070256854' };
    const result = await executeListProjects(client, directories || [], args);

    expect(result).toHaveProperty('projects');
    expect(Array.isArray(result.projects)).toBe(true);

    result.projects.forEach(p => {
      expect(p).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        path: expect.any(String),
        groupId: 'group-1772070256854',
        taskCount: expect.any(Number)
      });
      expect(p.description === undefined || typeof p.description === 'string').toBe(true);
    });

    if (result.projects.length === 0) {
      console.warn(
        '[list_projects 集成测试] 当前配置下该 groupId 无项目，请确认思源已配置启用目录且目录的 groupId 为 group-1772070256854'
      );
    }
  });

  it('不传 groupId 时返回全部项目', async () => {
    const client = new SiYuanClient({ apiUrl, token });
    const { directories } = await loadSettings(client);

    const result = await executeListProjects(client, directories || [], {});

    expect(Array.isArray(result.projects)).toBe(true);
    result.projects.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('path');
      expect(p).toHaveProperty('groupId');
      expect(p).toHaveProperty('taskCount');
    });
  });
});
