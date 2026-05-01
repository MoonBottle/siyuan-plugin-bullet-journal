import { computed, ref } from 'vue';

export type BlockFocusPreviewTrigger = {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
};

type UseBlockFocusPreviewOptions = {
  showDelayMs: number;
  hideDelayMs: number;
};

export function useBlockFocusPreview(options: UseBlockFocusPreviewOptions) {
  const activeBlockId = ref('');
  const activeItemId = ref('');
  const anchorEl = ref<HTMLElement | null>(null);
  const triggerHovered = ref(false);
  const popoverHovered = ref(false);
  const dragActive = ref(false);
  const isLoading = ref(false);
  const errorMessage = ref('');

  let showTimer: ReturnType<typeof window.setTimeout> | null = null;
  let hideTimer: ReturnType<typeof window.setTimeout> | null = null;

  const isOpen = computed(() => !!activeBlockId.value);

  function clearShowTimer() {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function clearHideTimer() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function clearActivePreview() {
    activeBlockId.value = '';
    activeItemId.value = '';
    anchorEl.value = null;
    isLoading.value = false;
  }

  function canOpen(payload: BlockFocusPreviewTrigger) {
    return !!payload.blockId && !!payload.anchorEl && !dragActive.value;
  }

  function showNow(payload: BlockFocusPreviewTrigger) {
    clearShowTimer();
    clearHideTimer();

    if (!canOpen(payload)) {
      return;
    }

    triggerHovered.value = true;
    errorMessage.value = '';
    isLoading.value = true;
    activeBlockId.value = payload.blockId;
    activeItemId.value = payload.itemId;
    anchorEl.value = payload.anchorEl;
  }

  function scheduleShow(payload: BlockFocusPreviewTrigger) {
    triggerHovered.value = true;
    clearHideTimer();
    clearShowTimer();

    if (!canOpen(payload)) {
      return;
    }

    if (options.showDelayMs <= 0) {
      showNow(payload);
      return;
    }

    showTimer = window.setTimeout(() => {
      showTimer = null;
      if (!triggerHovered.value || dragActive.value) {
        return;
      }
      showNow(payload);
    }, options.showDelayMs);
  }

  function scheduleHide() {
    triggerHovered.value = false;
    clearShowTimer();
    clearHideTimer();

    if (!isOpen.value) {
      return;
    }

    const hide = () => {
      hideTimer = null;
      if (triggerHovered.value || popoverHovered.value) {
        return;
      }
      clearActivePreview();
    };

    if (options.hideDelayMs <= 0) {
      hide();
      return;
    }

    hideTimer = window.setTimeout(hide, options.hideDelayMs);
  }

  function markPopoverHovered(hovered: boolean) {
    popoverHovered.value = hovered;
    if (hovered) {
      clearHideTimer();
      return;
    }
    if (!triggerHovered.value) {
      scheduleHide();
    }
  }

  function setDragActive(active: boolean) {
    dragActive.value = active;
    if (active) {
      clearShowTimer();
      clearHideTimer();
      triggerHovered.value = false;
      popoverHovered.value = false;
      clearActivePreview();
    }
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(message: string) {
    errorMessage.value = message;
  }

  function dispose() {
    clearShowTimer();
    clearHideTimer();
    triggerHovered.value = false;
    popoverHovered.value = false;
    dragActive.value = false;
    clearActivePreview();
  }

  return {
    activeBlockId,
    activeItemId,
    anchorEl,
    isOpen,
    isLoading,
    errorMessage,
    scheduleShow,
    showNow,
    scheduleHide,
    markPopoverHovered,
    setDragActive,
    setLoading,
    setError,
    dispose,
  };
}
