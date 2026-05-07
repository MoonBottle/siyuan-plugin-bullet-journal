<template>
  <Teleport to="body">
    <Transition name="debug-sheet-fade">
      <div v-if="modelValue" class="mobile-reminder-debug-root b3-dialog">
        <div class="mobile-reminder-debug-overlay" @click="close">
          <section class="mobile-reminder-debug-sheet" @click.stop>
            <header class="mobile-reminder-debug-sheet__header">
              <div>
                <h3 class="mobile-reminder-debug-sheet__title">
                  {{ t('mobile.debug.reminder.title') || '移动端提醒调试' }}
                </h3>
                <p class="mobile-reminder-debug-sheet__meta">
                  {{ t('mobile.debug.reminder.generatedAt') || '生成时间' }}:
                  {{ formatDateTime(snapshot?.generatedAt) }}
                </p>
                <p class="mobile-reminder-debug-sheet__meta">
                  {{ t('mobile.debug.reminder.currentDate') || '当前日期' }}:
                  {{ snapshot?.currentDate || '--' }}
                </p>
              </div>
              <button
                class="mobile-reminder-debug-sheet__close"
                data-testid="reminder-debug-close"
                type="button"
                @click="close"
              >
                {{ t('common.cancel') }}
              </button>
            </header>

            <div class="mobile-reminder-debug-sheet__content">
              <section class="mobile-reminder-debug-sheet__section">
                <div class="mobile-reminder-debug-sheet__section-title">
                  {{ t('mobile.debug.reminder.computed') || '计算出的提醒计划' }}
                </div>

                <div
                  v-if="snapshot?.computedEntries?.length"
                  class="mobile-reminder-debug-sheet__list"
                >
                  <article
                    v-for="entry in snapshot.computedEntries"
                    :key="entry.entryKey"
                    class="mobile-reminder-debug-sheet__card"
                    data-testid="reminder-debug-computed-entry"
                  >
                    <div class="mobile-reminder-debug-sheet__card-top">
                      <span class="mobile-reminder-debug-sheet__badge">
                        {{ entry.kind }}
                      </span>
                      <span class="mobile-reminder-debug-sheet__schedule">
                        {{ formatDateTime(entry.scheduledAt) }}
                      </span>
                    </div>
                    <div class="mobile-reminder-debug-sheet__card-title">{{ entry.title }}</div>
                    <div class="mobile-reminder-debug-sheet__card-body">{{ entry.body }}</div>
                    <dl class="mobile-reminder-debug-sheet__fields">
                      <div>
                        <dt>entryKey</dt>
                        <dd>{{ entry.entryKey }}</dd>
                      </div>
                      <div>
                        <dt>delay</dt>
                        <dd>{{ entry.delayInSeconds }}s</dd>
                      </div>
                      <div>
                        <dt>registryId</dt>
                        <dd>{{ entry.registryNotificationId ?? '--' }}</dd>
                      </div>
                      <div>
                        <dt>registryStatus</dt>
                        <dd>{{ entry.registryStatus ?? '--' }}</dd>
                      </div>
                      <div>
                        <dt>lastResult</dt>
                        <dd>{{ entry.lastScheduleResult ?? '--' }}</dd>
                      </div>
                      <div>
                        <dt>lastNativeId</dt>
                        <dd>{{ entry.lastNativeNotificationId ?? '--' }}</dd>
                      </div>
                    </dl>
                  </article>
                </div>

                <div v-else class="mobile-reminder-debug-sheet__empty">
                  {{ t('mobile.debug.reminder.emptyComputed') || '当前没有未来 24 小时内的提醒计划' }}
                </div>
              </section>

              <section class="mobile-reminder-debug-sheet__section">
                <div class="mobile-reminder-debug-sheet__section-title">
                  {{ t('mobile.debug.reminder.registry') || '原生预约注册表' }}
                </div>

                <div
                  v-if="snapshot?.registryEntries?.length"
                  class="mobile-reminder-debug-sheet__list"
                >
                  <article
                    v-for="entry in snapshot.registryEntries"
                    :key="entry.entryKey"
                    class="mobile-reminder-debug-sheet__card"
                    data-testid="reminder-debug-registry-entry"
                  >
                    <div class="mobile-reminder-debug-sheet__card-top">
                      <span class="mobile-reminder-debug-sheet__badge">
                        {{ entry.kind }}
                      </span>
                      <span class="mobile-reminder-debug-sheet__schedule">
                        {{ formatDateTime(entry.scheduledAt) }}
                      </span>
                    </div>
                    <dl class="mobile-reminder-debug-sheet__fields">
                      <div>
                        <dt>entryKey</dt>
                        <dd>{{ entry.entryKey }}</dd>
                      </div>
                      <div>
                        <dt>notificationId</dt>
                        <dd>{{ entry.notificationId }}</dd>
                      </div>
                      <div>
                        <dt>status</dt>
                        <dd>{{ entry.status }}</dd>
                      </div>
                      <div>
                        <dt>updatedAt</dt>
                        <dd>{{ entry.updatedAt }}</dd>
                      </div>
                    </dl>
                  </article>
                </div>

                <div v-else class="mobile-reminder-debug-sheet__empty">
                  {{ t('mobile.debug.reminder.emptyRegistry') || '当前没有额外保留的原生预约记录' }}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import type { MobileNotificationDebugSnapshot } from '@/services/mobileNotificationScheduler';

