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

  it('commits first-load projects in batches instead of per-item pushes', async () => {
    const store = useProjectStore();
    let releaseParse!: () => void;
    const parseDone = new Promise<void>((resolve) => {
      releaseParse = resolve;
    });

    vi.mocked(MarkdownParser).mockImplementation(function () {
      return {
        parseAllProjectsWithCallback: vi.fn(async (_plugin, onProjectReady) => {
          for (let index = 1; index <= 60; index += 1) {
            onProjectReady({
              id: `doc-${index}`,
              name: `Project ${index}`,
              path: `/docs/${index}`,
              tasks: [],
              habits: [],
            });
          }
          await parseDone;
        }),
      };
    } as any);

    const loadPromise = store.loadProjects({} as any, 'full', []);

    expect(store.loading).toBe(true);
    expect(store.projects).toHaveLength(50);

    releaseParse();
    await loadPromise;

    expect(store.projects).toHaveLength(60);
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
