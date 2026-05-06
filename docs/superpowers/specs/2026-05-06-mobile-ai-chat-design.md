# Mobile AI Chat Design

## Summary

This spec adapts AI chat for the mobile shell instead of reusing the desktop dock UI. The mobile experience promotes AI chat to a first-level tab in `MobileMainShell`, replaces the desktop conversation dropdown with a dedicated full-screen history page, and keeps desktop `AiChatDock` behavior unchanged.

The design stays conservative on data flow: mobile reuses the existing `aiStore`, `ChatPanel`, and conversation storage APIs. Only the mobile shell, mobile AI navigation, and mobile conversation history UI are new.

## Goals

- Add AI chat as a formal mobile tab in `MobileMainShell`
- Replace dropdown-style conversation navigation with a mobile-first history page
- Keep existing conversation persistence, switching, creation, deletion, and clearing logic
- Preserve the earlier mobile rule that WeChat/ClawBot conversations stay hidden and disabled on mobile

## Non-Goals

- No redesign of desktop `AiChatDock`
- No change to AI provider configuration or message-generation logic
- No system-back interception beyond in-component back navigation
- No new search, grouping, pinning, or batch actions in conversation history

## Current State

- `MobileMainShell` currently manages `todo / pomodoro / habit / more`
- AI chat still lives in `AiChatDock.vue`, which is shaped like a desktop dock with a compact toolbar and `ConversationSelect`
- Mobile already has a separate shell pattern for todo and habit, so adding a dedicated mobile AI panel fits the current architecture
- `aiStore` already exposes everything the mobile flow needs: `getConversationsList`, `createConversation`, `switchConversation`, `deleteConversation`, `clearCurrentConversation`, current conversation state, and mobile-safe conversation filtering

## Proposed UX

### Mobile top-level navigation

Promote AI chat to a first-level tab in the bottom tab bar:

- `todo`
- `ai`
- `pomodoro`
- `habit`
- `more`

AI is not nested under `more`. It becomes a peer to the other mobile work surfaces.

### AI chat page structure

Add a dedicated `MobileAiPanel` that manages two internal views:

- `chat`
- `history`

The default view is `chat`.

### Chat view

The mobile chat view contains:

- top-left: entry button for conversation history
- center: current conversation title
- top-right: new conversation button
- top-right overflow: actions such as clearing the current conversation
- main body: shared `ChatPanel`

This is page-style navigation, not a compact desktop toolbar.

### History view

The history view is a full-screen list page inside the AI tab:

- top-left: back button to return to `chat`
- top-center: page title
- full list of mobile-visible conversations
- current conversation highlighted
- per-row delete action on the right side

This is a full-page transition within the panel, not a drawer or bottom sheet.

## Interaction Rules

### First entry into AI tab

- Enter `chat` view by default
- If there is no current conversation and no conversation list entry, create a default conversation immediately
- If there is already a current conversation, show it directly

### Open history

- Tapping the top-left history button switches `viewMode` from `chat` to `history`
- Refresh the conversation list before rendering history so the list reflects recent creation/deletion

### Select a conversation

- Call `aiStore.switchConversation(conversationId)`
- On success, switch back to `chat`
- The title and `ChatPanel` content update to the selected conversation

### Create a conversation

- Trigger from the chat header plus button
- Call `aiStore.createConversation(defaultTitle)`
- Stay in `chat`
- Refresh history metadata after creation

### Delete a conversation

- Trigger from the history list row action
- Call `aiStore.deleteConversation(conversationId)`
- Then refresh the list
- If the deleted conversation was current and another conversation remains, show the new current conversation
- If the list becomes empty, create a default conversation and return to `chat`

### Clear current conversation

- Keep this in the chat header overflow menu
- Reuse `aiStore.clearCurrentConversation()`
- Do not expose clear from the history page

### Return behavior

- History back button only returns to `chat`
- It does not leave the AI tab
- Native/device back handling is out of scope for this change

### Empty states

- History page may render an empty state with a create button as a defensive fallback
- In normal flow, an empty conversation state should be short-lived because the panel auto-creates a default conversation

### WeChat conversations

- Continue hiding them on mobile via `aiStore` filtering
- Do not expose WeChat entries, badges, or routing inside mobile AI history

## Architecture and Boundaries

### Reused parts

- `aiStore`
- `ChatPanel`
- conversation storage service
- existing conversation CRUD and switching behavior

### New mobile-specific parts

- mobile AI tab integration in `MobileMainShell`
- mobile AI header/navigation shell
- dedicated mobile conversation history page
- local `chat/history` view-state management

### Desktop-only parts remain desktop-only

- `AiChatDock.vue`
- `ConversationSelect.vue`

The mobile path should not add further branching into `AiChatDock` beyond what already exists.

## File-Level Direction

### Expected modified files

- `src/mobile/MobileMainShell.vue`
- `src/utils/mobileMainShellNavigation.ts`
- the mobile bottom tab bar component used by `MobileMainShell`

### Expected new files

- `src/mobile/panels/MobileAiPanel.vue`
- `src/mobile/components/ai/MobileAiConversationListPage.vue`

## State Model

`MobileAiPanel` should own a local state similar to:

- `viewMode: 'chat' | 'history'`
- `conversationsList`
- `isLoadingHistory`

The source of truth for active conversation remains `aiStore.currentConversation` and `aiStore.currentConversationId`. The panel should not duplicate full conversation state.

## Testing and Acceptance

### Component tests

- `MobileMainShell` renders AI as a formal mobile tab
- switching to AI mounts the mobile AI panel
- mobile AI panel auto-creates a default conversation when needed
- tapping history enters the full-screen history view
- selecting a history item switches conversation and returns to chat
- deleting the active conversation falls back correctly

### Regression expectations

- desktop `AiChatDock` continues using `ConversationSelect`
- mobile does not render the desktop dropdown interaction
- mobile history does not include WeChat conversations
- previously completed mobile ClawBot disable behavior stays intact

## Risks and Constraints

- `ChatPanel` may carry desktop layout assumptions; if so, adapt the mobile shell around it before changing shared chat content
- bottom tab bar width becomes tighter with one more primary tab, so label/icon density must stay readable on narrow screens
- this feature should avoid a large shared “universal AI shell” abstraction; mobile and desktop are intentionally different enough to keep separate shells

## Chosen Defaults

- AI is a first-level mobile tab
- conversation history is a dedicated full-screen page
- mobile AI reuses `ChatPanel` and store logic instead of rewriting the chat body
- mobile WeChat conversations remain hidden and unsupported
