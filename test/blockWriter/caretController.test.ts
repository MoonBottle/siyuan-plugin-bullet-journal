// @vitest-environment happy-dom
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  captureCaretSnapshot,
  focusByOffset,
  focusByWbr,
  injectWbrIntoEditable,
} from '@/utils/blockWriter/shared/caretController'

describe('caretController', () => {
  it('captures a wbr-first snapshot for the current editable selection', () => {
    const root = document.createElement('div')
    root.setAttribute('data-node-id', 'block-1')
    root.innerHTML = '<div contenteditable="true">任务 /jt</div>'
    const editable = root.querySelector('[contenteditable="true"]')!
    document.body.appendChild(root)

    const textNode = editable.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, textNode.textContent!.length)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const snapshot = captureCaretSnapshot(root as any)

    expect(snapshot.policy).toBe('wbr-first')
    expect((snapshot as any).containerBlockId).toBe('block-1')
  })

  it('restores selection from a rendered wbr marker', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div contenteditable="true">任务</div>'
    document.body.appendChild(root)

    const editable = root.querySelector('[contenteditable="true"]') as HTMLElement
    injectWbrIntoEditable(editable, 2)
    const restored = focusByWbr(root)

    expect(restored).toBe(true)
    expect(root.querySelector('wbr')).toBeNull()
  })

  it('restores selection before the newline when wbr is inserted at a multiline line end', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div contenteditable="true">第一行\n第二行</div>'
    document.body.appendChild(root)

    const editable = root.querySelector('[contenteditable="true"]') as HTMLElement
    injectWbrIntoEditable(editable, '第一行'.length)
    const restored = focusByWbr(root)

    expect(restored).toBe(true)
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBe(1)
    const range = selection!.getRangeAt(0)
    expect(range.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(range.startContainer.textContent).toBe('第一行')
    expect(range.startOffset).toBe('第一行'.length)
  })

  it('falls back to the end of editable text when the requested offset exceeds content length', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div contenteditable="true">任务</div>'
    document.body.appendChild(root)

    const restored = focusByOffset(root, {
      start: 999,
      end: 999,
    })

    expect(restored).toBe(true)
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBe(1)
    const range = selection!.getRangeAt(0)
    expect(range.startContainer.nodeType).toBe(Node.TEXT_NODE)
    expect(range.startContainer.textContent).toBe('任务')
    expect(range.startOffset).toBe('任务'.length)
  })

  it('collapses to editable start when editable has no text nodes', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div contenteditable="true"></div>'
    document.body.appendChild(root)

    const restored = focusByOffset(root)

    expect(restored).toBe(true)
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBe(1)
    const range = selection!.getRangeAt(0)
    expect(range.collapsed).toBe(true)
    const editable = root.querySelector('[contenteditable="true"]')!
    expect(range.startContainer).toBe(editable)
    expect(range.startOffset).toBe(0)
  })
})
