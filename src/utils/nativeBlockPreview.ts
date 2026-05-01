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
  let currentProxyEl: HTMLElement | null = null;
  let cleanupHoverListeners: (() => void) | null = null;
  let findPanelTimer: ReturnType<typeof window.setTimeout> | null = null;
  let currentBlockId = '';
  let currentAnchorEl: HTMLElement | null = null;

  function detachHoverListeners() {
    cleanupHoverListeners?.();
    cleanupHoverListeners = null;
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

  function createProxyAnchor(anchorEl: HTMLElement, blockId: string) {
    const rect = anchorEl.getBoundingClientRect();
    const proxyEl = document.createElement('span');
    proxyEl.className = 'native-block-preview-proxy';
    proxyEl.setAttribute('data-type', 'block-ref');
    proxyEl.setAttribute('data-id', blockId);
    proxyEl.setAttribute('aria-hidden', 'true');
    proxyEl.setAttribute('style', [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${Math.max(rect.width, 1)}px`,
      `height:${Math.max(rect.height, 1)}px`,
      'opacity:0',
      'pointer-events:none',
      'z-index:-1',
    ].join(';'));
    document.body.appendChild(proxyEl);
    return proxyEl;
  }

  function dispatchProxyMouseOver(proxyEl: HTMLElement, anchorEl: HTMLElement) {
    const rect = anchorEl.getBoundingClientRect();
    proxyEl.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(rect.width / 2, 8),
      clientY: rect.top + Math.min(rect.height / 2, 8),
      view: window,
      relatedTarget: anchorEl,
    }));
  }

  function findPanelByTarget(targetElement: HTMLElement) {
    return ensureBlockPanelsRegistry().find(panel => panel?.targetElement === targetElement) ?? null;
  }

  function watchProxyPanel(proxyEl: HTMLElement, onHoverChange?: (hovered: boolean) => void) {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = () => {
      findPanelTimer = null;

      if (currentProxyEl !== proxyEl) {
        return;
      }

      const panel = findPanelByTarget(proxyEl);
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
      const proxyEl = createProxyAnchor(options.anchorEl, options.blockId);
      currentProxyEl = proxyEl;
      dispatchProxyMouseOver(proxyEl, options.anchorEl);
      watchProxyPanel(proxyEl, options.onHoverChange);
    }

    currentBlockId = options.blockId;
    currentAnchorEl = options.anchorEl;
    return currentPanel;
  }

  function close() {
    clearFindPanelTimer();
    detachHoverListeners();
    currentPanel?.destroy?.();
    currentProxyEl?.remove();
    currentPanel = null;
    currentProxyEl = null;
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
