// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  captureCaretSnapshot,
  focusByWbr,
  injectWbrIntoEditable,
} from '@/utils/blockWriter/caretController';

describe('caretController', () => {
  it('captures a wbr-first snapshot for the current editable selection', () => {
    const root = document.createElement('div');
    root.setAttribute('data-node-id', 'block-1');
    root.innerHTML = '<div contenteditable="true">任务 /jt</div>';
    const editable = root.querySelector('[contenteditable="true"]')!;
    document.body.appendChild(root);

    const textNode = editable.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const snapshot = captureCaretSnapshot(root as any);

    expect(snapshot.policy).toBe('wbr-first');
    expect(snapshot.containerBlockId).toBe('block-1');
  });

  it('restores selection from a rendered wbr marker', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div contenteditable="true">任务</div>';
    document.body.appendChild(root);

    const editable = root.querySelector('[contenteditable="true"]') as HTMLElement;
    injectWbrIntoEditable(editable, 2);
    const restored = focusByWbr(root);

    expect(restored).toBe(true);
    expect(root.querySelector('wbr')).toBeNull();
  });
});
