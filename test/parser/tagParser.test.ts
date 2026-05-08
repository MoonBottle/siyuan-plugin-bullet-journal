import { describe, expect, it } from 'vitest';
import {
  isReservedTag,
  parseTagsFromLine,
  stripTagsFromLine,
} from '@/parser/tagParser';

describe('tagParser', () => {
  it.each([
    'done',
    '已完成',
    'abandoned',
    '已放弃',
    'task',
    '任务',
    '#done',
    '#TASK',
  ])('recognizes reserved tag %s', (tag) => {
    expect(isReservedTag(tag)).toBe(true);
  });

  it('returns false for business tags', () => {
    expect(isReservedTag('重要')).toBe(false);
  });

  it('parses business tags, dedupes them, and skips reserved tags', () => {
    expect(
      parseTagsFromLine('整理资料 #重要 #重要 #done #任务 #frontend #已完成 #frontend'),
    ).toEqual(['重要', 'frontend']);
  });

  it('returns empty array when no business tags exist', () => {
    expect(parseTagsFromLine('整理资料 @2026-05-08 #done #任务')).toEqual([]);
  });

  it('parses punctuation-adjacent native tags without swallowing delimiters', () => {
    expect(parseTagsFromLine('整理资料 #前端，#认证。#done')).toEqual(['前端', '认证']);
  });

  it('parses punctuation-adjacent ascii tags and dedupes them', () => {
    expect(parseTagsFromLine('Ship #frontend,#auth,#frontend #task')).toEqual([
      'frontend',
      'auth',
    ]);
  });

  it('strips only business tags and preserves reserved tags', () => {
    expect(stripTagsFromLine('整理资料 #重要 #done #任务 #frontend')).toBe('整理资料 #done #任务');
  });

  it('strips business tags around punctuation delimiters and keeps punctuation intact', () => {
    expect(
      stripTagsFromLine('整理资料（#前端，#认证），复盘。#done'),
    ).toBe('整理资料（），复盘。#done');
  });

  it('strips business tags before closing parenthesis and sentence punctuation', () => {
    expect(stripTagsFromLine('发布(#frontend)#done。')).toBe('发布()#done。');
  });

  it('normalizes spacing after stripping business tags', () => {
    expect(stripTagsFromLine('  #重要   整理资料   #frontend  @2026-05-08  ')).toBe('整理资料 @2026-05-08');
  });
});