defineProps<{
  modelValue: boolean;
  snapshot: MobileNotificationDebugSnapshot | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function close() {
  emit('update:modelValue', false);
}

function formatDateTime(timestamp?: number | null): string {
  if (!timestamp)
    return '--';

  return new Date(timestamp).toLocaleString();
}
</script>

<style scoped>
.mobile-reminder-debug-root {
  position: fixed;
  inset: 0;
  z-index: 10004;
}

.mobile-reminder-debug-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.45);
}

.mobile-reminder-debug-sheet {
  width: 100%;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  background: var(--b3-theme-background, #fff);
  box-sizing: border-box;
  overflow: hidden;
}

.mobile-reminder-debug-sheet__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--b3-border-color, #e5e7eb);
}

.mobile-reminder-debug-sheet__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--b3-theme-on-background, #111827);
}

.mobile-reminder-debug-sheet__meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-reminder-debug-sheet__close {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: var(--b3-theme-surface, #f3f4f6);
  color: var(--b3-theme-on-background, #111827);
}

.mobile-reminder-debug-sheet__content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  box-sizing: border-box;
}

.mobile-reminder-debug-sheet__section + .mobile-reminder-debug-sheet__section {
  margin-top: 20px;
}

.mobile-reminder-debug-sheet__section-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-reminder-debug-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-reminder-debug-sheet__card {
  padding: 14px;
  border: 1px solid var(--b3-border-color, #e5e7eb);
  border-radius: 14px;
  background: var(--b3-theme-surface, #fff);
}

.mobile-reminder-debug-sheet__card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.mobile-reminder-debug-sheet__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.12));
  color: var(--b3-theme-primary, #2563eb);
  font-size: 11px;
  font-weight: 700;
}

.mobile-reminder-debug-sheet__schedule {
  font-size: 12px;
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-reminder-debug-sheet__card-title {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--b3-theme-on-background, #111827);
}

.mobile-reminder-debug-sheet__card-body {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--b3-theme-on-surface, #374151);
  word-break: break-word;
}

.mobile-reminder-debug-sheet__fields {
  margin: 12px 0 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.mobile-reminder-debug-sheet__fields div {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 8px;
  font-size: 12px;
}

.mobile-reminder-debug-sheet__fields dt {
  color: var(--b3-theme-on-surface, #6b7280);
}

.mobile-reminder-debug-sheet__fields dd {
  margin: 0;
  color: var(--b3-theme-on-background, #111827);
  word-break: break-all;
}

.mobile-reminder-debug-sheet__empty {
  padding: 14px;
  border-radius: 14px;
  background: var(--b3-theme-surface, #f9fafb);
  color: var(--b3-theme-on-surface, #6b7280);
  font-size: 13px;
}

.debug-sheet-fade-enter-active,
.debug-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.debug-sheet-fade-enter-from,
.debug-sheet-fade-leave-to {
  opacity: 0;
}

.debug-sheet-fade-enter-active .mobile-reminder-debug-sheet,
.debug-sheet-fade-leave-active .mobile-reminder-debug-sheet {
  transition: transform 0.2s ease;
}

.debug-sheet-fade-enter-from .mobile-reminder-debug-sheet,
.debug-sheet-fade-leave-to .mobile-reminder-debug-sheet {
  transform: translateY(100%);
}
</style>
