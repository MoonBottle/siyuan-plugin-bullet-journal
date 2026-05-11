// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { initI18n } from '@/i18n';
import type { TodoDateFilterType } from '@/utils/todoDateFilter';

async function mountFilterBar(extraProps: Record<string, unknown> = {}) {
  const { default: TodoFilterBar } = await import('@/components/todo/TodoFilterBar.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const selectedGroup = ref('group-a');
  const dateFilterType = ref<TodoDateFilterType>('today');
  const selectedPriorities = ref(['high']);
  const searchQuery = ref(String(extraProps.searchQuery ?? 'abc'));
  const tagQuery = ref(String(extraProps.tagQuery ?? ''));
  const selectedTags = ref<string[]>([...((extraProps.selectedTags as string[] | undefined) ?? [])]);

  const app = createApp(defineComponent({
    render() {
      return h(TodoFilterBar, {
        selectedGroup: selectedGroup.value,
        dateFilterType: dateFilterType.value,
        selectedPriorities: selectedPriorities.value,
        searchQuery: searchQuery.value,
        tagQuery: tagQuery.value,
        selectedTags: selectedTags.value,
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
        'onUpdate:tagQuery': (value: string) => {
          tagQuery.value = value;
        },
        'onUpdate:selectedTags': (value: string[]) => {
          selectedTags.value = value;
        },
        ...Object.fromEntries(
          Object.entries(extraProps).filter(([key]) => !['searchQuery', 'tagQuery', 'selectedTags'].includes(key)),
        ),
      });
    },
  }));

  app.mount(container);

  return {
    container,
    tagQuery,
    selectedTags,
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

  it('can explicitly hide the search row for config-only contexts', async () => {
    const mounted = await mountFilterBar({
      showSearch: false,
    });

    expect(mounted.container.querySelector('.search-input')).toBeNull();
    expect(mounted.container.querySelector('.group-select')).not.toBeNull();
    expect(mounted.container.querySelector('.date-filter-select')).not.toBeNull();

    mounted.unmount();
  });

  it('renders selected tags inside the tag input and shows dropdown options with counts', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      tagQuery: '',
      selectedTags: ['Alpha'],
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    });

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const chips = mounted.container.querySelectorAll('.tag-search-box .tag-chip');
    const options = mounted.container.querySelectorAll('.tag-dropdown .tag-option');

    expect(chips).toHaveLength(1);
    expect(chips[0]?.textContent).toContain('#Alpha');
    expect(options).toHaveLength(2);
    expect(options[1]?.textContent).toContain('#Beta');
    expect(options[1]?.querySelector('.tag-option__count')?.textContent).toBe('1');
    expect((mounted.container.querySelector('.tag-search-input') as HTMLInputElement | null)?.placeholder).toBe('');

    mounted.unmount();
  });

  it('filters dropdown options from input and updates selected tags when an option is clicked', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    });

    const input = mounted.container.querySelector('.tag-search-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    input!.value = 'be';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    const options = mounted.container.querySelectorAll('.tag-dropdown .tag-option');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('#Beta');

    (options[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mounted.selectedTags.value).toEqual(['Beta']);
    expect(mounted.tagQuery.value).toBe('');

    mounted.unmount();
  });

  it('does not style unselected dropdown options as selected', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    });

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const options = mounted.container.querySelectorAll('.tag-dropdown .tag-option');
    expect(options).toHaveLength(2);
    expect(options[0]?.className).not.toContain('tag-chip--selected');
    expect(options[1]?.className).not.toContain('tag-chip--selected');

    mounted.unmount();
  });

  it('keeps the placeholder only when no tags are selected', async () => {
    const emptyMounted = await mountFilterBar({
      searchQuery: '',
      selectedTags: [],
    });

    expect((emptyMounted.container.querySelector('.tag-search-input') as HTMLInputElement | null)?.placeholder).toBe('筛选标签');
    emptyMounted.unmount();

    const selectedMounted = await mountFilterBar({
      searchQuery: '',
      selectedTags: ['Alpha'],
    });

    expect((selectedMounted.container.querySelector('.tag-search-input') as HTMLInputElement | null)?.placeholder).toBe('');
    selectedMounted.unmount();
  });

  it('does not open the dropdown after removing a selected tag chip', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      selectedTags: ['Alpha'],
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    });

    const selectedChip = mounted.container.querySelector('.tag-search-box .tag-chip') as HTMLButtonElement | null;
    expect(selectedChip).not.toBeNull();

    selectedChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.selectedTags.value).toEqual([]);
    expect(mounted.container.querySelector('.tag-dropdown')).toBeNull();

    mounted.unmount();
  });

  it('resets dropdown highlight after removing the only selected tag', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      selectedTags: ['Beta'],
      tagOptions: [
        { name: 'Beta', count: 2 },
        { name: 'Alpha', count: 1 },
      ],
    });

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const optionBeforeRemove = mounted.container.querySelector('.tag-dropdown .tag-option') as HTMLButtonElement | null;
    expect(optionBeforeRemove?.className).toContain('tag-chip--selected');

    const selectedChip = mounted.container.querySelector('.tag-search-box .tag-chip') as HTMLButtonElement | null;
    selectedChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    const optionAfterRemove = mounted.container.querySelector('.tag-dropdown .tag-option') as HTMLButtonElement | null;
    expect(optionAfterRemove?.className).not.toContain('tag-chip--selected');
    expect(optionAfterRemove?.className).not.toContain('tag-option--highlighted');

    mounted.unmount();
  });

  it('removes the last selected tag when backspace is pressed on an empty tag query', async () => {
    const mounted = await mountFilterBar({
      searchQuery: '',
      selectedTags: ['Alpha', 'Beta'],
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    });

    const input = mounted.container.querySelector('.tag-search-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    (mounted.container.querySelector('.tag-search-box') as HTMLDivElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    input!.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
    }));

    expect(mounted.selectedTags.value).toEqual(['Alpha']);

    mounted.unmount();
  });
});
