import type {
  EndCondition,
  FocusPlan,
  ItemDateTimeInfo as ModelItemDateTimeInfo,
  ItemStatus,
  PriorityLevel,
  ReminderConfig,
  RepeatRule,
  TimePrecision,
} from '@/types/models';

export type { ItemDateTimeInfo } from '@/types/models';

export interface BlockWriteContext {
  blockId: string;
  protyle?: any;
  nodeElement?: HTMLElement;
  slashRange?: Range;
  slashStartOffset?: number;
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
  suffix?: string;
  newItemContent?: string;
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

export type SlashCommandPatch = {
  type: 'removeSlashCommand';
  suffix?: string;
};

export type BlockPatch =
  | DatePatch
  | StatusPatch
  | PriorityPatch
  | ContentPatch
  | FocusPlanPatch
  | ReminderPatch
  | RecurringPatch
  | SlashCommandPatch;

export type BatchBlockPatch = BlockPatch[];

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
