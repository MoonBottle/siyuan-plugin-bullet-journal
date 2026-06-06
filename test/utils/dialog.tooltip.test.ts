// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('siyuan', async () => {
  return await import('../__mocks__/siyuan')
})

describe('tooltip helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('keeps only the latest tooltip content when hovering different triggers', async () => {
    const {
      WRAPPER_ID,
      showTooltip,
    } = await import('@/utils/tooltip')
    const first = document.createElement('button')
    const second = document.createElement('button')
    document.body.append(first, second)

    showTooltip(first, 'first')
    showTooltip(second, 'second')

    const wrapper = document.getElementById(WRAPPER_ID)
    expect(wrapper).not.toBeNull()
    const inner = wrapper?.firstElementChild as HTMLElement | null
    expect(inner?.getAttribute('aria-label')).toBe('second')
    expect(inner?.classList.contains('sy-tip-visible')).toBe(true)
  })

  it('hides the tooltip when the active trigger is removed from the document', async () => {
    const {
      WRAPPER_ID,
      showTooltip,
    } = await import('@/utils/tooltip')
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)

    showTooltip(trigger, 'remove-me')

    const wrapper = document.getElementById(WRAPPER_ID)
    const inner = wrapper?.firstElementChild as HTMLElement | null
    expect(inner?.classList.contains('sy-tip-visible')).toBe(true)

    trigger.remove()
    await Promise.resolve()

    expect(inner?.classList.contains('sy-tip-visible')).toBe(false)
  })

  it('can hide and show again cleanly across multiple interactions', async () => {
    const {
      WRAPPER_ID,
      hideTooltip,
      showTooltip,
    } = await import('@/utils/tooltip')
    const first = document.createElement('button')
    const second = document.createElement('button')
    document.body.append(first, second)

    showTooltip(first, 'alpha')
    hideTooltip()
    showTooltip(second, 'beta')

    const wrapper = document.getElementById(WRAPPER_ID)
    const inner = wrapper?.firstElementChild as HTMLElement | null
    expect(inner?.classList.contains('sy-tip-visible')).toBe(true)
    expect(inner?.getAttribute('aria-label')).toBe('beta')
  })
})
