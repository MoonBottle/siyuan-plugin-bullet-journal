import { describe, expect, it, vi } from 'vitest';
import { createRefreshChannelGuard } from '@/utils/refreshChannelGuard';

type FakeMessageEvent = {
  data?: any;
};

function createFakeChannel() {
  return {
    onmessage: null as null | ((event: FakeMessageEvent) => void),
    close: vi.fn(),
  };
}

describe('createRefreshChannelGuard', () => {
  it('disposes the channel when it receives a plugin-unloading message for the same plugin instance', () => {
    const fakeChannel = createFakeChannel();
    const onRefresh = vi.fn();

    const guard = createRefreshChannelGuard({
      channel: fakeChannel,
      plugin: { debugInstanceId: 'plugin-1' },
      getCurrentPlugin: () => ({ debugInstanceId: 'plugin-1' }),
      onRefresh,
      viewName: 'DesktopTodoDock',
    });

    fakeChannel.onmessage?.({ data: { type: 'PLUGIN_UNLOADING', pluginInstanceId: 'plugin-1' } });

    expect(fakeChannel.close).toHaveBeenCalledTimes(1);
    expect(guard.isDisposed()).toBe(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('disposes the channel instead of refreshing when the current plugin instance no longer matches the captured plugin', () => {
    const fakeChannel = createFakeChannel();
    const onRefresh = vi.fn();

    const guard = createRefreshChannelGuard({
      channel: fakeChannel,
      plugin: { debugInstanceId: 'plugin-old' },
      getCurrentPlugin: () => ({ debugInstanceId: 'plugin-new' }),
      onRefresh,
      viewName: 'DesktopTodoDock',
    });

    fakeChannel.onmessage?.({ data: { type: 'DATA_REFRESH' } });

    expect(fakeChannel.close).toHaveBeenCalledTimes(1);
    expect(guard.isDisposed()).toBe(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('forwards refresh payload when the plugin instance is still current', () => {
    const fakeChannel = createFakeChannel();
    const onRefresh = vi.fn();

    createRefreshChannelGuard({
      channel: fakeChannel,
      plugin: { debugInstanceId: 'plugin-1' },
      getCurrentPlugin: () => ({ debugInstanceId: 'plugin-1' }),
      onRefresh,
      viewName: 'DesktopTodoDock',
    });

    fakeChannel.onmessage?.({ data: { type: 'DATA_REFRESH', scanMode: 'full' } });

    expect(fakeChannel.close).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalledWith({ scanMode: 'full' });
  });
});
