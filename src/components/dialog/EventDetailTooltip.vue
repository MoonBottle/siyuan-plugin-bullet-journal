<template>
  <div class="event-detail-tooltip">
    <ItemDetailContent
      :item="item"
      :readonly="true"
      :embedded="true"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'

defineProps<{
  item: Item
}>()
</script>

<style lang="scss" scoped>
.event-detail-tooltip {
  padding: 3px;
  min-width: 280px;
  max-width: 400px;
}
</style>
