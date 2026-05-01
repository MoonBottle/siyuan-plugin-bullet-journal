<template>
  <div
    v-if="visible"
    class="block-focus-preview-popover"
    data-testid="block-focus-preview-popover"
    :style="popoverStyle"
    @mouseenter="emit('popover-hover', true)"
    @mouseleave="emit('popover-hover', false)"
  >
    <div
      v-if="loading"
      class="block-focus-preview-popover__state"
    >
      Loading preview...
    </div>
    <div
      v-else-if="loadError"
      class="block-focus-preview-popover__state block-focus-preview-popover__state--error"
    >
      {{ loadError }}
    </div>
    <div
      ref="mountEl"
      class="block-focus-preview-popover__editor"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { Protyle } from 'siyuan';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useApp } from '@/main';

const props = defineProps<{
  blockId: string;
  anchorEl: HTMLElement | null;
  visible: boolean;
  isRootDocumentBlock: boolean;
}>();

const emit = defineEmits<{
  (event: 'popover-hover', hovered: boolean): void;
  (event: 'loading-change', loading: boolean): void;
  (event: 'error-change', error: string): void;
}>();

const app = useApp();
const mountEl = ref<HTMLElement | null>(null);
const protyleInstance = ref<InstanceType<typeof Protyle> | null>(null);
const loading = ref(false);
const loadError = ref('');

const action = computed(() => {
  return props.isRootDocumentBlock
    ? ['cb-get-context'] as const
    : ['cb-get-all'] as const;
});

const popoverStyle = computed(() => {
  const rect = props.anchorEl?.getBoundingClientRect();
  if (!rect) {
    return {
      position: 'fixed',
      left: '0px',
      top: '0px',
    };
  }

  return {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.bottom + 8}px`,
    width: '560px',
    maxWidth: 'min(560px, calc(100vw - 24px))',
    maxHeight: '70vh',
    zIndex: 'var(--b3-z-index, 300)',
  };
});

function destroyProtyle() {
  protyleInstance.value?.destroy?.();
  protyleInstance.value = null;
  if (mountEl.value) {
    mountEl.value.innerHTML = '';
  }
}

async function mountProtyle() {
  if (!props.visible || !props.blockId || !mountEl.value || !app) {
    loading.value = false;
    emit('loading-change', false);
    if (!app && props.visible && props.blockId) {
      loadError.value = 'Preview app context is unavailable.';
      emit('error-change', 'Preview app context is unavailable.');
    }
    return;
  }

  destroyProtyle();
  await nextTick();

  if (!mountEl.value) {
    loading.value = false;
    emit('loading-change', false);
    return;
  }

  loadError.value = '';
  loading.value = true;
  emit('error-change', '');
  emit('loading-change', true);

  try {
    protyleInstance.value = new Protyle(app, mountEl.value, {
      blockId: props.blockId,
      action: [...action.value],
      render: {
        gutter: true,
        scroll: true,
        breadcrumbDocName: true,
        title: props.isRootDocumentBlock,
      },
      typewriterMode: false,
      after: () => {
        loading.value = false;
        emit('loading-change', false);
      },
    });
  }
  catch (error) {
    loading.value = false;
    loadError.value = error instanceof Error ? error.message : 'Failed to mount preview.';
    emit('loading-change', false);
    emit('error-change', loadError.value);
  }
}

watch(
  () => [props.visible, props.blockId, props.isRootDocumentBlock] as const,
  async ([visible]) => {
    if (!visible) {
      destroyProtyle();
      loading.value = false;
      loadError.value = '';
      emit('loading-change', false);
      emit('error-change', '');
      return;
    }

    await mountProtyle();
  },
  {
    flush: 'post',
  },
);

onMounted(() => {
  void mountProtyle();
});

onBeforeUnmount(() => {
  destroyProtyle();
});
</script>

<style lang="scss" scoped>
.block-focus-preview-popover {
  overflow: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-background);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
}

.block-focus-preview-popover__editor {
  min-height: 240px;
}

.block-focus-preview-popover__state {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.block-focus-preview-popover__state--error {
  color: var(--b3-theme-error);
}
</style>
