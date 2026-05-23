import type {
  EndCondition,
  FocusPlan,
  Habit,
  HabitRecordStatus,
  ItemDateTimeInfo as ModelItemDateTimeInfo,
  ItemStatus,
  PriorityLevel,
  ReminderConfig,
  RepeatRule,
  TimePrecision,
} from '@/types/models';
import type { HabitCheckInTimePrecision } from '@/settings/types';

export type { ItemDateTimeInfo } from '@/types/models';

export interface BlockWriteContext {
  blockId: string;
  listItemBlockId?: string;
  protyle?: any;
  nodeElement?: HTMLElement;
  slashRange?: Range;
  slashStartOffset?: number;
  slashEndOffset?: number;
}

export type DatePatch = {
  type: 'addDate';
  date: string;
  originalDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  timePrecision?: TimePrecision;
  siblingItems?: ModelItemDateTimeInfo[];
  status?: ItemStatus;
};

export type StatusPatch = {
  type: 'setStatus';
  status: ItemStatus;
};

export type PriorityPatch = {
  type: 'setPriority';
  priority: PriorityLevel | undefined;
};

export type ContentPatch = {
  type: 'setContent';
  newItemContent?: string;
};

export type TaskTagPatch = {
  type: 'setTaskTag';
  tag?: string;
};

export type FocusPlanPatch = {
  type: 'setFocusPlan';
  plan?: Pick<FocusPlan, 'type' | 'rawValue'>;
};

export type ReminderPatch = {
  type: 'setReminder';
  reminder?: ReminderConfig;
};

export type RecurringPatch = {
  type: 'setRecurring';
  repeatRule?: RepeatRule;
  endCondition?: EndCondition;
};

export type PinnedPatch = {
  type: 'togglePinned';
  pinned?: boolean;
};

export type SlashCommandPatch = {
  type: 'removeSlashCommand';
};

export type HabitDefinitionPatch = {
  type: 'setHabitDefinition';
  habit: Partial<Habit>;
};

export type HabitRecordPatch = {
  type: 'setHabitRecord';
  record: {
    content: string;
    habitType: Habit['type'];
    date: string;
    value?: number;
    target?: number;
    unit?: string;
    precision?: HabitCheckInTimePrecision;
    recordStatus?: HabitRecordStatus;
  };
};

export type HabitArchivePatch = {
  type: 'setHabitArchive';
  archivedAt?: string;
};

export type ReplaceMarkdownPatch = {
  type: 'replaceMarkdown';
  markdown: string;
  preserveIAL?: boolean;
};

export type BlockPatch =
  | DatePatch
  | StatusPatch
  | PriorityPatch
  | TaskTagPatch
  | ContentPatch
  | FocusPlanPatch
  | ReminderPatch
  | RecurringPatch
  | PinnedPatch
  | SlashCommandPatch
  | HabitDefinitionPatch
  | HabitRecordPatch
  | HabitArchivePatch
  | ReplaceMarkdownPatch;

export type BatchBlockPatch = BlockPatch[];
export type InsertableBlockPatch = HabitDefinitionPatch | HabitRecordPatch | ReplaceMarkdownPatch;
export type BlockMutationIntent =
  | {
      kind: 'update';
      context: BlockWriteContext;
      patches: BlockPatch[];
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      patch: InsertableBlockPatch;
      context?: Partial<BlockWriteContext>;
      resultMode: 'boolean' | 'operations';
    };
export type ResolvedMutationPlan =
  | {
      kind: 'update';
      targetBlockId: string;
      targetKind: 'paragraph' | 'task-list-item' | 'block';
      sourceKind: 'protyle-dom' | 'api-kramdown';
      sourceBlockId?: string;
      commitKind: 'protyle-update' | 'api-update';
      preferDataType: 'dom';
      fallbackDataType: 'markdown';
      context: BlockWriteContext;
      patches: BlockPatch[];
      datePatchSource?: DatePatchSourceContext;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      commitKind: 'api-insert';
      preferDataType: 'dom';
      fallbackDataType: 'markdown';
      patch: InsertableBlockPatch;
      context?: Partial<BlockWriteContext>;
      resultMode: 'boolean' | 'operations';
    };
