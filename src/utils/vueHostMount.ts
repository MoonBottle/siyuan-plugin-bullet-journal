import type { App as VueApp } from 'vue';

const HOST_APP_KEY = '__bjVueApp__';

type HostWithVueApp = HTMLElement & {
  [HOST_APP_KEY]?: VueApp;
};

export function unmountVueAppFromHost(host: HTMLElement): void {
  const typedHost = host as HostWithVueApp;
  const app = typedHost[HOST_APP_KEY];

  if (app) {
    app.unmount();
    delete typedHost[HOST_APP_KEY];
  }

  host.innerHTML = '';
}

export function mountVueAppInHost(host: HTMLElement, app: VueApp): void {
  unmountVueAppFromHost(host);
  app.mount(host);
  (host as HostWithVueApp)[HOST_APP_KEY] = app;
}
