import type { ProjectDirectory } from '@/types/models'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  isExcludedByDisabledDirectories,
  matchGroupId,
} from '@/utils/directoryUtils'

describe('matchGroupId', () => {
  const createDir = (path: string, groupId: string, enabled = true): ProjectDirectory => ({
    id: `dir-${path}`,
    path,
    enabled,
    groupId,
  })

  it('should return undefined when no directories provided', () => {
    const result = matchGroupId('工作/项目A', [])
    expect(result).toBeUndefined()
  })

  it('should return undefined when no directories enabled', () => {
    const dirs = [createDir('工作', 'group1', false)]
    const result = matchGroupId('工作/项目A', dirs)
    expect(result).toBeUndefined()
  })

  it('should match exact path', () => {
    const dirs = [createDir('工作', 'work-group')]
    const result = matchGroupId('工作/项目A', dirs)
    expect(result).toBe('work-group')
  })

  it('should return undefined when path does not match', () => {
    const dirs = [createDir('工作', 'work-group')]
    const result = matchGroupId('个人/日记', dirs)
    expect(result).toBeUndefined()
  })

  it('should use longest path first matching', () => {
    const dirs = [
      createDir('工作', 'work-group'),
      createDir('工作/重要', 'important-group'),
    ]
    const result = matchGroupId('工作/重要/项目A', dirs)
    expect(result).toBe('important-group')
  })

  it('should match multiple levels', () => {
    const dirs = [
      createDir('工作', 'work'),
      createDir('学习', 'study'),
      createDir('个人', 'personal'),
    ]
    expect(matchGroupId('工作/2024/项目', dirs)).toBe('work')
    expect(matchGroupId('学习/前端/React', dirs)).toBe('study')
    expect(matchGroupId('个人/健康/运动', dirs)).toBe('personal')
  })

  it('should handle empty groupId', () => {
    const dirs = [{
      id: 'dir1',
      path: '工作',
      enabled: true,
    }]
    const result = matchGroupId('工作/项目A', dirs)
    expect(result).toBeUndefined()
  })
})

describe('isExcludedByDisabledDirectories', () => {
  const createDir = (path: string, enabled = true): ProjectDirectory => ({
    id: `dir-${path}`,
    path,
    enabled,
  })

  it('should return false when no directories provided', () => {
    expect(isExcludedByDisabledDirectories('工作/项目A', [])).toBe(false)
  })

  it('should return false when all directories are enabled', () => {
    const dirs = [createDir('工作', true), createDir('学习', true)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should return true when doc path matches a disabled directory', () => {
    const dirs = [createDir('归档', false)]
    expect(isExcludedByDisabledDirectories('归档/2024/项目A', dirs)).toBe(true)
  })

  it('should return false when doc path matches only enabled directories', () => {
    const dirs = [createDir('工作', true)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should use longest path first matching', () => {
    const dirs = [
      createDir('工作', true),
      createDir('工作/归档', false),
    ]
    expect(isExcludedByDisabledDirectories('工作/归档/项目A', dirs)).toBe(true)
    expect(isExcludedByDisabledDirectories('工作/进行中/项目A', dirs)).toBe(false)
  })

  it('should return false when doc path does not match any disabled directory', () => {
    const dirs = [createDir('归档', false)]
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })

  it('should handle multiple disabled directories', () => {
    const dirs = [
      createDir('归档', false),
      createDir('模板', false),
      createDir('工作', true),
    ]
    expect(isExcludedByDisabledDirectories('归档/2024/项目A', dirs)).toBe(true)
    expect(isExcludedByDisabledDirectories('模板/日报', dirs)).toBe(true)
    expect(isExcludedByDisabledDirectories('工作/项目A', dirs)).toBe(false)
  })
})
