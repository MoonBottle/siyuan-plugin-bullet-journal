<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="closeOnOverlay">
        <Transition name="slide-up">
          <div v-if="modelValue" class="pomodoro-drawer" @click.stop>
            <!-- Drag Handle -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>

            <!-- Dynamic Content -->
            <div class="drawer-content">
              <MobileComplete
                v-if="showComplete && pendingCompletion"
                :pending="pendingCompletion"
                @close="showComplete = false"
              />
              <component :is="currentComponent" v-else @close="close" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePomodoroStore } from '@/stores';
import { eventBus, Events } from '@/utils/eventBus';
import type { PendingPomodoroCompletion } from '@/types/models';
import MobileTimerStarter from './pomodoro/MobileTimerStarter.vue';
import MobileActiveTimer from './pomodoro/MobileActiveTimer.vue';
import MobileBreakTimer from './pomodoro/MobileBreakTimer.vue';
import MobileComplete from './pomodoro/MobileComplete.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

// 监听 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  console.log('[MobilePomodoroDrawer] modelValue 变化:', newVal);
});

const pomodoroStore = usePomodoroStore();

// 完成状态管理
const showComplete = ref(false);
const pendingCompletion = ref<PendingPomodoroCompletion | null>(null);

// 监听专注完成事件
let unsubscribeCompletion: (() => void) | null = null;

onMounted(() => {
  unsubscribeCompletion = eventBus.on(
    Events.POMODORO_PENDING_COMPLETION,
    (pending: PendingPomodoroCompletion) => {
      pendingCompletion.value = pending;
      showComplete.value = true;
    }
  );
});

onUnmounted(() => {
  if (unsubscribeCompletion) unsubscribeCompletion();
});

// Dynamic component based on pomodoro state
const currentComponent = computed(() => {
  if (pomodoroStore.isFocusing) {
    return MobileActiveTimer;
  }
  if (pomodoroStore.isBreakActive) {
    return MobileBreakTimer;
  }
  return MobileTimerStarter;
});

const close = () => {
  emit('update:modelValue', false);
};

const closeOnOverlay = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    close();
  }
};
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.pomodoro-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

// Fade transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Slide-up transition
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
