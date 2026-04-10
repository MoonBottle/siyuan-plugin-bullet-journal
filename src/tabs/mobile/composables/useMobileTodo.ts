// src/tabs/mobile/composables/useMobileTodo.ts
import { ref, computed, reactive } from 'vue';
import type { Item, PriorityLevel } from '@/types/models';

export interface DateRange {
  start: string;
  end: string;
}

export interface MobileTodoState {
  // Search & filters
  searchQuery: string;
  selectedGroup: string;
  dateFilterType: 'today' | 'week' | 'all' | 'custom';
  dateRange: DateRange | null;
  selectedPriorities: PriorityLevel[];
  
  // UI state
  showFilterDrawer: boolean;
  showActionDrawer: boolean;
  showItemDetail: boolean;
  showQuickCreate: boolean;
  showProjectDetail: boolean;
  showTaskDetail: boolean;
  
  // Selected items
  selectedItem: Item | null;
  selectedProjectId: string | null;
  selectedTaskBlockId: string | null;
}

const state = reactive<MobileTodoState>({
  searchQuery: '',
  selectedGroup: '',
  dateFilterType: 'today',
  dateRange: null,
  selectedPriorities: [],
  
  showFilterDrawer: false,
  showActionDrawer: false,
  showItemDetail: false,
  showQuickCreate: false,
  showProjectDetail: false,
  showTaskDetail: false,
  
  selectedItem: null,
  selectedProjectId: null,
  selectedTaskBlockId: null,
});

export function useMobileTodo() {
  const hasActiveFilters = computed(() => {
    return state.selectedGroup !== '' ||
           state.searchQuery !== '' ||
           state.dateFilterType !== 'today' ||
           state.selectedPriorities.length > 0;
  });

  const togglePriority = (priority: PriorityLevel) => {
    const index = state.selectedPriorities.indexOf(priority);
    if (index > -1) {
      state.selectedPriorities.splice(index, 1);
    } else {
      state.selectedPriorities.push(priority);
    }
  };

  const resetFilters = () => {
    state.selectedGroup = '';
    state.searchQuery = '';
    state.dateFilterType = 'today';
    state.dateRange = null;
    state.selectedPriorities = [];
  };

  const openActionDrawer = (item: Item) => {
    state.selectedItem = item;
    state.showActionDrawer = true;
  };

  const openItemDetail = (item: Item) => {
    state.selectedItem = item;
    state.showItemDetail = true;
  };

  const openQuickCreate = (context?: { projectId?: string; taskBlockId?: string }) => {
    if (context?.projectId) {
      state.selectedProjectId = context.projectId;
    }
    if (context?.taskBlockId) {
      state.selectedTaskBlockId = context.taskBlockId;
    }
    state.showQuickCreate = true;
  };

  return {
    state,
    hasActiveFilters,
    togglePriority,
    resetFilters,
    openActionDrawer,
    openItemDetail,
    openQuickCreate,
  };
}
