<template>
  <div class="time-wheel">
    <div class="wheel-label">{{ label }}</div>
    <div class="wheel-wrapper">
      <div ref="wheelRef" class="wheel-container" @scroll="handleScroll">
        <!-- 顶部 padding -->
        <div class="wheel-padding"></div>
        
        <!-- 选项列表 -->
        <div
          v-for="option in options"
          :key="option.value"
          class="wheel-item"
          :class="{ selected: modelValue === option.value }"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </div>
        
        <!-- 底部 padding -->
        <div class="wheel-padding"></div>
      </div>
      
      <!-- 中心高亮框 -->
      <div class="wheel-center-highlight"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';

interface Option {
  value: string;
  label: string;
}

interface Props {
  modelValue: string;
  options: Option[];
  label?: string;
  itemHeight?: number; // 每项高度，默认 40px
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  itemHeight: 40
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const wheelRef = ref<HTMLDivElement>();
let scrollTimeout: number | null = null;
let isScrolling = false;

// 滚动到指定选项
function scrollToValue(value: string, smooth = true) {
  const index = props.options.findIndex(opt => opt.value === value);
  if (index === -1 || !wheelRef.value) return;
  
  const scrollTop = index * props.itemHeight;
  wheelRef.value.scrollTo({
    top: scrollTop,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// 选择选项
function selectOption(value: string) {
  emit('update:modelValue', value);
  scrollToValue(value);
}

// 滚动监听
function handleScroll() {
  if (!wheelRef.value || isScrolling) return;
  
  // 清除之前的 timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  // 防抖：滚动停止后计算选中项
  scrollTimeout = window.setTimeout(() => {
    if (!wheelRef.value) return;
    
    const scrollTop = wheelRef.value.scrollTop;
    const index = Math.round(scrollTop / props.itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, props.options.length - 1));
    
    const selectedOption = props.options[clampedIndex];
    if (selectedOption && selectedOption.value !== props.modelValue) {
      emit('update:modelValue', selectedOption.value);
    }
  }, 50);
}

// 监听 modelValue 变化，滚动到对应位置
watch(() => props.modelValue, (newValue) => {
  if (!isScrolling) {
    scrollToValue(newValue, false);
  }
});

// 初始化滚动位置
onMounted(() => {
  nextTick(() => {
    scrollToValue(props.modelValue, false);
  });
});

onUnmounted(() => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
});

// 暴露方法供父组件调用
defineExpose({
  scrollToValue
});
</script>

<style scoped>
.time-wheel {
  position: relative;
  height: 180px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.wheel-label {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #666);
  margin-bottom: 4px;
  font-weight: 500;
  height: 20px;
  line-height: 20px;
}

.wheel-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.wheel-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.wheel-container::-webkit-scrollbar {
  display: none;
}

.wheel-padding {
  height: 60px; /* (160 - 40) / 2 = 60px */
}

.wheel-item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  scroll-snap-align: center;
  scroll-snap-stop: always;
  transition: color 0.15s ease, font-weight 0.15s ease;
  cursor: pointer;
}

.wheel-item.selected {
  color: var(--b3-theme-primary, #3b82f6);
  font-weight: 600;
}

.wheel-center-highlight {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  height: 40px;
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.12));
  border-radius: 8px;
  pointer-events: none;
  z-index: 0;
}
</style>
