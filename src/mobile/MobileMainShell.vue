<template>
  <div class="mobile-main-shell" data-testid="mobile-main-shell">
    <main class="mobile-main-shell__content">
      <MobileTodoPanel
        v-if="hasMountedTodoPanel"
        v-show="activeTab === 'todo'"
        ref="todoPanelRef"
        @open-pomodoro="handleOpenPomodoro"
      />
      <MobilePomodoroPanel
        v-if="activeTab === 'pomodoro'"
        :initial-context="pomodoroContext"
      />
      <MobileHabitPanel v-else-if="activeTab === 'habit'" />
      <MobileMorePanel v-else-if="activeTab === 'more'" />
    </main>

    <MobileCreateFab
      v-if="activeTab === 'todo'"
      class="mobile-main-shell__fab"
      @click="handleCreate"
    />

    <MobileBottomTabBar
      :active-tab="activeTab"
      @update:active-tab="activeTab = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import MobileBottomTabBar from '@/mobile/components/navigation/MobileBottomTabBar.vue';
import MobileCreateFab from '@/mobile/components/navigation/MobileCreateFab.vue';
import MobileHabitPanel from '@/mobile/panels/MobileHabitPanel.vue';
import MobileMorePanel from '@/mobile/panels/MobileMorePanel.vue';
import MobilePomodoroPanel from '@/mobile/panels/MobilePomodoroPanel.vue';
import MobileTodoPanel from '@/mobile/panels/MobileTodoPanel.vue';
import { eventBus, Events } from '@/utils/eventBus';
import {
  consumePendingMobileMainShellTabTarget,
  type MobileMainShellNavigationTarget,
  type MobileMainShellTab,
} from '@/utils/mobileMainShellNavigation';

type PomodoroLaunchContext = {
  blockId: string
};

const activeTab = ref<MobileMainShellTab>('todo');
const pomodoroContext = ref<PomodoroLaunchContext | null>(null);
const todoPanelRef = ref<InstanceType<typeof MobileTodoPanel> | null>(null);
const hasMountedTodoPanel = ref(true);

function navigateToTab(tab: MobileMainShellTab) {
  if (tab === 'todo') {
    hasMountedTodoPanel.value = true;
  }
  activeTab.value = tab;
}

function handleOpenPomodoro(payload: PomodoroLaunchContext) {
  pomodoroContext.value = payload;
  navigateToTab('pomodoro');
}

function handleCreate() {
  todoPanelRef.value?.openQuickCreate();
}

function handleShellNavigate(target: MobileMainShellNavigationTarget) {
  if (target.tab === 'pomodoro') {
    pomodoroContext.value = null;
  }
  navigateToTab(target.tab);
}

let unsubscribeShellNavigate: (() => void) | null = null;

onMounted(() => {
  const pendingTarget = consumePendingMobileMainShellTabTarget();
  if (pendingTarget) {
    handleShellNavigate(pendingTarget);
  }
  unsubscribeShellNavigate = eventBus.on(Events.MOBILE_MAIN_SHELL_NAVIGATE, handleShellNavigate);
});

onUnmounted(() => {
  if (unsubscribeShellNavigate) {
    unsubscribeShellNavigate();
    unsubscribeShellNavigate = null;
  }
});
</script>

<style lang="scss" scoped>
.mobile-main-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: 100%;
  background: var(--b3-theme-surface, #fff);
}

.mobile-main-shell__content {
  flex: 1;
  min-height: 0;
  padding-bottom: 72px;
}

.mobile-main-shell__fab {
  position: absolute;
  right: 16px;
  bottom: 88px;
}
</style>
