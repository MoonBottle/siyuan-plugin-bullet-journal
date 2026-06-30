import { ref } from 'vue'

export function useSwipeActions() {
  const isSwiping = ref(false)

  return {
    isSwiping,
  }
}
