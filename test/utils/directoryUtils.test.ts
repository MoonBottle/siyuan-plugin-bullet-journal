import { describe, it, expect } from 'vitest';
import { matchGroupId } from '@/utils/directoryUtils';
import type { ProjectDirectory } from '@/types/models';

describe('matchGroupId', () => {
  const createDir = (path: string, groupId: string, enabled = true): ProjectDirectory => ({
    id: `dir-${path}`,
    path,
    enabled,
    groupId
  });

  it('should return undefined when no directories provided', () => {
    const result = matchGroupId('工作/项目A', []);
    expect(result).toBeUndefined();
  });

  it('should return undefined when no directories enabled', () => {
    const dirs = [createDir('工作', 'group1', false)];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBeUndefined();
  });

  it('should match exact path', () => {
    const dirs = [createDir('工作', 'work-group')];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBe('work-group');
  });

  it('should return undefined when path does not match', () => {
    const dirs = [createDir('工作', 'work-group')];
    const result = matchGroupId('个人/日记', dirs);
    expect(result).toBeUndefined();
  });

  it('should use longest path first matching', () => {
    const dirs = [
      createDir('工作', 'work-group'),
      createDir('工作/重要', 'important-group')
    ];
    const result = matchGroupId('工作/重要/项目A', dirs);
    expect(result).toBe('important-group');
  });

  it('should match multiple levels', () => {
    const dirs = [
      createDir('工作', 'work'),
      createDir('学习', 'study'),
      createDir('个人', 'personal')
    ];
    expect(matchGroupId('工作/2024/项目', dirs)).toBe('work');
    expect(matchGroupId('学习/前端/React', dirs)).toBe('study');
    expect(matchGroupId('个人/健康/运动', dirs)).toBe('personal');
  });

  it('should handle empty groupId', () => {
    const dirs = [{ id: 'dir1', path: '工作', enabled: true }];
    const result = matchGroupId('工作/项目A', dirs);
    expect(result).toBeUndefined();
  });
});
