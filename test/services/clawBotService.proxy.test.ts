import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClawBotService } from '@/services/clawBotService';

describe('ClawBotService proxy transport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests local proxy for getupdates', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ next_key_buf: '', add_msgs: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await service.startLogin();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18965/clawbot/ilink/bot/get_bot_qrcode?bot_type=3',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses proxy for sendmessage', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ret: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await service.sendTextMessage('user@im.wechat', 'Hello');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18965/clawbot/ilink/bot/sendmessage',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps proxy connection failures to a stable error message', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await expect(service.startLogin()).rejects.toThrow('ClawBot local proxy unavailable');
  });

  it('routes getconfig through proxy', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ret: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await service.notifyGatewayStart();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18965/clawbot/ilink/bot/msg/notifystart',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});