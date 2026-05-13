import type { RefreshRequestPayload } from '@/utils/eventBus';

type RefreshCoordinatorSnapshot = {
  docIds: string[];
  full: boolean;
  payload?: Record<string, unknown>;
};

type RefreshCoordinatorOptions = {
  runFullRefresh: (payload?: Record<string, unknown>) => Promise<void>;
  runDirectedRefresh: (docIds: string[], payload?: Record<string, unknown>) => Promise<void>;
  applySettingsOnly: (payload?: Record<string, unknown>) => Promise<void> | void;
  emitRefreshCompleted: () => void;
};

function mergePayload(
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
) {
  if (!next) return current;
  return {
    ...(current ?? {}),
    ...next,
  };
}

export function createRefreshCoordinator(options: RefreshCoordinatorOptions) {
  let running = false;
  let pendingFull = false;
  let pendingPayload: Record<string, unknown> | undefined;
  const pendingDocIds = new Set<string>();
  let drainPromise: Promise<void> | null = null;

  function hasPendingWork() {
    return pendingFull || pendingDocIds.size > 0 || pendingPayload !== undefined;
  }

  function mergeRequest(request: RefreshRequestPayload) {
    pendingPayload = mergePayload(pendingPayload, request.payload);

    if (request.type === 'full') {
      pendingFull = true;
      return;
    }

    if (request.type === 'directed') {
      request.docIds.forEach(docId => pendingDocIds.add(docId));
    }
  }

  function consumePending(): RefreshCoordinatorSnapshot {
    const snapshot = {
      docIds: Array.from(pendingDocIds),
      full: pendingFull,
      payload: pendingPayload,
    };

    pendingFull = false;
    pendingPayload = undefined;
    pendingDocIds.clear();

    return snapshot;
  }

  async function drain() {
    if (running) return;

    running = true;
    try {
      while (hasPendingWork()) {
        const snapshot = consumePending();

        if (snapshot.full) {
          await options.runFullRefresh(snapshot.payload);
        } else if (snapshot.docIds.length > 0) {
          await options.runDirectedRefresh(snapshot.docIds, snapshot.payload);
        } else {
          await options.applySettingsOnly(snapshot.payload);
        }

        options.emitRefreshCompleted();
      }
    } finally {
      running = false;
      drainPromise = null;
    }
  }

  return {
    async submit(request: RefreshRequestPayload) {
      mergeRequest(request);
      if (!drainPromise) {
        drainPromise = drain();
      }
      await drainPromise;
    },
    isRunning() {
      return running;
    },
  };
}
