import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forwardProxy, forwardProxyBinary, isForwardProxyAvailable } from '@/services/clawBotForwardProxy';

vi.mock('siyuan', () => ({
  fetchSyncPost: vi.fn(),
}));

import { fetchSyncPost } from 'siyuan';

describe('clawBotForwardProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockKernelResponse(data: any) {
    (fetchSyncPost as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 0,
      msg: '',
      data,
    });
  }

  describe('forwardProxy', () => {
    it('sends GET request through kernel forwardProxy', async () => {
      mockKernelResponse({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}',
        bodyEncoding: 'text',
        headers: {},
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
        elapsed: 100,
      });

      const result = await forwardProxy({
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
        method: 'GET',
      });

      expect(result.status).toBe(200);
      expect(result.body).toBe('{"ok":true}');

      const callBody = (fetchSyncPost as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callBody.url).toBe('https://ilinkai.weixin.qq.com/ilink/bot/getconfig');
      expect(callBody.method).toBe('GET');
    });

    it('sends POST with JSON body and custom headers', async () => {
      mockKernelResponse({
        status: 200,
        contentType: 'application/json',
        body: '{"ret":0}',
        bodyEncoding: 'text',
        headers: {},
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage',
        elapsed: 50,
      });

      const result = await forwardProxy({
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage',
        method: 'POST',
        contentType: 'application/json',
        headers: [
          { Authorization: 'Bearer test-token' },
          { AuthorizationType: 'ilink_bot_token' },
          { 'X-WECHAT-UIN': 'test-uin' },
        ],
        payload: { msg: 'hello' },
      });

      expect(result.status).toBe(200);
      const callBody = (fetchSyncPost as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callBody.headers).toHaveLength(3);
      expect(callBody.payload).toEqual({ msg: 'hello' });
    });

    it('preserves upstream error status codes', async () => {
      mockKernelResponse({
        status: 401,
        contentType: 'application/json',
        body: '{"errcode":-14}',
        bodyEncoding: 'text',
        headers: {},
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates',
        elapsed: 10,
      });

      const result = await forwardProxy({
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates',
        method: 'POST',
      });

      expect(result.status).toBe(401);
      expect(result.body).toBe('{"errcode":-14}');
    });

    it('uses custom timeout for long polling', async () => {
      mockKernelResponse({
        status: 200,
        contentType: 'application/json',
        body: '{"next_key_buf":"","add_msgs":[]}',
        bodyEncoding: 'text',
        headers: {},
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates',
        elapsed: 25000,
      });

      await forwardProxy({
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates',
        method: 'POST',
        timeout: 30000,
      });

      const callBody = (fetchSyncPost as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callBody.timeout).toBe(30000);
    });

    it('throws on kernel error', async () => {
      (fetchSyncPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: -1,
        msg: 'forward request failed',
        data: null,
      });

      await expect(forwardProxy({
        url: 'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
        method: 'GET',
      })).rejects.toThrow('forward request failed');
    });
  });

  describe('forwardProxyBinary', () => {
    it('decodes base64 response to ArrayBuffer', async () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const b64 = btoa(String.fromCharCode(...original));

      mockKernelResponse({
        status: 200,
        contentType: 'image/jpeg',
        body: b64,
        bodyEncoding: 'base64',
        headers: {},
        url: 'https://cdn.weixin.qq.com/media/abc',
        elapsed: 200,
      });

      const result = await forwardProxyBinary({
        url: 'https://cdn.weixin.qq.com/media/abc',
        method: 'GET',
      });

      expect(result.status).toBe(200);
      expect(result.contentType).toBe('image/jpeg');
      expect(new Uint8Array(result.body)).toEqual(original);

      const callBody = (fetchSyncPost as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callBody.responseEncoding).toBe('base64');
    });
  });

  describe('isForwardProxyAvailable', () => {
    it('returns true when kernel responds with code 0', async () => {
      mockKernelResponse({ status: 200, body: '', bodyEncoding: 'text', headers: {}, url: '', elapsed: 0 });

      const result = await isForwardProxyAvailable();
      expect(result).toBe(true);
    });

    it('returns false when kernel returns error', async () => {
      (fetchSyncPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        code: -1,
        msg: 'error',
        data: null,
      });

      const result = await isForwardProxyAvailable();
      expect(result).toBe(false);
    });

    it('returns false when fetch throws', async () => {
      (fetchSyncPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));

      const result = await isForwardProxyAvailable();
      expect(result).toBe(false);
    });
  });
});