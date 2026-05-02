import type { TodoSortRule } from '@/settings';
import type { PriorityLevel } from '@/types/models';
import type { TodoDateFilterType } from '@/utils/todoDateFilter';

export interface TodoViewPreset {
  groupId?: string;
  dateFilterType?: TodoDateFilterType;
  startDate?: string;
  endDate?: string;
  priorities?: PriorityLevel[];
  searchQuery?: string;
  sortRules?: TodoSortRule[];
}

export interface TodoViewStateOptions {
  preset?: TodoViewPreset;
  persistToSettings?: boolean;
}
