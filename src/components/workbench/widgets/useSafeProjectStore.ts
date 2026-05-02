import { getActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore';

export function useSafeProjectStore() {
  return getActivePinia() ? useProjectStore() : null;
}
