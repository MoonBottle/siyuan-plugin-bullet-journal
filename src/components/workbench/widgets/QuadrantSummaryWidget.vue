<template>
  <div
    class="workbench-widget-quadrant"
    data-testid="workbench-widget-quadrant"
  >
    <div
      class="workbench-widget-quadrant__content"
      data-testid="workbench-widget-quadrant-content"
    >
      <TodoSidebarList
        :items="panelItems"
        :has-any-items-raw="allFilteredItems.length > 0"
        :has-active-filters="Boolean(quadrantConfig.groupId)"
        display-mode="embedded"
        preview-trigger-mode="click"
        :on-item-preview-click="handleItemPreviewClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  WorkbenchQuadrantWidgetConfig,
  WorkbenchWidgetInstance,
} from '@/types/workbench'
import {
  computed,
  onMounted,
  onUnmounted,
  watch,
} from 'vue'
import TodoSidebarList from '@/components/todo/TodoSidebarList.vue'
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview'
import {
  useApp,
  usePlugin,
} from '@/main'
import { useQuadrantConfigStore } from '@/stores/quadrantConfigStore'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'
import { mapLegacyWorkbenchQuadrantKey } from '@/utils/quadrant'
import { assignItemsToQuadrants } from '@/utils/quadrantEvaluator'
import { useSafeProjectStore } from './useSafeProjectStore'

const props = defineProps<{
  widget?: WorkbenchWidgetInstance
  onTitleMetaChange?: (value: string) => void
}>()

const app = useApp()
const plugin = usePlugin() as any
const projectStore = useSafeProjectStore()
const quadrantConfigStore = useQuadrantConfigStore()
const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
})
const nativePreview = createNativeBlockPreviewController()

const quadrantConfig = computed(() => {
  return (props.widget?.config ?? {}) as WorkbenchQuadrantWidgetConfig
})

const quadrantId = computed(() => mapLegacyWorkbenchQuadrantKey(quadrantConfig.value.quadrant))
const panel = computed(() => quadrantConfigStore.panels.find((item) => item.id === quadrantId.value))

const allFilteredItems = computed(() => {
  if (!projectStore) return []
  return projectStore.getFilteredAndSortedItems({
    groupId: quadrantConfig.value.groupId ?? '',
  })
})

const assignments = computed(() => {
  return assignItemsToQuadrants(allFilteredItems.value, quadrantConfigStore.panels)
})

const panelItems = computed(() => {
  return panel.value ? assignments.value[panel.value.id] : []
})

const openItemsCount = computed(() => {
  return panelItems.value.filter((item) => item.status !== 'completed' && item.status !== 'abandoned').length
})

watch(
  () => [openItemsCount.value, panel.value?.title] as const,
  ([count, title]) => {
    props.onTitleMetaChange?.(`${count} 项${title ? ` · ${title}` : ''}`)
  },
  { immediate: true },
)

function handleItemPreviewClick(payload: {
  blockId: string
  itemId: string
  anchorEl: HTMLElement
}) {
  preview.showNow(payload)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!preview.isOpen.value) {
    return
  }

  if (nativePreview.containsTarget(event.target)) {
    return
  }

  preview.forceClose()
}

function handleNativePreviewDestroyed({
  initiatedByController,
  blockId,
  anchorEl,
}: {
  initiatedByController: boolean
  blockId: string
  anchorEl: HTMLElement
}) {
  const activeBlockId = preview.activeBlockId.value
  const activeItemId = preview.activeItemId.value
  const activeAnchorEl = preview.anchorEl.value

  if (activeBlockId !== blockId || activeAnchorEl !== anchorEl) {
    return
  }

  preview.forceClose()

  if (
    initiatedByController
    || !activeBlockId
    || !activeItemId
    || !activeAnchorEl
    || !anchorEl.matches(':hover')
  ) {
    return
  }

  preview.showNow({
    blockId: activeBlockId,
    itemId: activeItemId,
    anchorEl: activeAnchorEl,
  })
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
    if (!isOpen || !blockId || !anchorEl || !app) {
      nativePreview.close()
      return
    }

    nativePreview.open({
      app,
      plugin,
      blockId,
      anchorEl,
      onHoverChange: preview.markPopoverHovered,
      onPanelDestroyed: handleNativePreviewDestroyed,
    })
  },
  {
    flush: 'post',
  },
)

onMounted(async () => {
  if (!quadrantConfigStore.loaded) {
    await quadrantConfigStore.loadConfig()
  }
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  nativePreview.close()
  preview.dispose()
})
</script>

<style lang="scss" scoped>
.workbench-widget-quadrant {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__content {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.workbench-widget-quadrant__content :deep(.todo-sidebar) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-content) {
  min-height: 0;
}

.workbench-widget-quadrant__content :deep(.todo-list) {
  min-height: 0;
}
</style>
