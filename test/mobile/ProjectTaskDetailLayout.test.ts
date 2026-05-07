// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import ProjectDetail from '@/mobile/drawers/project/ProjectDetail.vue';
import TaskDetail from '@/mobile/drawers/task/TaskDetail.vue';

function mountProjectDetail() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(ProjectDetail, {
    modelValue: true,
    project: {
      id: 'project-1',
      name: '任务助手示例文档',
      description: '',
      tasks: [],
    },
  });
  app.mount(container);

  return {
    async tick() {
      await nextTick();
    },
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

function mountTaskDetail() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(TaskDetail, {
    modelValue: true,
    task: {
      id: 'task-1',
      name: '这是一个任务',
      level: 'L1',
      items: [],
    },
    projectName: '任务助手示例文档',
    projectId: 'project-1',
  });
  app.mount(container);

  return {
    async tick() {
      await nextTick();
    },
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Project and Task detail fullscreen layout', () => {
  it('keeps the Siyuan dialog class on a wrapper instead of the project content container', async () => {
    const mounted = mountProjectDetail();
    await mounted.tick();

    const overlay = document.body.querySelector('.project-detail-overlay');
    const fullscreen = document.body.querySelector('.project-detail-fullscreen');

    expect(overlay?.classList.contains('b3-dialog')).toBe(true);
    expect(fullscreen?.classList.contains('b3-dialog')).toBe(false);

    mounted.unmount();
  });

  it('keeps the Siyuan dialog class on a wrapper instead of the task content container', async () => {
    const mounted = mountTaskDetail();
    await mounted.tick();

    const overlay = document.body.querySelector('.task-detail-overlay');
    const fullscreen = document.body.querySelector('.task-detail-fullscreen');

    expect(overlay?.classList.contains('b3-dialog')).toBe(true);
    expect(fullscreen?.classList.contains('b3-dialog')).toBe(false);

    mounted.unmount();
  });

  it('renders tasks even when they have no item priority', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp(ProjectDetail, {
      modelValue: true,
      project: {
        id: 'project-1',
        name: '任务助手示例文档',
        description: '',
        tasks: [
          {
            id: 'task-1',
            blockId: 'task-block-1',
            name: '这是一个任务',
            level: 'L1',
            items: [
              {
                id: 'item-1',
                blockId: 'item-1',
                content: '这是一个全天事项',
                date: '2026-05-07',
                status: 'pending',
              },
            ],
          },
        ],
      },
    });
    app.mount(container);
    await nextTick();

    expect(document.body.textContent).toContain('这是一个任务');

    app.unmount();
    container.remove();
  });
});
