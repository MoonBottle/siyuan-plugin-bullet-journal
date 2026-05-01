import * as SiyuanApi from 'siyuan';
import type { App } from 'siyuan';

type NativeBlockPreviewPlugin = {
  addFloatLayer?: (options: {
    refDefs: Array<{ refID: string }>;
    targetElement?: HTMLElement;
    isBacklink: boolean;
  }) => void;
};

type NativeBlockPanelInstance = {
  id?: string;
  element?: HTMLElement;
  targetElement?: HTMLElement;
  destroy?: () => void;
};

type OpenNativeBlockPreviewOptions = {
  app: App;
  plugin?: NativeBlockPreviewPlugin | null;
  blockId: string;
  anchorEl: HTMLElement;
  onHoverChange?: (hovered: boolean) => void;
  onPanelDestroyed?: (payload: {
    initiatedByController: boolean;
    blockId: string;
    anchorEl: HTMLElement;
  }) => void;
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
  let restoreSuppressedDescendantTooltips: (() => void) | null = null;
  let cleanupHoverListeners: (() => void) | null = null;
  let restorePinnedState: (() => void) | null = null;
  let findPanelTimer: ReturnType<typeof window.setTimeout> | null = null;
  let currentBlockId = '';
  let currentAnchorEl: HTMLElement | null = null;
  let controllerClosing = false;

  function detachHoverListeners() {
    cleanupHoverListeners?.();
    cleanupHoverListeners = null;
  }

  function clearAnchorDecoration() {
    restoreAnchorAttrs?.();
    restoreAnchorAttrs = null;
  }

  function clearSuppressedDescendantTooltips() {
    restoreSuppressedDescendantTooltips?.();
    restoreSuppressedDescendantTooltips = null;
  }

  function clearPinnedState() {
    restorePinnedState?.();
    restorePinnedState = null;
  }

  function clearFindPanelTimer() {
    if (findPanelTimer !== null) {
      window.clearTimeout(findPanelTimer);
      findPanelTimer = null;
    }
  }

  function pinPanelForController(panel: NativeBlockPanelInstance) {
    const element = panel.element;
    if (!element) {
      return;
    }

    const previousPin = element.getAttribute('data-pin');
    element.setAttribute('data-pin', 'true');

    restorePinnedState = () => {
      if (!panel.element) {
        return;
      }
      if (previousPin === null) {
        panel.element.removeAttribute('data-pin');
      }
      else {
        panel.element.setAttribute('data-pin', previousPin);
      }
    };
  }

  function attachHoverListeners(panel: NativeBlockPanelInstance, onHoverChange?: (hovered: boolean) => void) {
    const element = panel.element;
    if (!element || !onHoverChange) {
      return;
    }

    let lastHovered = false;

    const isPointerWithinPanel = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && element.contains(target)) {
        return true;
      }

      const rect = element.getBoundingClientRect();
      return (
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom
      );
    };

    const updateHovered = (hovered: boolean) => {
      if (lastHovered === hovered) {
        return;
      }
      lastHovered = hovered;
      onHoverChange(hovered);
    };

    const handlePointerMove = (event: MouseEvent) => {
      updateHovered(isPointerWithinPanel(event));
    };

    const handleWindowBlur = () => {
      updateHovered(false);
    };

    document.addEventListener('mousemove', handlePointerMove, true);
    window.addEventListener('blur', handleWindowBlur);

    cleanupHoverListeners = () => {
      document.removeEventListener('mousemove', handlePointerMove, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }

  function releaseCurrentPanel(panel: NativeBlockPanelInstance) {
    if (currentPanel === panel) {
      detachHoverListeners();
      clearPinnedState();
      currentPanel = null;
    }
  }

  function makeDestroyIdempotent(
    panel: NativeBlockPanelInstance,
    options: Pick<OpenNativeBlockPreviewOptions, 'blockId' | 'anchorEl' | 'onPanelDestroyed'>,
  ) {
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
        options.onPanelDestroyed?.({
          initiatedByController: controllerClosing,
          blockId: options.blockId,
          anchorEl: options.anchorEl,
        });
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

  function suppressDescendantTooltips(anchorEl: HTMLElement) {
    const tooltipElements = Array.from(anchorEl.querySelectorAll('.b3-tooltips'));
    const restores = tooltipElements.map((element) => {
      const tooltipEl = element as HTMLElement;
      const previousAriaLabel = tooltipEl.getAttribute('aria-label');

      tooltipEl.classList.remove('b3-tooltips');
      tooltipEl.removeAttribute('aria-label');

      return () => {
        tooltipEl.classList.add('b3-tooltips');
        if (previousAriaLabel === null) {
          tooltipEl.removeAttribute('aria-label');
        }
        else {
          tooltipEl.setAttribute('aria-label', previousAriaLabel);
        }
      };
    });

    restoreSuppressedDescendantTooltips = () => {
      restores.forEach(restore => restore());
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

  function watchAnchorPanel(
    anchorEl: HTMLElement,
    blockId: string,
    onHoverChange?: (hovered: boolean) => void,
    onPanelDestroyed?: OpenNativeBlockPreviewOptions['onPanelDestroyed'],
  ) {
    let attempts = 0;
    const maxAttempts = 20;

    const poll = () => {
      findPanelTimer = null;

      if (currentAnchorEl !== anchorEl) {
        return;
      }

      const panel = findPanelByTarget(anchorEl);
      if (panel?.element) {
        makeDestroyIdempotent(panel, {
          blockId,
          anchorEl,
          onPanelDestroyed,
        });
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

  function openViaPluginFloatLayer(options: OpenNativeBlockPreviewOptions) {
    if (typeof options.plugin?.addFloatLayer !== 'function') {
      return false;
    }

    const panelsBefore = new Set(ensureBlockPanelsRegistry());

    options.plugin.addFloatLayer({
      refDefs: [{ refID: options.blockId }],
      targetElement: options.anchorEl,
      isBacklink: false,
    });

    const panelsAfter = ensureBlockPanelsRegistry();
    const newPanel = panelsAfter.find(panel => !panelsBefore.has(panel))
      ?? findPanelByTarget(options.anchorEl);

    if (newPanel) {
      makeDestroyIdempotent(newPanel, options);
      pinPanelForController(newPanel);
      attachHoverListeners(newPanel, options.onHoverChange);
      currentPanel = newPanel;
    }
    else {
      watchAnchorPanel(options.anchorEl, options.blockId, options.onHoverChange, options.onPanelDestroyed);
    }

    return true;
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

    currentBlockId = options.blockId;
    currentAnchorEl = options.anchorEl;

    if (openViaPluginFloatLayer(options)) {
      return currentPanel;
    }

    const panelCtor = resolveBlockPanelCtor();
    if (panelCtor) {
      const panel = instantiateBlockPanel(panelCtor, options);
      makeDestroyIdempotent(panel, options);
      registerPanel(panel);
      pinPanelForController(panel);
      attachHoverListeners(panel, options.onHoverChange);
      currentPanel = panel;
    }
    else {
      decorateAnchorAsBlockRef(options.anchorEl, options.blockId);
      suppressDescendantTooltips(options.anchorEl);
      dispatchAnchorMouseOver(options.anchorEl);
      watchAnchorPanel(options.anchorEl, options.blockId, options.onHoverChange, options.onPanelDestroyed);
    }

    return currentPanel;
  }

  function close() {
    controllerClosing = true;
    try {
      clearFindPanelTimer();
      detachHoverListeners();
      currentPanel?.destroy?.();
      clearPinnedState();
      clearSuppressedDescendantTooltips();
      clearAnchorDecoration();
      currentPanel = null;
      currentBlockId = '';
      currentAnchorEl = null;
    }
    finally {
      controllerClosing = false;
    }
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
