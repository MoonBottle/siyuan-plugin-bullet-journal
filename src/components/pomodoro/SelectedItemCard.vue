<template>
  <Card :status="status" :show-header="showHeader && !!item.project" :show-footer="false">
    <template #header>
      <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
    </template>
    <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
    <div class="item-content">{{ item.content }}</div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from '@/components/common/Card.vue';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';

interface Props {
  item: Item;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showHeader: true
});

// 根据事项日期确定卡片状态
const status = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  if (props.item.date === today) return 'today';
  if (props.item.date < today) return 'expired';
  return 'future';
});
</script>

<style lang="scss" scoped>
.item-project {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.item-task {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  margin-bottom: 4px;
}

.item-content {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-word;
}
</style>
