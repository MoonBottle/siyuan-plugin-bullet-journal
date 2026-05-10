// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobileWeixinSheet from '@/mobile/drawers/weixin/MobileWeixinSheet.vue';

const mockAiStore = {
  clawBotLoginStatus: 'none' as string,
  isClawBotConnected: false,
  clawBotConfig: {
    qrcodeUrl: '',
    errorMessage: '',
    accountId: '',
  },
  clawBotForwardProxyAvailable: true,
  weixinConversationMap: {} as Record<string, any>,
  unreadWeixinMessages: {} as Record<string, number>,
  getWeixinConversationStatus: vi.fn(),
  startClawBotLogin: vi.fn(),
  pollClawBotLogin: vi.fn(),
  disconnectClawBot: vi.fn(),
};

vi.mock('@/stores', () => ({
  useAIStore: () => mockAiStore,
}));

function mountSheet(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileWeixinSheet, { modelValue: true, ...props });
  app.mount(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

async function flush() {
  await Promise.resolve();
  await nextTick();
}

describe('MobileWeixinSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockAiStore.clawBotLoginStatus = 'none';
    mockAiStore.isClawBotConnected = false;
    mockAiStore.clawBotForwardProxyAvailable = true;
    mockAiStore.clawBotConfig = { qrcodeUrl: '', errorMessage: '', accountId: '' };
    mockAiStore.weixinConversationMap = {};
    mockAiStore.unreadWeixinMessages = {};
    mockAiStore.getWeixinConversationStatus.mockReset();
    mockAiStore.getWeixinConversationStatus.mockReturnValue({
      status: 'active',
      label: '进行中',
      tone: 'positive',
    });
    mockAiStore.startClawBotLogin.mockResolvedValue({ qrcodeUrl: 'https://example.com/qr', sessionKey: 'sk' });
    mockAiStore.pollClawBotLogin.mockResolvedValue(true);
    mockAiStore.disconnectClawBot.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the sheet with handle bar and title', () => {
    const mounted = mountSheet();

    const sheet = document.body.querySelector('.weixin-sheet');
    expect(sheet).not.toBeNull();
    expect(document.body.querySelector('.handle-bar')).not.toBeNull();
    expect(sheet?.textContent).toContain('微信 ClawBot 连接');

    mounted.unmount();
  });

  it('shows get qrcode button when not connected', () => {
    const mounted = mountSheet();

    const btn = document.body.querySelector('.weixin-sheet__btn--primary');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('获取二维码');

    mounted.unmount();
  });

  it('calls startClawBotLogin when get qrcode button is clicked', async () => {
    const mounted = mountSheet();
    await flush();

    const btn = document.body.querySelector('.weixin-sheet__btn--primary') as HTMLButtonElement;
    btn?.click();
    await flush();

    expect(mockAiStore.startClawBotLogin).toHaveBeenCalled();

    mounted.unmount();
  });

  it('shows qrcode iframe when loginStatus is pending', async () => {
    mockAiStore.clawBotLoginStatus = 'pending';
    mockAiStore.clawBotConfig.qrcodeUrl = 'https://example.com/qr';

    const mounted = mountSheet();
    await flush();

    const iframe = document.body.querySelector('.weixin-sheet__qrcode-wrapper iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://example.com/qr');
    expect(document.body.textContent).toContain('刷新二维码');
    expect(document.body.textContent).toContain('我已扫码');

    mounted.unmount();
  });

  it('shows connected state when connected', async () => {
    mockAiStore.clawBotLoginStatus = 'connected';
    mockAiStore.isClawBotConnected = true;
    mockAiStore.clawBotConfig.accountId = 'test-account';

    const mounted = mountSheet();
    await flush();

    expect(document.body.textContent).toContain('已连接到微信');
    expect(document.body.textContent).toContain('test-account');
    expect(document.body.textContent).toContain('断开连接');

    mounted.unmount();
  });

  it('calls disconnectClawBot when disconnect button is clicked', async () => {
    mockAiStore.clawBotLoginStatus = 'connected';
    mockAiStore.isClawBotConnected = true;

    const mounted = mountSheet();
    await flush();

    const btn = document.body.querySelector('.weixin-sheet__btn--danger') as HTMLButtonElement;
    btn?.click();
    await flush();

    expect(mockAiStore.disconnectClawBot).toHaveBeenCalled();

    mounted.unmount();
  });

  it('emits update:modelValue false when overlay is clicked', async () => {
    const mounted = mountSheet();
    await flush();

    const overlay = document.body.querySelector('.drawer-overlay') as HTMLElement;
    overlay?.click();
    await flush();

    mounted.unmount();
  });

  it('shows connected users list when available', async () => {
    mockAiStore.clawBotLoginStatus = 'connected';
    mockAiStore.isClawBotConnected = true;
    mockAiStore.weixinConversationMap = {
      'user1': {
        userName: 'Test User',
        conversationId: 'conv-1',
        lastMessageAt: Date.now(),
      },
    };
    mockAiStore.unreadWeixinMessages = { user1: 2 };
    mockAiStore.getWeixinConversationStatus = vi.fn().mockReturnValue({
      status: 'active',
      label: '进行中',
      tone: 'positive',
    });

    const mounted = mountSheet();
    await flush();

    expect(document.body.textContent).toContain('微信会话');
    expect(document.body.textContent).toContain('Test User');
    expect(document.body.querySelector('.weixin-sheet__user-unread')?.textContent?.trim()).toBe('2');

    mounted.unmount();
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    mockAiStore.clawBotLoginStatus = 'pending';
    mockAiStore.clawBotConfig.qrcodeUrl = 'https://example.com/qr';

    const mounted = mountSheet();
    await flush();

    mounted.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });
});
