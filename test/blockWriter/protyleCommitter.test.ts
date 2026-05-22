// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/protyleWriterDom', () => ({
  renderMarkdownIntoBlockEditable: vi.fn((_: unknown, targetElement: HTMLElement, markdown: string) => {
    targetElement.innerHTML = `<div contenteditable="true">${markdown.replace(/\n\{:[^}]*\}/g, '')}</div>`;
    return true;
  }),
}));

import { commitViaProtyle } from '@/utils/blockWriter/protyleCommitter';

describe('protyleCommitter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('restores caret after inserted suffix content', async () => {
    const targetElement = document.createElement('div');
    targetElement.setAttribute('data-node-id', 'block-1');
    targetElement.innerHTML = '<div contenteditable="true">任务 /rw</div>';
    document.body.appendChild(targetElement);

    const protyle = {
      transaction: vi.fn(),
    };

    const success = await commitViaProtyle(
      { protyle },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        nextMarkdown: '任务 📋\n{: id="block-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="block-1">任务 📋</div>',
        fallbackMarkdown: '任务 📋\n{: id="block-1"}',
        oldDomHtml: '<div data-node-id="block-1"><div contenteditable="true">任务 /rw</div></div>',
        targetElement,
        caretRestorePlan: {
          policy: 'wbr',
          placement: 'after-inserted-text',
          anchorText: '📋',
        },
      },
    );

    expect(success).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledTimes(1);
    expect(targetElement.textContent).toBe('任务 📋');

    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    const range = selection!.getRangeAt(0);
    const editable = targetElement.querySelector('[contenteditable="true"]') as HTMLElement;
    const logicalOffset = document.createRange();
    logicalOffset.selectNodeContents(editable);
    logicalOffset.setEnd(range.startContainer, range.startOffset);
    expect(range.collapsed).toBe(true);
    expect(range.startContainer.textContent).toBe('任务 📋');
    expect(logicalOffset.toString().length).toBe((editable.textContent ?? '').length);
  });

  it('restores caret to the current line end for multiline slash cleanup', async () => {
    const targetElement = document.createElement('div');
    targetElement.setAttribute('data-node-id', 'block-1');
    targetElement.innerHTML = '<div contenteditable="true">测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 /fq\n测试换行</div>';
    document.body.appendChild(targetElement);

    const protyle = {
      transaction: vi.fn(),
    };

    const success = await commitViaProtyle(
      { protyle },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        nextMarkdown: '测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 ❌\n测试换行\n{: id="block-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="block-1">测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 ❌\n测试换行</div>',
        fallbackMarkdown: '测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 ❌\n测试换行\n{: id="block-1"}',
        oldDomHtml: '<div data-node-id="block-1"><div contenteditable="true">测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 /fq\n测试换行</div></div>',
        targetElement,
        caretRestorePlan: {
          policy: 'wbr',
          placement: 'line-end',
          lineIndex: 0,
        },
      },
    );

    expect(success).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledTimes(1);
    expect(targetElement.textContent).toBe('测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 ❌\n测试换行');

    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    const range = selection!.getRangeAt(0);
    const editable = targetElement.querySelector('[contenteditable="true"]') as HTMLElement;
    const logicalOffset = document.createRange();
    logicalOffset.selectNodeContents(editable);
    logicalOffset.setEnd(range.startContainer, range.startOffset);
    expect(range.collapsed).toBe(true);
    expect(logicalOffset.toString()).toBe('测试任务列表事项236 测试 ⏳1h51m 📅2026-05-17 ❌');
  });

  it('restores caret on the live task-list node after transaction replaces the list item', async () => {
    const targetElement = document.createElement('div');
    targetElement.classList.add('li');
    targetElement.setAttribute('data-node-id', 'task-1');
    targetElement.setAttribute('data-type', 'NodeListItem');
    targetElement.setAttribute('data-subtype', 't');
    targetElement.innerHTML = '<span class="protyle-action--task"></span><div contenteditable="true">测试任务列表事项235 📅2026-05-13 测试 /fq\n测试换行</div>';
    document.body.appendChild(targetElement);

    const protyle = {
      transaction: vi.fn((doOperations: Array<{ data: string }>) => {
        const template = document.createElement('template');
        template.innerHTML = doOperations[0].data;
        const replacement = template.content.firstElementChild as HTMLElement;
        targetElement.replaceWith(replacement);
        targetElement.innerHTML = '';
      }),
    };

    const success = await commitViaProtyle(
      { protyle },
      {
        kind: 'update',
        targetBlockId: 'task-1',
        nextMarkdown: '测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行\n{: id="task-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="task-1">测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行</div>',
        fallbackMarkdown: '测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行\n{: id="task-1"}',
        oldDomHtml: '<div data-node-id="task-1"><div contenteditable="true">测试任务列表事项235 📅2026-05-13 测试 /fq\n测试换行</div></div>',
        targetElement,
        caretRestorePlan: {
          policy: 'wbr',
          placement: 'line-end',
          lineIndex: 0,
        },
      },
    );

    expect(success).toBe(true);
    const liveTarget = document.querySelector('[data-node-id="task-1"]') as HTMLElement;
    expect(liveTarget).not.toBe(targetElement);

    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    const range = selection!.getRangeAt(0);
    const editable = liveTarget.querySelector('[contenteditable="true"]') as HTMLElement;
    const logicalOffset = document.createRange();
    logicalOffset.selectNodeContents(editable);
    logicalOffset.setEnd(range.startContainer, range.startOffset);
    expect(range.collapsed).toBe(true);
    expect(logicalOffset.toString()).toBe('测试任务列表事项235 📅2026-05-13 测试 ❌');
  });

  it('prefers the connected target element when duplicate block ids exist elsewhere in the document', async () => {
    const staleDuplicate = document.createElement('div');
    staleDuplicate.setAttribute('data-node-id', 'task-1');
    staleDuplicate.textContent = '旧节点 /fq';
    document.body.appendChild(staleDuplicate);

    const targetElement = document.createElement('div');
    targetElement.classList.add('li');
    targetElement.setAttribute('data-node-id', 'task-1');
    targetElement.setAttribute('data-type', 'NodeListItem');
    targetElement.setAttribute('data-subtype', 't');
    targetElement.innerHTML = '<span class="protyle-action--task"></span><div contenteditable="true">测试任务列表事项235 📅2026-05-13 测试 /fq\n测试换行</div>';
    document.body.appendChild(targetElement);

    const protyle = {
      transaction: vi.fn(),
      wysiwyg: {
        element: document.body,
      },
    };

    const success = await commitViaProtyle(
      { protyle },
      {
        kind: 'update',
        targetBlockId: 'task-1',
        nextMarkdown: '测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行\n{: id="task-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="task-1">测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行</div>',
        fallbackMarkdown: '测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行\n{: id="task-1"}',
        oldDomHtml: '<div data-node-id="task-1"><div contenteditable="true">测试任务列表事项235 📅2026-05-13 测试 /fq\n测试换行</div></div>',
        targetElement,
        caretRestorePlan: {
          policy: 'wbr',
          placement: 'line-end',
          lineIndex: 0,
        },
      },
    );

    expect(success).toBe(true);
    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    const range = selection!.getRangeAt(0);
    const editable = targetElement.querySelector('[contenteditable="true"]') as HTMLElement;
    const logicalOffset = document.createRange();
    logicalOffset.selectNodeContents(editable);
    logicalOffset.setEnd(range.startContainer, range.startOffset);
    expect(range.collapsed).toBe(true);
    expect(range.startContainer.textContent).toBe('测试任务列表事项235 📅2026-05-13 测试 ❌\n测试换行');
    expect(logicalOffset.toString()).toBe('测试任务列表事项235 📅2026-05-13 测试 ❌');
  });
});
