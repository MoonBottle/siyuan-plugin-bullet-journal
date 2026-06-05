<template>
  <div class="event-detail-tooltip">
    <ItemDetailContent
      :item="reactiveItem"
      :readonly="true"
      :embedded="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import { computed } from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import { useProjectStore } from '@/stores'

const props = defineProps<{
  item: Item
}>()

const projectStore = useProjectStore()

const reactiveItem = computed(() => projectStore.getItemByBlockId(props.item.blockId) ?? props.item)
</script>

<style lang="scss" scoped>
.event-detail-tooltip {
  padding: 3px;
  min-width: 280px;
  max-width: 400px;
}
</style>
