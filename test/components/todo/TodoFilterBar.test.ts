// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, ref } from 'vue';
import { initI18n } from '@/i18n';

async function mountFilterBar() {
  const { default: TodoFilterBar } = await import('@/components/todo/TodoFilterBar.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const selectedGroup = ref('group-a');
  const dateFilterType = ref<'today' | 'week' | 'all' | 'custom'>('today');
  const selectedPriorities = ref(['high']);
  const searchQuery = ref('abc');

  const app = createApp(defineComponent({
    render() {
      return h(TodoFilterBar, {
        selectedGroup: selectedGroup.value,
        dateFilterType: dateFilterType.value,
        selectedPriorities: selectedPriorities.value,
        searchQuery: searchQuery.value,
        startDate: '2026-05-02',
        endDate: '2026-05-09',
        showSortPanel: false,
        sortRules: [],
        groupOptions: [{ value: '', label: 'All Groups' }],
        dateFilterOptions: [{ value: 'today', label: 'Today' }],
        priorityOptions: [
          { value: 'high', emoji: '🔥' },
          { value: 'medium', emoji: '🌱' },
          { value: 'low', emoji: '🍃' },
        ],
        sortDirectionOptions: [
          { value: 'asc', label: 'Asc' },
          { value: 'desc', label: 'Desc' },
        ],
        availableFieldOptions: () => [],
      });
    },
  }));

  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('TodoFilterBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initI18n('en_US');
  });

  it('renders the same todo search and filter controls', async () => {
    const mounted = await mountFilterBar();

    expect(mounted.container.querySelector('.search-input')).not.toBeNull();
    expect(mounted.container.querySelector('.group-select')).not.toBeNull();
    expect(mounted.container.querySelector('.date-filter-select')).not.toBeNull();
    expect(mounted.container.querySelectorAll('.priority-btn')).toHaveLength(3);

    mounted.unmount();
  });
});
