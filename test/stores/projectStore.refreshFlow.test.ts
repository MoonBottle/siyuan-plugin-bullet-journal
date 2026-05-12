import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';
import { MarkdownParser } from '@/parser/markdownParser';

vi.mock('@/parser/markdownParser', () => ({
  MarkdownParser: vi.fn(),
}));

describe('projectStore refresh flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('keeps previous projects visible until full refresh completes', async () => {
    const store = useProjectStore();
    store.projects = [
      { id: 'old-doc', name: 'Old Project', path: '/old', tasks: [], habits: [] } as any,
    ];

    vi.mocked(MarkdownParser).mockImplementation(function () {
      return {
      parseAllProjectsWithCallback: vi.fn(async (_plugin, onProjectReady) => {
        await Promise.resolve();
        onProjectReady({
          id: 'new-doc',
          name: 'New Project',
          path: '/new',
          tasks: [],
          habits: [],
        });
      }),
      };
    } as any);

    const refreshPromise = store.refreshFull({} as any, 'full', []);

    expect(store.projects.map(project => project.id)).toEqual(['old-doc']);

    await refreshPromise;

    expect(store.projects.map(project => project.id)).toEqual(['new-doc']);
  });

  it('removes projects when directed refresh no longer returns a document', async () => {
    const store = useProjectStore();
    store.projects = [
      { id: 'doc-1', name: 'Old Project', path: '/old', tasks: [], habits: [] } as any,
    ];

    vi.mocked(MarkdownParser).mockImplementation(function () {
      return {
      parseAndProcessSingleDocument: vi.fn(async () => null),
      };
    } as any);

    await store.refreshDirtyDocs({} as any, 'full', [], ['doc-1']);

    expect(store.projects).toEqual([]);
  });
});