export type CaretSnapshot =
  | {
      policy: 'wbr-first';
      containerBlockId: string;
      clonedHtmlWithWbr?: string;
      fallbackOffset?: {
        start: number;
        end: number;
      };
    }
  | {
      policy: 'none';
    };
export type LoadedMutationSource =
  | {
      kind: 'update';
      targetBlockId: string;
      sourceBlockId?: string;
      currentMarkdown: string;
      currentDomHtml?: string;
      targetElement?: HTMLElement;
      paragraphElement?: HTMLElement;
      caretSnapshot?: CaretSnapshot;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
    };
export interface CaretRestorePlan {
  policy: 'none' | 'wbr';
  placement?: 'after-inserted-text' | 'after-inline' | 'placeholder-anchor' | 'block-end' | 'line-end';
  anchorText?: string;
  targetOffset?: number;
  lineIndex?: number;
  fallbackOffset?: {
    start: number;
    end: number;
  };
}

export interface DatePatchSourceContext {
  originalBlockId: string;
  sourceBlockId: string;
  sourceMarkdown: string;
  targetItemBlockRaw: string | null;
  usedParentDocumentContext: boolean;
  finalTargetBlockId: string;
}

export type PreparedMutationPayload =
  | {
      kind: 'update';
      targetBlockId: string;
      nextMarkdown: string;
      preferredDataType: 'dom';
      domHtml?: string;
      transactionDomHtml?: string;
      fallbackMarkdown: string;
      oldDomHtml?: string;
      targetElement?: HTMLElement;
      caretRestorePlan?: CaretRestorePlan;
    }
  | {
      kind: 'insertAfter';
      anchorBlockId: string;
      preferredDataType: 'dom';
      domHtml?: string;
      fallbackMarkdown: string;
      resultMode: 'boolean' | 'operations';
      caretRestorePlan?: CaretRestorePlan;
    };

export interface KramdownBlockParts {
  contentLines: string[];
  ialLines: string[];
  raw: string;
}

export interface ResolvedBlockTarget {
  originalBlockId: string;
  targetBlockId: string;
  targetType?: string;
  targetSubType?: string;
  fullKramdown: string;
  targetRaw: string;
  parts: KramdownBlockParts;
  replaceMode: 'whole-block' | 'raw-within-parent';
}

export interface MutationPatchUnit {
  index: number;
  patch: BlockPatch;
  intentKind: 'update' | 'insertAfter';
  atomicGroup?: string;
}

export interface MutationPatchCapability {
  unit: MutationPatchUnit;
  targetBlockId?: string;
  targetKind?: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: 'protyle-dom' | 'api-kramdown';
  sourceBlockId?: string;
  commitKind: 'protyle-update' | 'api-update' | 'api-insert';
  preferredCaretPolicy: 'none' | 'wbr';
  canSharePlan: boolean;
  requiresCurrentDom: boolean;
  canFallbackToApi: boolean;
  datePatchSource?: DatePatchSourceContext;
}

export interface MutationExecutionPlan {
  id: string;
  kind: 'update' | 'insertAfter';
  resolvedPlan: ResolvedMutationPlan;
  targetBlockId?: string;
  targetKind?: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: 'protyle-dom' | 'api-kramdown';
  sourceBlockId?: string;
  commitKind: 'protyle-update' | 'api-update' | 'api-insert';
  caretPolicy: 'none' | 'wbr';
  caretOwner: boolean;
  units: MutationPatchUnit[];
  order: number;
  atomicBoundary: 'single-commit' | 'split-subplan';
  context?: BlockWriteContext | Partial<BlockWriteContext>;
  anchorBlockId?: string;
  resultMode?: 'boolean' | 'operations';
  datePatchSource?: DatePatchSourceContext;
  apiFallbackPlan?: {
    sourceKind: 'api-kramdown';
    sourceBlockId: string;
    commitKind: 'api-update';
  };
}

export interface MutationPlannerResult {
  plans: MutationExecutionPlan[];
  reason:
    | 'single-plan'
    | 'split-by-target'
    | 'split-by-source'
    | 'split-by-commit-kind'
    | 'split-by-intent-kind';
}
