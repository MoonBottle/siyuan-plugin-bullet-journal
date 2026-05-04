import type { FloatingPomodoroViewState } from '@/utils/floatingPomodoroViewState';

const FOCUS_ICON = `
  <svg viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M963.05566 345.393457c-34.433245-59.444739-83.5084-112.04244-142.458001-152.926613 3.805482-11.402299 2.23519-23.908046-4.272326-34.008842a39.5855 39.5855 0 0 0-29.198939-17.938108L617.888552 123.076923l-73.365164-105.421751c-7.398762-10.638373-19.55084-16.976127-32.509284-16.976127s-25.110522 6.337754-32.509283 16.976127L406.111363 123.076923 236.887668 140.505747A39.625111 39.625111 0 0 0 207.688729 158.443855a39.676039 39.676039 0 0 0-4.286473 34.008842C77.170603 279.724138 2.716138 415.179487 2.716138 560.311229c-0.04244 62.72679 13.849691 124.689655 40.671972 181.38992 25.916888 55.129973 62.924845 104.587091 110.005305 146.956676 46.769231 42.100796 101.177719 75.119363 161.683466 98.164456a559.214854 559.214854 0 0 0 393.846153 0c60.519894-23.030946 114.928382-56.06366 161.71176-98.164456 47.08046-42.369584 84.088417-91.826702 110.005305-146.956676A423.347834 423.347834 0 0 0 1021.283777 560.311229a429.629001 429.629001 0 0 0-58.228117-214.917772z m-530.786914-145.372237c11.473033-1.188329 21.856764-7.299735 28.44916-16.778072L511.999958 109.609195l51.239611 73.633953c6.592396 9.464191 16.976127 15.589744 28.44916 16.778072l80.580017 8.304156-47.278514 32.679045a39.601061 39.601061 0 0 0-15.971707 41.874447l14.458002 59.784262-97.655172-36.413793a39.633599 39.633599 0 0 0-27.671088 0l-97.655172 36.399646 14.458001-59.784262a39.601061 39.601061 0 0 0-15.971706-41.874447l-47.278515-32.679045 80.565871-8.290009zM817.570249 829.778957a434.642617 434.642617 0 0 1-136.94076 83.013262 480.025464 480.025464 0 0 1-337.457118 0 434.642617 434.642617 0 0 1-136.94076-83.013262C126.132584 757.545535 81.938065 661.842617 81.938065 560.311229c0-125.496021 68.923077-242.758621 184.615385-314.553492l65.018568 44.944297-25.563219 105.81786a39.619452 39.619452 0 0 0 52.34306 46.401415L511.999958 385.669319l153.676392 57.280283c13.72237 5.106985 29.142352 2.23519 40.106101-7.483643a39.58267 39.58267 0 0 0 12.222812-38.917772l-25.605659-105.81786 65.018568-44.93015c2.900088 1.79664 5.78603 3.621574 8.629531 5.488948 53.616269 35.083996 98.022989 81.343943 128.43855 133.842617 31.56145 54.507515 47.533156 113.471264 47.533156 175.221927 0.04244 101.488948-44.152078 197.191866-124.44916 269.425288z m0 0"/>
  </svg>
`;

const BREAK_ICON = `
  <svg viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M828.36 955.46h-738C75.8 955.46 64 943.66 64 929.1s11.8-26.36 26.36-26.36h738c14.56 0 26.36 11.8 26.36 26.36s-11.81 26.36-26.36 26.36zM512.17 876.39H406.53c-159.87 0-289.93-130.06-289.93-289.93V481.04c0-43.6 35.47-79.07 79.07-79.07h527.36c43.6 0 79.07 35.47 79.07 79.07v105.43c0 159.86-130.06 289.92-289.93 289.92z m-316.5-421.71c-14.53 0-26.36 11.82-26.36 26.36v105.43c0 130.8 106.42 237.21 237.21 237.21h105.65c130.79 0 237.21-106.41 237.21-237.21V481.04c0-14.54-11.83-26.36-26.36-26.36H195.67z"/><path d="M828.19 705.07h-65.65c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h65.65c43.62 0 79.1-35.47 79.1-79.07s-35.48-79.07-79.1-79.07h-52.47c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h52.47c72.68 0 131.81 59.12 131.81 131.79s-59.14 131.79-131.81 131.79z"/>
  </svg>
`;

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
  `.trim();
}

export function applyFloatingPomodoroViewState(
  host: HTMLElement,
  state: FloatingPomodoroViewState,
): void {
  const iconEl = host.querySelector<HTMLElement>('.floating-tomato-icon');
  const statusEl = host.querySelector<HTMLElement>('.floating-tomato-status');
  const primaryEl = host.querySelector<HTMLElement>('.floating-tomato-primary');
  const itemEl = host.querySelector<HTMLElement>('.floating-tomato-item');
  const secondaryEl = host.querySelector<HTMLElement>('.floating-tomato-secondary');
  const pauseEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--pause');
  const completeEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--complete');
  const skipEl = host.querySelector<HTMLButtonElement>('.floating-tomato-action--skip');
  const fillEl = host.querySelector<HTMLElement>('.floating-tomato-progress-fill');

  if (!iconEl || !statusEl || !primaryEl || !itemEl || !secondaryEl || !pauseEl || !completeEl || !skipEl || !fillEl) {
    return;
  }

  setClass(host, 'is-break', state.phase === 'break');
  setClass(host, 'is-paused', state.isPaused);
  setClass(host, 'has-item-title', Boolean(state.title));

  iconEl.innerHTML = state.phase === 'break' ? BREAK_ICON : FOCUS_ICON;
  statusEl.textContent = state.status;
  primaryEl.textContent = state.primaryText;
  itemEl.textContent = state.title;
  secondaryEl.textContent = state.secondaryText;

  if (state.phase === 'focus') {
    pauseEl.hidden = false;
    completeEl.hidden = false;
    skipEl.hidden = true;
    pauseEl.textContent = state.pauseResumeLabel;
    completeEl.textContent = state.endLabel;
    skipEl.textContent = '';
  } else {
    pauseEl.hidden = true;
    completeEl.hidden = true;
    skipEl.hidden = false;
    pauseEl.textContent = '';
    completeEl.textContent = '';
    skipEl.textContent = state.skipBreakLabel;
  }

  fillEl.style.transform = `scaleX(${clampProgress(state.progress)})`;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

function setClass(host: HTMLElement, className: string, enabled: boolean): void {
  if (enabled) {
    host.classList.add(className);
  } else {
    host.classList.remove(className);
  }
}
