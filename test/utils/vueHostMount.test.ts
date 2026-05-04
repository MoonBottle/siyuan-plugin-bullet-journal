// @vitest-environment happy-dom

import { createApp, defineComponent, h, onUnmounted } from 'vue';
import { describe, expect, it } from 'vitest';

describe('vueHostMount', () => {
  it('unmounts the previous app before mounting another app on the same host', async () => {
    const { mountVueAppInHost } = await import('@/utils/vueHostMount');
    const host = document.createElement('div');
    document.body.appendChild(host);

    let firstUnmounted = 0;
    let secondUnmounted = 0;

    const FirstComponent = defineComponent({
      setup() {
        onUnmounted(() => {
          firstUnmounted += 1;
        });

        return () => h('div', 'first');
      },
    });

    const SecondComponent = defineComponent({
      setup() {
        onUnmounted(() => {
          secondUnmounted += 1;
        });

        return () => h('div', 'second');
      },
    });

    mountVueAppInHost(host, createApp(FirstComponent));
    mountVueAppInHost(host, createApp(SecondComponent));

    expect(firstUnmounted).toBe(1);
    expect(secondUnmounted).toBe(0);
    expect(host.textContent).toContain('second');
  });

  it('unmounts the current app and clears the host', async () => {
    const { mountVueAppInHost, unmountVueAppFromHost } = await import('@/utils/vueHostMount');
    const host = document.createElement('div');
    document.body.appendChild(host);

    let unmounted = 0;

    const Component = defineComponent({
      setup() {
        onUnmounted(() => {
          unmounted += 1;
        });

        return () => h('div', 'content');
      },
    });

    mountVueAppInHost(host, createApp(Component));
    unmountVueAppFromHost(host);

    expect(unmounted).toBe(1);
    expect(host.innerHTML).toBe('');
  });
});
