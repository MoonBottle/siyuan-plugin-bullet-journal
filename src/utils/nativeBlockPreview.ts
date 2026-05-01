import * as SiyuanApi from 'siyuan';
import type { App } from 'siyuan';

type NativeBlockPanelInstance = {
  id?: string;
  element?: HTMLElement;
  targetElement?: HTMLElement;
  destroy?: () => void;
};

type OpenNativeBlockPreviewOptions = {
  app: App;
  blockId: string;
  anchorEl: HTMLElement;
  onHoverChange?: (hovered: boolean) => void;
};

type NativeBlockPanelCtor = new (options: Record<string, unknown>) => NativeBlockPanelInstance;

function ensureBlockPanelsRegistry(): NativeBlockPanelInstance[] {
  if (!window.siyuan.blockPanels) {
    window.siyuan.blockPanels = [];
  }
  return window.siyuan.blockPanels as NativeBlockPanelInstance[];
}

function resolveBlockPanelCtor(): NativeBlockPanelCtor | null {
  const moduleRecord = SiyuanApi as Record<string, unknown>;
  const candidates: unknown[] = [moduleRecord.BlockPanel];

  try {
    const defaultExport = moduleRecord.default as Record<string, unknown> | undefined;
    candidates.push(defaultExport?.BlockPanel);
  }
  catch {
    // Ignore module wrappers that throw when `default` is accessed.
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate as NativeBlockPanelCtor;
    }
  }

  return null;
}

function instantiateBlockPanel(panelCtor: NativeBlockPanelCtor, options: OpenNativeBlockPreviewOptions): NativeBlockPanelInstance {

  try {
    return new panelCtor({
      app: options.app,
      targetElement: options.anchorEl,
      nodeIds: [options.blockId],
      defIds: [],
      isBacklink: false,
    });
  }
  catch {
    return new panelCtor({
      app: options.app,
      targetElement: options.anchorEl,
      refDefs: [{ refID: options.blockId }],
      isBacklink: false,
    });
  }
}

