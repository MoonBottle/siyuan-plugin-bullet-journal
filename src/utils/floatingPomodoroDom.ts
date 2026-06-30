import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState'

const FOCUS_ICON = `
  <svg viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor" aria-hidden="true"><use xlink:href="#iconTaTomato" /></svg>
`

const BREAK_ICON = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use xlink:href="#iconTaCoffee" /></svg>
`

const PLAY_ICON = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use xlink:href="#iconTaPlay" /></svg>
`

const PAUSE_ICON = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use xlink:href="#iconTaPause" /></svg>
`

const COMPLETE_ICON = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use xlink:href="#iconTaCheck" /></svg>
`

const SKIP_ICON = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use xlink:href="#iconTaSkipBreak" /></svg>
`

export function createFloatingPomodoroMarkup(): string {
  return `
    <div class="floating-tomato-shell">
      <div class="floating-tomato-main">
        <div class="floating-tomato-icon">${FOCUS_ICON}</div>
        <div class="floating-tomato-summary">
          <div class="floating-tomato-topline">
            <span class="floating-tomato-status"></span>
            <span class="floating-tomato-primary"></span>
          </div>
          <div class="floating-tomato-item"></div>
          <div class="floating-tomato-secondary"></div>
        </div>
        <div class="floating-tomato-actions">
          <button type="button" class="floating-tomato-action floating-tomato-action--pause" data-action="pause"></button>
          <button type="button" class="floating-tomato-action floating-tomato-action--complete" data-action="complete"></button>
          <button type="button" class="floating-tomato-action floating-tomato-action--skip" data-action="skip"></button>
        </div>
      </div>
      <div class="floating-tomato-progress">
        <div class="floating-tomato-progress-fill"></div>
      </div>
    </div>
  `.trim()
}

export function applyFloatingPomodoroViewState(
  host: HTMLElement,
  state: FloatingPomodoroViewState,
): void {
  const iconEl = host.querySelector<HTMLElement>('.floating-tomato-icon')
  const statusEl = host.querySelector<HTMLElement>('.floating-tomato-status')
  const primaryEl = host.querySelector<HTMLElement>('.floating-tomato-primary')
  const itemEl = host.querySelector<HTMLElement>('.floating-tomato-item')
  const secondaryEl = host.querySelector<HTMLElement>('.floating-tomato-secondary')
  const pauseEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause')
  const completeEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete')
  const skipEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip')
  const fillEl = host.querySelector<HTMLElement>('.floating-tomato-progress-fill')

  if (!iconEl || !statusEl || !primaryEl || !itemEl || !secondaryEl || !pauseEl || !completeEl || !skipEl || !fillEl) {
    return
  }

  setClass(host, 'is-break', state.phase === 'break')
  setClass(host, 'is-paused', state.isPaused)
  setClass(host, 'has-item-title', Boolean(state.title))

  iconEl.innerHTML = state.phase === 'break' ? BREAK_ICON : FOCUS_ICON
  statusEl.textContent = state.status
  primaryEl.textContent = state.primaryText
  itemEl.textContent = state.title
  secondaryEl.textContent = state.secondaryText

  if (state.phase === 'focus') {
    pauseEl.hidden = false
    completeEl.hidden = false
    skipEl.hidden = true
    setActionButton(
      pauseEl,
      state.pauseResumeLabel,
      state.isPaused ? PLAY_ICON : PAUSE_ICON,
    )
    setActionButton(completeEl, state.endLabel, COMPLETE_ICON)
    setActionButton(skipEl, '', '')
  } else {
    pauseEl.hidden = true
    completeEl.hidden = true
    skipEl.hidden = false
    setActionButton(pauseEl, '', '')
    setActionButton(completeEl, '', '')
    setActionButton(skipEl, state.skipBreakLabel, SKIP_ICON)
  }

  fillEl.style.transform = `scaleX(${clampProgress(state.progress)})`
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }

  return Math.min(1, Math.max(0, progress))
}

function setClass(host: HTMLElement, className: string, enabled: boolean): void {
  if (enabled) {
    host.classList.add(className)
  } else {
    host.classList.remove(className)
  }
}

function setActionButton(
  button: HTMLButtonElement,
  label: string,
  iconMarkup: string,
): void {
  button.innerHTML = iconMarkup
  button.setAttribute('aria-label', label)
  if (label) {
    button.dataset.tooltip = label
  } else {
    delete button.dataset.tooltip
  }
}
