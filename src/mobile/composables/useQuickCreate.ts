// src/tabs/mobile/composables/useQuickCreate.ts
import { computed, reactive } from 'vue';
import type { Project, Task, PriorityLevel } from '@/types/models';
import { useProjectStore } from '@/stores';
import { createTask, createItem, smartCreate } from '@/utils/quickCreate';

export interface QuickCreateState {
  // UI state
  isOpen: boolean;
  isSubmitting: boolean;

  // Form fields
  content: string;
  selectedProjectId: string | null;
  selectedTaskBlockId: string | null;
  priority: PriorityLevel | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;

  // Context
  contextProjectId: string | null;
  contextTaskBlockId: string | null;
}

export function useQuickCreate() {
  const projectStore = useProjectStore();

  const state = reactive<QuickCreateState>({
    isOpen: false,
    isSubmitting: false,

    content: '',
    selectedProjectId: null,
    selectedTaskBlockId: null,
    priority: null,
    date: null,
    startTime: null,
    endTime: null,

    contextProjectId: null,
    contextTaskBlockId: null,
  });

  // Computed properties
  const projects = computed<Project[]>(() => {
    return projectStore.projects.map(p => ({
      id: p.id,
      name: p.name,
      box: p.box,
    }));
  });

  const tasks = computed<Task[]>(() => {
    if (!state.selectedProjectId) return [];
    const project = projectStore.projects.find(p => p.id === state.selectedProjectId);
    if (!project) return [];
    return project.tasks.map(t => ({
      blockId: t.blockId,
      name: t.name,
    }));
  });

  const canSubmit = computed(() => {
    return state.content.trim() !== '' && !state.isSubmitting;
  });

  const selectedProject = computed(() => {
    return projects.value.find(p => p.id === state.selectedProjectId) || null;
  });

  const selectedTask = computed(() => {
    return tasks.value.find(t => t.blockId === state.selectedTaskBlockId) || null;
  });

  // Actions
  const open = () => {
    state.isOpen = true;
  };

  const close = () => {
    state.isOpen = false;
  };

  const setContext = (context: { projectId?: string; taskBlockId?: string }) => {
    state.contextProjectId = context.projectId || null;
    state.contextTaskBlockId = context.taskBlockId || null;

    // Pre-select if context is provided
    if (context.projectId) {
      state.selectedProjectId = context.projectId;
    }
    if (context.taskBlockId) {
      state.selectedTaskBlockId = context.taskBlockId;
    }
  };

  const reset = () => {
    state.content = '';
    state.selectedProjectId = state.contextProjectId;
    state.selectedTaskBlockId = state.contextTaskBlockId;
    state.priority = null;
    state.date = null;
    state.startTime = null;
    state.endTime = null;
    state.isSubmitting = false;
  };

  const resetAll = () => {
    state.contextProjectId = null;
    state.contextTaskBlockId = null;
    reset();
  };

  const selectProject = (projectId: string | null) => {
    state.selectedProjectId = projectId;
    state.selectedTaskBlockId = null;
  };

  const selectTask = (taskBlockId: string | null) => {
    state.selectedTaskBlockId = taskBlockId;
  };

  const setPriority = (priority: PriorityLevel | null) => {
    state.priority = priority;
  };

  const submit = async (): Promise<boolean> => {
    if (!canSubmit.value) {
      return false;
    }

    state.isSubmitting = true;

    try {
      // Use smartCreate for intelligent task/item creation based on input
      if (state.selectedProjectId) {
        const result = await smartCreate(
          state.content,
          state.selectedProjectId,
          state.selectedTaskBlockId || undefined
        );

        if (!result.success) {
          console.error('Failed to create:', result.message);
          return false;
        }
      } else {
        // Fallback: no project selected
        console.error('No project selected');
        return false;
      }

      reset();
      close();
      return true;
    } catch (error) {
      console.error('Failed to create item:', error);
      return false;
    } finally {
      state.isSubmitting = false;
    }
  };

  return {
    state,
    projects,
    tasks,
    canSubmit,
    selectedProject,
    selectedTask,
    open,
    close,
    setContext,
    reset,
    resetAll,
    selectProject,
    selectTask,
    setPriority,
    submit,
  };
}
