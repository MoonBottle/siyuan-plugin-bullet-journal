import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAIStore } from '@/stores/aiStore';

describe('Weixin conversation status derivation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function setupStore(overrides: Record<string, any> = {}) {
    const store = useAIStore();
    store.clawBotStats.isConnected = overrides.isConnected ?? true;
    store.clawBotConfig.baseUrl = overrides.baseUrl ?? 'http://127.0.0.1:18965/clawbot/ilink';

    if (overrides.conversations) {
      for (const [userId, conv] of Object.entries(overrides.conversations)) {
        (store as any).weixinConversationMap[userId] = conv;
      }
    }

    return store;
  }

  it('derives offline when ClawBot is not connected', () => {
    const store = setupStore({
      isConnected: false,
      conversations: {
        'user1': { contextState: 'active' },
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status.status).toBe('offline');
  });

  it('derives active when context is active and connected', () => {
    const store = setupStore({
      isConnected: true,
      conversations: {
        'user1': { contextState: 'active' },
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status.status).toBe('active');
    expect(status.label).toBe('可用');
    expect(status.tone).toBe('positive');
  });

  it('derives stale when context is stale', () => {
    const store = setupStore({
      isConnected: true,
      conversations: {
        'user1': { contextState: 'stale' },
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status.status).toBe('stale');
    expect(status.label).toBe('需恢复');
    expect(status.tone).toBe('warning');
  });

  it('derives stale when recent context error exists', () => {
    const store = setupStore({
      isConnected: true,
      conversations: {
        'user1': {
          contextState: 'active',
          lastContextErrorAt: Date.now() - 30_000,
        },
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status.status).toBe('stale');
  });

  it('treats an existing connected conversation without explicit context state as active', () => {
    const store = setupStore({
      isConnected: true,
      conversations: {
        'user1': {},
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status.status).toBe('active');
    expect(status.label).toBe('可用');
    expect(status.tone).toBe('positive');
  });

  it('derives offline for unknown user', () => {
    const store = setupStore({ isConnected: true });

    const status = store.getWeixinConversationStatus('unknown');
    expect(status.status).toBe('offline');
  });

  it('returns consistent structure with status, label, tone', () => {
    const store = setupStore({
      isConnected: true,
      conversations: {
        'user1': { contextState: 'active' },
      },
    });

    const status = store.getWeixinConversationStatus('user1');
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('label');
    expect(status).toHaveProperty('tone');
  });
});
