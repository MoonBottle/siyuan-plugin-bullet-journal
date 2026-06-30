import {
  eventBus,
  Events,
} from '@/utils/eventBus'

export type RefreshRequestPayload
  = | { type: 'settings-only', payload?: Record<string, unknown> }
    | { type: 'directed', docIds: string[], reason?: string, payload?: Record<string, unknown> }
    | { type: 'full', reason: string, payload?: Record<string, unknown> }

export const RefreshReasons = {
  ON_DATA_CHANGED: 'onDataChanged',
  LOCAL_MUTATION: 'local-mutation',
  LOCAL_MUTATION_MISSING_BLOCK_ID: 'local-mutation-missing-block-id',
  LOCAL_MUTATION_UNRESOLVED_DOC: 'local-mutation-unresolved-doc',
  INDEX_SET_PROJECT_DIRECTORIES: 'index:set-project-directories',
  INDEX_CREATE_NEXT_OCCURRENCE: 'index:create-next-occurrence',
  REMOVE_DOC: 'removeDoc',
  SLASH_COMMAND_HABIT_DATA: 'slash-command:habit-data',
  SLASH_COMMAND_SET_PROJECT_DIR: 'slash-command:set-project-dir',
  SETTINGS_DIALOG_SAVE: 'settings-dialog:save',
  AI_TOOLS_CREATE_PROJECT_DOC: 'ai-tools:create-project-doc',
  POMODORO_STORE_SAVE_RECORD: 'pomodoro-store:save-record',
} as const

export const WS_MAIN_FULL_REFRESH_COMMANDS = [
  'txerr',
  'refreshdoc',
  'createdailynote',
  'moveDoc',
] as const

export function isWsMainFullRefreshCommand(cmd?: string): cmd is typeof WS_MAIN_FULL_REFRESH_COMMANDS[number] {
  return typeof cmd === 'string' && WS_MAIN_FULL_REFRESH_COMMANDS.includes(
    cmd as typeof WS_MAIN_FULL_REFRESH_COMMANDS[number],
  )
}

export function createWsMainFullRefreshReason(cmd: typeof WS_MAIN_FULL_REFRESH_COMMANDS[number]): string {
  return cmd
}

export function createMissingRootIdsRefreshReason(cmd?: string): string {
  return `${cmd || 'ws-main'}:missing-rootIDs`
}

export function createWsMainDirectedRefreshReason(cmd?: string): string {
  return cmd || 'ws-main-directed'
}

export function createSettingsOnlyRefreshRequest(
  payload?: Record<string, unknown>,
): RefreshRequestPayload {
  return payload === undefined
    ? { type: 'settings-only' }
    : {
        type: 'settings-only',
        payload,
      }
}

export function createDirectedRefreshRequest(
  docIds: string[],
  options?: { reason?: string, payload?: Record<string, unknown> },
): RefreshRequestPayload {
  const request: RefreshRequestPayload = {
    type: 'directed',
    docIds,
  }

  if (options?.reason) {
    request.reason = options.reason
  }
  if (options?.payload) {
    request.payload = options.payload
  }

  return request
}

export function createFullRefreshRequest(
  reason: string,
  payload?: Record<string, unknown>,
): RefreshRequestPayload {
  return payload === undefined
    ? {
        type: 'full',
        reason,
      }
    : {
        type: 'full',
        reason,
        payload,
      }
}

export function submitRefreshRequest(request: RefreshRequestPayload): void {
  eventBus.emit(Events.REFRESH_REQUEST_SUBMITTED, request)
}
