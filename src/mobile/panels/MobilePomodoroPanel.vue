<template>
  <section
    class="mobile-pomodoro-panel"
    data-testid="pomodoro-panel"
    :data-block-id="preselectedBlockId"
  >
    <div class="mobile-pomodoro-panel__surface">
      <MobileComplete
        v-if="showComplete && pendingCompletion"
        :pending="pendingCompletion"
        @close="handleCompleteClose"
        @save="handleCompleteSave"
      />
      <MobileActiveTimer
        v-else-if="pomodoroStore.isFocusing"
      />
      <MobileBreakTimer
        v-else-if="pomodoroStore.isBreakActive"
      />
      <MobileTimerStarter
        v-else
        :preselected-block-id="preselectedBlockId"
      />
    </div>

    <MobileRestDialog
      v-model="showRestDialog"
      @start="handleStartBreak"
      @skip="handleSkipBreak"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { usePomodoroStore } from '@/stores';
import type { PendingPomodoroCompletion } from '@/types/models';
import { eventBus, Events } from '@/utils/eventBus';
import MobileActiveTimer from '@/mobile/drawers/pomodoro/sub/MobileActiveTimer.vue';
import MobileBreakTimer from '@/mobile/drawers/pomodoro/sub/MobileBreakTimer.vue';
import MobileComplete from '@/mobile/drawers/pomodoro/sub/MobileComplete.vue';
import MobileRestDialog from '@/mobile/drawers/pomodoro/sub/MobileRestDialog.vue';
import MobileTimerStarter from '@/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue';

const props = withDefaults(defineProps<{
  initialContext?: {
    blockId?: string
  } | null
}>(), {
  initialContext: null,
});

const pomodoroStore = usePomodoroStore();

const showComplete = ref(false);
const pendingCompletion = ref<PendingPomodoroCompletion | null>(null);
const showRestDialog = ref(false);

const preselectedBlockId = computed(() => props.initialContext?.blockId ?? '');

let unsubscribeCompletion: (() => void) | null = null;

onMounted(() => {
  unsubscribeCompletion = eventBus.on(
    Events.POMODORO_PENDING_COMPLETION,
    (pending: PendingPomodoroCompletion) => {
      pendingCompletion.value = pending;
      showComplete.value = true;
    },
  );
});

onUnmounted(() => {
  unsubscribeCompletion?.();
});

function handleCompleteClose() {
  showComplete.value = false;
  pendingCompletion.value = null;
}

function handleCompleteSave() {
  showComplete.value = false;
  pendingCompletion.value = null;
  showRestDialog.value = true;
}

function handleStartBreak(duration: number) {
  pomodoroStore.startBreak(duration);
}

function handleSkipBreak() {
  showRestDialog.value = false;
}
</script>

<style lang="scss" scoped>
.mobile-pomodoro-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: 100%;
  min-height: 0;
  background: var(--b3-theme-surface, #fff);
  overflow: hidden;
}

.mobile-pomodoro-panel__surface {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
