// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, h, nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { initI18n } from '@/i18n';
import { TAB_TYPES } from '@/constants';

describe('Workbench tab constants', () => {
  it('exposes workbench tab type', () => {
    expect(TAB_TYPES.WORKBENCH).toBe('bullet-journal-workbench');
  });
});

describe('WorkbenchTab placeholder', () => {
  it('exists and mounts cleanly with the localized title', async () => {
    const componentPath = resolve(process.cwd(), 'src/tabs/WorkbenchTab.vue');
    expect(existsSync(componentPath)).toBe(true);

    initI18n('en_US');
    const { default: WorkbenchTab } = await import('@/tabs/WorkbenchTab.vue');

    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render() {
        return h(WorkbenchTab);
      },
    });

    app.mount(container);
    await nextTick();

    expect(container.textContent).toContain('Workbench');

    app.unmount();
    container.remove();
  });
});

describe('Workbench registration', () => {
  it('registers the desktop workbench tab and top-bar entry in index.ts', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*this\.addTab\(\{\s*type:\s*TAB_TYPES\.WORKBENCH,/s,
    );
    expect(indexSource).toMatch(
      /if\s*\(!this\.isMobile\)\s*\{\s*menu\.addItem\(\{\s*icon:\s*"iconPanel",\s*label:\s*t\("workbench"\)\.title,\s*click:\s*\(\)\s*=>\s*\{\s*this\.openCustomTab\(TAB_TYPES\.WORKBENCH\);/s,
    );
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*"iconPanel"/);
    expect(indexSource).toMatch(/\[TAB_TYPES\.WORKBENCH\]:\s*t\("workbench"\)\.title/);
  });

  it('defines required workbench i18n labels', () => {
    const zh = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/zh_CN.json'), 'utf-8'));
    const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/en_US.json'), 'utf-8'));

    expect(en.workbench).toMatchObject({
      title: 'Workbench',
      newDashboard: 'New Dashboard',
      newView: 'New View',
    });
    expect(zh.workbench).toMatchObject({
      title: '工作台',
      newDashboard: '新建仪表盘',
      newView: '新建视图',
    });
  });
});
