# Plugin Runtime Lifecycle Design

## Background

Task Assistant currently assumes that plugin reload will also rebuild every open tab, dock, and dialog. Recent debugging shows that assumption is false in SiYuan:

- plugin `onunload()` can complete normally
- a new plugin instance can `onload()` normally
- some old tab or dock views can remain mounted in detached VM contexts
- those old views may keep old Vue app state, old Pinia stores, old event subscriptions, and old closures

This causes inconsistent behavior:

- directed refresh can degrade into stale listeners reacting from old contexts
- a stale calendar tab can stop auto-refreshing after document edits
- manual refresh from that same stale tab can still pull latest data, because the stale view can still call store refresh directly
- dialog actions like "open document" can fail when they read `plugin-null` from outdated global state

The current `usePlugin()` + `getSharedPinia()` model is not strong enough to represent runtime replacement, stale views, and strict invalidation rules.

## Problem Statement

The plugin needs an explicit runtime model that:

1. survives plugin replacement cleanly
2. gives all consumers a single source of truth for current runtime dependencies
3. lets views know whether they belong to the active runtime
4. enforces strict stale invalidation for old tabs, docks, and dialogs
5. prevents old contexts from continuing to read stores, subscribe to refresh events, or trigger host actions after runtime replacement

## Goals

- Introduce a unified runtime container for plugin lifecycle dependencies.
- Introduce explicit `viewContext` / `dialogContext` identity objects.
- Make stale views fail closed after runtime replacement.
- Centralize access to plugin, app, Pinia, stores, eventBus, and BroadcastChannel.
- Stop using scattered implicit globals as the primary dependency model.
- Make stale-state behavior deterministic and testable.

## Non-Goals

- Preserve backward-compatible behavior where stale views remain partially usable.
- Fully redesign every store or service in the same change.
- Eliminate all existing utility wrappers in one step.
- Automatically migrate stale view UI state into a fresh runtime.

## User Experience Policy

This design uses **strict invalidation**.

When runtime is replaced:

- old tabs and docks become stale
- old dialogs become stale
- stale contexts stop processing refreshes, store updates, and host actions
- stale dialogs close immediately or refuse further interaction
- stale tabs and docks show an overlay with:
  - a stale-state explanation
  - a "reopen view" action

This policy prefers deterministic lifecycle boundaries over partial continued behavior.

## Design Overview

The solution uses a **two-layer model**:

1. **Singleton runtime container**
   - owns current plugin runtime state
   - handles injection, replacement, disposal, and dependency access

2. **Explicit context objects**
   - each tab, dock, and dialog is created with a context identity
   - context identity is validated against the active runtime before any sensitive operation

This prevents old views from silently borrowing new runtime dependencies after replacement.

## Architecture

### 1. `pluginRuntime`

Add a dedicated runtime module, for example:

- `src/runtime/pluginRuntime.ts`

Responsibilities:

- hold the current runtime record
- expose current runtime epoch and instance id
- install a new runtime on plugin `onload()`
- replace the previous runtime on reload
- dispose the runtime on `onunload()`
- expose typed accessors for shared dependencies
- manage stale-state checks

Runtime record fields:

- `plugin`
- `app`
- `pinia`
- `eventBus`
- `broadcast`
- `instanceId`
- `epoch`
- `state` (`active`, `disposing`, `disposed`)
- optional debug metadata

Core API:

- `installRuntime(plugin)`
- `replaceRuntime(plugin)`
- `disposeRuntime(instanceId?)`
- `getRuntime()`
- `getRuntimeOrThrow()`
- `getCurrentInstanceId()`
- `getCurrentEpoch()`
- `isRuntimeActive(instanceId | epoch)`

### 2. `hostApi`

Add a dedicated host action layer, for example:

- `src/runtime/hostApi.ts`

Responsibilities:

- wrap SiYuan host actions
- always resolve through active runtime
- reject calls from stale contexts
- provide a narrow interface to the rest of the codebase

Representative API:

- `openDocument(context, docId)`
- `openDocumentAtLine(context, docId, lineNumber?, blockId?)`
- `openCustomTab(context, type, options?)`
- `showMessage(context, text, timeout?, type?)`
- `broadcastRefresh(context, payload?)`

`hostApi` should never read global plugin state directly. It must go through `pluginRuntime`.

### 3. `runtimeStores`

Add a store access layer, for example:

- `src/runtime/runtimeStores.ts`

Responsibilities:

- provide current runtime-bound store accessors
- prevent direct dependency on scattered `getSharedPinia()` calls
- fail when called from stale contexts

Representative API:

- `getProjectStore(context)`
- `getSettingsStore(context)`
- `getPomodoroStore(context)`
- `getAIStore(context)`

All of these should internally resolve store instances from the current runtime Pinia.

### 4. `viewContext` and `dialogContext`

Add context factories, for example:

- `src/runtime/viewContext.ts`

Each context should contain:

- `kind` (`tab`, `dock`, `dialog`)
- `name`
- `createdAtEpoch`
- `createdByInstanceId`
- `contextId`
- optional `reopenAction`
- optional debug location info

Core API:

- `createViewContext(kind, name, options?)`
- `createDialogContext(name, options?)`
- `isContextStale(context)`
- `assertContextActive(context)`

Strict invalidation rule:

- if `context.createdAtEpoch !== runtime.currentEpoch`, the context is stale

### 5. `staleViewGuard`

Add a reusable guard for long-lived UI surfaces.

Responsibilities:

- watch runtime epoch changes
- mark local view state stale
- stop event handlers, timers, and refresh subscriptions
- expose a stale-state flag for overlay rendering

Representative behavior:

