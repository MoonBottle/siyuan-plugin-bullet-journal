import { createApp } from 'vue';

export function getDomByVueComponent(component) {
  const div = document.createElement('div');
  const app = createApp(component);
  app.mount(div);
  return div;
}
