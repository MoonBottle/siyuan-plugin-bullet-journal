/**
 * 统一 Tooltip 工具
 * 在 body 上创建包装容器（position: fixed，逃逸 overflow 裁剪）
 * 容器内部包裹 .b3-tooltips 元素，::after 渲染 tooltip 内容
 * 方向类（__n/__s 等）相对于内部 .b3-tooltips 元素定位
 *
 * DOM 结构：
 * <div id="sy-tooltip-wrapper" style="position: fixed; left/top/width/height 匹配触发元素">
 *   <span class="b3-tooltips b3-tooltips__n sy-fixed-tooltip sy-tip-visible" aria-label="text"></span>
 * </div>
 */

export type TooltipDirection = 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'e' | 'w'

export interface TooltipOptions {
  /** tooltip 方向，默认 'n' */
  direction?: TooltipDirection
  /** 是否允许文本换行，默认 false（图标按钮 nowrap），链接传 true */
  wrap?: boolean
}

export const WRAPPER_ID = 'sy-tooltip-wrapper'
const INNER_TAG = 'span'

let activeTrigger: HTMLElement | null = null
let cleanupFn: (() => void) | null = null
let observer: MutationObserver | null = null

function clearTracking(): void {
  cleanupFn?.()
  cleanupFn = null
  observer?.disconnect()
  observer = null
  activeTrigger = null
}

function watchTrigger(trigger: HTMLElement): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const hide = () => {
    hideTooltip()
  }
  const hideWhenHidden = () => {
    if (document.hidden) hideTooltip()
  }

  document.addEventListener('pointerdown', hide, true)
  window.addEventListener('blur', hide)
  window.addEventListener('resize', hide)
  window.addEventListener('scroll', hide, true)
  document.addEventListener('visibilitychange', hideWhenHidden)

  cleanupFn = () => {
    document.removeEventListener('pointerdown', hide, true)
    window.removeEventListener('blur', hide)
    window.removeEventListener('resize', hide)
    window.removeEventListener('scroll', hide, true)
    document.removeEventListener('visibilitychange', hideWhenHidden)
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      if (activeTrigger !== trigger) return
      if (!trigger.isConnected) hideTooltip()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

/** 获取或创建包装容器和内部元素 */
function getOrCreateWrapper(): { wrapper: HTMLDivElement, inner: HTMLElement } {
  let wrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null
  let inner: HTMLElement | null

  if (!wrapper) {
    wrapper = document.createElement('div')
    wrapper.id = WRAPPER_ID
    inner = document.createElement(INNER_TAG)
    wrapper.appendChild(inner)
    document.body.appendChild(wrapper)
  }
  else {
    inner = wrapper.firstElementChild as HTMLElement
    if (!inner || inner.tagName.toLowerCase() !== INNER_TAG) {
      inner = document.createElement(INNER_TAG)
      wrapper.innerHTML = ''
      wrapper.appendChild(inner)
    }
  }

  return {
    wrapper,
    inner,
  }
}

/** 测量 ::after 伪元素的尺寸 */
function measureAfterSize(inner: HTMLElement): DOMRect | null {
  const text = inner.getAttribute('aria-label') ?? ''
  if (!text) return null

  const computedStyle = getComputedStyle(inner, '::after')

  const measureEl = document.createElement('div')
  measureEl.style.cssText = `
    position: fixed; visibility: hidden; pointer-events: none;
    font-size: ${computedStyle.fontSize}; padding: ${computedStyle.padding};
    max-width: ${computedStyle.maxWidth};
    white-space: ${computedStyle.whiteSpace}; word-wrap: ${computedStyle.wordWrap};
    box-sizing: border-box; line-height: ${computedStyle.lineHeight};
    font-family: ${computedStyle.fontFamily};
  `
  measureEl.textContent = text
  document.body.appendChild(measureEl)
  const rect = measureEl.getBoundingClientRect()
  document.body.removeChild(measureEl)
  return rect
}

/** 显示 tooltip */
export function showTooltip(el: HTMLElement, text: string, options?: TooltipOptions): void {
  if (!text || typeof document === 'undefined') return
  hideTooltip()

  const direction = options?.direction ?? 'n'
  const wrap = options?.wrap ?? false

  const {
    wrapper,
    inner,
  } = getOrCreateWrapper()

  // 设置内部 .b3-tooltips 元素的 aria-label 和类
  inner.setAttribute('aria-label', text)
  inner.className = `b3-tooltips b3-tooltips__${direction} sy-fixed-tooltip`
  if (wrap) inner.classList.add('sy-fixed-tooltip--wrap')

  // 定位包装容器到触发元素位置，宽高匹配
  const rect = el.getBoundingClientRect()
  wrapper.style.left = `${rect.left}px`
  wrapper.style.top = `${rect.top}px`
  wrapper.style.width = `${rect.width}px`
  wrapper.style.height = `${rect.height}px`

  // 显示
  inner.classList.add('sy-tip-visible')

  // 视口边界检测：测量 ::after 是否溢出，修正容器位置
  requestAnimationFrame(() => {
    if (activeTrigger !== el) return
    const afterRect = measureAfterSize(inner)
    if (!afterRect) return
    const viewMargin = 8

    let offsetX = 0
    let offsetY = 0

    if (afterRect.right > window.innerWidth - viewMargin) {
      offsetX = window.innerWidth - viewMargin - afterRect.right
    }
    if (afterRect.left + offsetX < viewMargin) {
      offsetX = viewMargin - afterRect.left
    }
    if (afterRect.top + offsetY < viewMargin) {
      offsetY = viewMargin - afterRect.top
    }
    if (afterRect.bottom + offsetY > window.innerHeight - viewMargin) {
      offsetY = window.innerHeight - viewMargin - afterRect.bottom
    }

    if (offsetX !== 0 || offsetY !== 0) {
      wrapper.style.left = `${rect.left + offsetX}px`
      wrapper.style.top = `${rect.top + offsetY}px`
    }
  })

  // 事件追踪
  activeTrigger = el
  watchTrigger(el)
}

/** 隐藏 tooltip */
export function hideTooltip(): void {
  clearTracking()
  if (typeof document === 'undefined') return

  const wrapper = document.getElementById(WRAPPER_ID) as HTMLDivElement | null
  if (!wrapper) return

  const inner = wrapper.firstElementChild as HTMLElement | null
  if (inner) {
    inner.className = ''
    inner.removeAttribute('aria-label')
  }

  // 重置定位
  wrapper.style.left = ''
  wrapper.style.top = ''
  wrapper.style.width = ''
  wrapper.style.height = ''
}
