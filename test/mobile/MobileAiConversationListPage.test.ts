// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import MobileAiConversationListPage from '@/mobile/components/ai/MobileAiConversationListPage.vue';

function mountPage(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileAiConversationListPage, props);
  app.mount(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

describe('MobileAiConversationListPage', () => {
  it('renders current conversation highlight and emits delete/select', async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const mounted = mountPage({
      conversations: [
        { id: 'conv-1', title: '新对话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
        { id: 'conv-2', title: '工作复盘', createdAt: 2, updatedAt: 2, messageCount: 2, fileSize: 20, hasSkillExecutions: false },
      ],
      currentConversationId: 'conv-2',
      isLoadingHistory: false,
      onSelect,
      onDelete,
    });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-item-conv-2"]')?.className)
      .toContain('is-active');

    (mounted.container.querySelector('[data-testid="mobile-ai-history-item-conv-1"]') as HTMLButtonElement | null)?.click();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-2"]') as HTMLButtonElement | null)?.click();

    expect(onSelect).toHaveBeenCalledWith('conv-1');
    expect(onDelete).toHaveBeenCalledWith('conv-2');

    mounted.unmount();
  });
});