export function createNativeBlockPreviewController() {
  let currentPanel: NativeBlockPanelInstance | null = null;
  let restoreAnchorAttrs: (() => void) | null = null;
  let cleanupHoverListeners: (() => void) | null = null;
  let findPanelTimer: ReturnType<typeof window.setTimeout> | null = null;
  let currentBlockId = '';
  let currentAnchorEl: HTMLElement | null = null;

  function detachHoverListeners() {
    cleanupHoverListeners?.();
    cleanupHoverListeners = null;
  }

  function clearAnchorDecoration() {
    restoreAnchorAttrs?.();
    restoreAnchorAttrs = null;
  }

  function clearFindPanelTimer() {
    if (findPanelTimer !== null) {
      window.clearTimeout(findPanelTimer);
      findPanelTimer = null;
    }
  }

  function attachHoverListeners(panel: NativeBlockPanelInstance, onHoverChange?: (hovered: boolean) => void) {
    const element = panel.element;
    if (!element || !onHoverChange) {
      return;
    }

    const handleEnter = () => onHoverChange(true);
    const handleLeave = () => onHoverChange(false);

    element.addEventListener('mouseenter', handleEnter);
    element.addEventListener('mouseleave', handleLeave);

    cleanupHoverListeners = () => {
      element.removeEventListener('mouseenter', handleEnter);
      element.removeEventListener('mouseleave', handleLeave);
    };
  }

  function releaseCurrentPanel(panel: NativeBlockPanelInstance) {
    if (currentPanel === panel) {
      detachHoverListeners();
      currentPanel = null;
    }
  }

  function makeDestroyIdempotent(panel: NativeBlockPanelInstance) {
    const originalDestroy = panel.destroy?.bind(panel);
    if (!originalDestroy) {
      return;
    }

    let destroyed = false;
    panel.destroy = () => {
      if (destroyed) {
        releaseCurrentPanel(panel);
        return;
      }

      destroyed = true;
      try {
        originalDestroy();
      }
      finally {
        releaseCurrentPanel(panel);
      }
    };
  }

  function registerPanel(panel: NativeBlockPanelInstance) {
    const panels = ensureBlockPanelsRegistry();
    if (!panels.includes(panel)) {
      panels.push(panel);
    }
  }

  function decorateAnchorAsBlockRef(anchorEl: HTMLElement, blockId: string) {
    const previousDataType = anchorEl.getAttribute('data-type');
    const previousDataId = anchorEl.getAttribute('data-id');
    const previousAriaLabel = anchorEl.getAttribute('aria-label');
    const hadPreventPopover = anchorEl.hasAttribute('prevent-popover');

    anchorEl.setAttribute('data-type', 'block-ref');
    anchorEl.setAttribute('data-id', blockId);
    anchorEl.setAttribute('aria-label', previousAriaLabel || 'block-ref');
    anchorEl.removeAttribute('prevent-popover');

    restoreAnchorAttrs = () => {
      if (previousDataType === null) {
        anchorEl.removeAttribute('data-type');
      }
      else {
        anchorEl.setAttribute('data-type', previousDataType);
      }

      if (previousDataId === null) {
        anchorEl.removeAttribute('data-id');
      }
      else {
        anchorEl.setAttribute('data-id', previousDataId);
      }

      if (previousAriaLabel === null) {
        anchorEl.removeAttribute('aria-label');
      }
      else {
        anchorEl.setAttribute('aria-label', previousAriaLabel);
      }

      if (hadPreventPopover) {
        anchorEl.setAttribute('prevent-popover', 'true');
      }
      else {
        anchorEl.removeAttribute('prevent-popover');
      }
    };
  }

  function dispatchAnchorMouseOver(anchorEl: HTMLElement) {
    const rect = anchorEl.getBoundingClientRect();
    anchorEl.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(rect.width / 2, 8),
      clientY: rect.top + Math.min(rect.height / 2, 8),
      view: window,
    }));
  }

  function findPanelByTarget(targetElement: HTMLElement) {
    return ensureBlockPanelsRegistry().find(panel => panel?.targetElement === targetElement) ?? null;
  }

  function watchAnchorPanel(anchorEl: HTMLElement, onHoverChange?: (hovered: boolean) => void) {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = () => {
      findPanelTimer = null;

      if (currentAnchorEl !== anchorEl) {
        return;
      }

      const panel = findPanelByTarget(anchorEl);
      if (panel?.element) {
        makeDestroyIdempotent(panel);
        currentPanel = panel;
        attachHoverListeners(panel, onHoverChange);
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        return;
      }

      findPanelTimer = window.setTimeout(poll, 50);
    };

    poll();
  }

  function open(options: OpenNativeBlockPreviewOptions) {
    if (
      currentPanel
      && currentBlockId === options.blockId
      && currentAnchorEl === options.anchorEl
    ) {
      return currentPanel;
    }

    close();

    const panelCtor = resolveBlockPanelCtor();
    if (panelCtor) {
      const panel = instantiateBlockPanel(panelCtor, options);
      makeDestroyIdempotent(panel);
      registerPanel(panel);
      attachHoverListeners(panel, options.onHoverChange);
      currentPanel = panel;
    }
    else {
      decorateAnchorAsBlockRef(options.anchorEl, options.blockId);
      dispatchAnchorMouseOver(options.anchorEl);
      watchAnchorPanel(options.anchorEl, options.onHoverChange);
    }

    currentBlockId = options.blockId;
    currentAnchorEl = options.anchorEl;
    return currentPanel;
  }

  function close() {
    clearFindPanelTimer();
    detachHoverListeners();
    currentPanel?.destroy?.();
    clearAnchorDecoration();
    currentPanel = null;
    currentBlockId = '';
    currentAnchorEl = null;
  }

  function isOpen() {
    return !!currentPanel;
  }

  return {
    open,
    close,
    isOpen,
  };
}