- tabs and docks listen for runtime replacement
- when stale, they:
  - unsubscribe eventBus listeners
  - close BroadcastChannel listeners
  - stop timers
  - block refresh and host actions
  - render stale overlay

## Lifecycle Rules

### Plugin `onload()`

1. create new Pinia
2. initialize runtime with new plugin/app/pinia
3. register tabs and docks
4. mount views with `viewContext`
5. all mounted views resolve dependencies through runtime-aware APIs

### Plugin reload / replacement

1. old runtime enters `disposing`
2. replacement runtime is installed with new epoch
3. runtime replacement event is emitted
4. stale guards in old views detect epoch mismatch
5. old views detach from event sources and enter stale state

### Plugin `onunload()`

1. runtime enters `disposing`
2. unload event is emitted
3. runtime-managed listeners and broadcasts are closed
4. runtime state is marked `disposed`

The design intentionally does **not** depend on SiYuan to destroy old tabs or docks correctly.

## Store Strategy

### Current issue

Today, tabs can hold old Pinia and old store references indefinitely if the Vue app is not remounted.

### New rule

- views must not treat directly captured store references as permanently valid
- long-lived actions must go through `runtimeStores`
- stale views must stop reading and mutating stores

Implementation note:

- initial migration can keep local store variables in active views
- but any refresh, reload, or host-driven action path must validate context before store use
- final target is runtime-mediated store access everywhere that matters across lifecycle boundaries

## EventBus Strategy

Current problem:

- old VM-local event buses can remain alive
- old listeners can keep running in detached views

New rule:

- eventBus becomes part of runtime state
- subscription helpers require context
- runtime replacement invalidates all old-context subscriptions

Representative helper:

- `runtimeEvents.on(context, event, handler)`

Behavior:

- if context is stale, subscription is rejected
- if runtime is replaced later, the subscription auto-disposes

## BroadcastChannel Strategy

Current problem:

- old views can keep listening on `BroadcastChannel`
- old contexts may react after runtime replacement

New rule:

- BroadcastChannel ownership is runtime-scoped
- channel listeners must be created through runtime helpers
- old contexts close listeners immediately on stale detection

Representative helper:

- `runtimeBroadcast.subscribe(context, channelName, handler)`

Behavior:

- runtime replacement closes old subscriptions
- stale contexts cannot create new subscriptions

## Tab, Dock, and Dialog Policy

### Tab / Dock

When stale:

- content area shows overlay
- overlay text explains that plugin has reloaded and current view is stale
- overlay provides "reopen current view"
- all actions beneath overlay are blocked

### Dialog

When stale:

- dialog closes automatically if possible
- if closure is not immediate, actions are disabled and stale message is shown

### Reopen action

Each context may optionally carry a reopen descriptor:

- tab type
- dock type
- navigation options

`hostApi.reopenContext(context)` can use that descriptor to reopen the fresh view through the active runtime.

## Migration Plan

### Phase 1: Runtime skeleton

- add `pluginRuntime`
- add runtime epoch / instance id management
- move current plugin and Pinia ownership into runtime
- keep old compatibility helpers temporarily

### Phase 2: Context model

- add `viewContext` / `dialogContext`
- create contexts in tabs, docks, and dialogs
- add stale assertion helpers

### Phase 3: Host actions

- migrate `openDocument`
- migrate `openDocumentAtLine`
- migrate `openCustomTab`
- migrate `showMessage`

### Phase 4: Event and broadcast ownership

- move eventBus subscription helpers behind runtime
- move BroadcastChannel helpers behind runtime
- invalidate old listeners on runtime replacement

### Phase 5: Store access hardening

- move critical store access behind `runtimeStores`
- remove direct lifecycle-sensitive `getSharedPinia()` usage from long-lived surfaces

### Phase 6: Compatibility cleanup

- reduce `usePlugin()` to compatibility-only paths
- remove obsolete guard layers made redundant by runtime
- prune temporary debug logs after verification

## Testing Strategy

### Unit tests

Add tests for:

- runtime install / replace / dispose
- context stale detection
- host action rejection on stale context
- auto-disposal of runtime event subscriptions
- BroadcastChannel invalidation behavior

### Integration tests

Add targeted tests for:

- stale calendar tab after runtime replacement
- stale dock after runtime replacement
- dialog opened before replacement then interacted with after replacement
- strict invalidation overlay rendering

### Manual verification

Scenarios to verify:

1. open calendar tab
2. reload plugin
3. old calendar tab shows stale overlay
4. document changes no longer auto-refresh stale tab
5. stale tab cannot trigger host actions
6. stale tab can reopen a fresh calendar tab
7. fresh calendar tab behaves normally

## Risks

### 1. Migration breadth

Many modules currently reach for `usePlugin()` or `getSharedPinia()` directly. Migration must be incremental.

### 2. Mixed dependency modes during transition

There will be a period where some modules use runtime while others use legacy globals. During that window, behavior may remain inconsistent if boundaries are not explicit.

### 3. Overgrown runtime

If runtime becomes a generic dumping ground, maintainability will regress. Keep lifecycle, host actions, and store access in separate modules under a shared runtime namespace.

## Recommendation

Proceed with the runtime refactor using the **singleton runtime + explicit context** model and **strict invalidation** policy.

This is the clearest way to make plugin reload behavior deterministic in the presence of lingering tab, dock, and dialog contexts that SiYuan does not reliably rebuild.

## Open Questions Resolved

- Scope: full runtime ownership including plugin, stores, eventBus, BroadcastChannel, and stale policy
- invalidation strategy: strict invalidation
- model choice: singleton runtime plus explicit context identities
- stale recovery default:
  - tab/dock: overlay + reopen action
  - dialog: close by default
