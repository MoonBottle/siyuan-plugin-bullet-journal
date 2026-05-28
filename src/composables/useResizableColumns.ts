import type { Ref } from 'vue'
import {
  computed,
  onUnmounted,
  ref,

} from 'vue'

interface ResizableColumnsOptions {
  containerRef: Ref<HTMLElement | undefined>
  initialRatios?: [number, number, number]
  handleWidth?: number
  onChange?: (ratios: [number, number, number]) => void
}

const DEFAULT_RATIOS: [number, number, number] = [20, 20, 60]
const MIN_RATIOS: [number, number, number] = [10, 15, 30]

function clampRatios(
  ratios: [number, number, number],
  handleIndex: number,
): [number, number, number] {
  const result = [...ratios] as [number, number, number]
  const leftIdx = handleIndex
  const rightIdx = handleIndex + 1

  if (result[leftIdx] < MIN_RATIOS[leftIdx]) {
    const deficit = MIN_RATIOS[leftIdx] - result[leftIdx]
    result[leftIdx] = MIN_RATIOS[leftIdx]
    result[rightIdx] -= deficit
  }

  if (result[rightIdx] < MIN_RATIOS[rightIdx]) {
    const deficit = MIN_RATIOS[rightIdx] - result[rightIdx]
    result[rightIdx] = MIN_RATIOS[rightIdx]
    result[leftIdx] -= deficit
  }

  if (result[leftIdx] < MIN_RATIOS[leftIdx]) {
    result[leftIdx] = MIN_RATIOS[leftIdx]
  }

  return result
}

export function useResizableColumns(options: ResizableColumnsOptions) {
  const handleWidth = options.handleWidth ?? 16
  const ratios = ref<[number, number, number]>(options.initialRatios ?? [...DEFAULT_RATIOS])
  const activeHandleIndex = ref(-1)

  const gridTemplateColumns = computed<string>(() => {
    const [a, b, c] = ratios.value
    return `${a}fr ${handleWidth}px ${b}fr ${handleWidth}px ${c}fr`
  })

  function setRatios(newRatios: [number, number, number]) {
    ratios.value = [...newRatios]
  }

  function reset() {
    ratios.value = [...DEFAULT_RATIOS]
  }

  let currentMouseMove: ((e: MouseEvent) => void) | null = null
  let currentMouseUp: (() => void) | null = null
  let rafId: number | null = null
  let latestMouseEvent: MouseEvent | null = null

  function onMouseDown(e: MouseEvent, handleIndex: number) {
    e.preventDefault()

    const container = options.containerRef.value
    if (!container) return

    const startX = e.clientX
    const startRatios = [...ratios.value] as [number, number, number]
    const containerWidth = container.offsetWidth
    const availableWidth = containerWidth - 2 * handleWidth

    if (availableWidth <= 0) return

    activeHandleIndex.value = handleIndex

    currentMouseMove = (e: MouseEvent): void => {
      latestMouseEvent = e
      if (rafId !== null) return

      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!latestMouseEvent) return

        const deltaX = latestMouseEvent.clientX - startX
        const deltaPercent = (deltaX / availableWidth) * 100

        let newRatios: [number, number, number]

        if (handleIndex === 0) {
          newRatios = [
            startRatios[0] + deltaPercent,
            startRatios[1] - deltaPercent,
            startRatios[2],
          ]
        } else {
          newRatios = [
            startRatios[0],
            startRatios[1] + deltaPercent,
            startRatios[2] - deltaPercent,
          ]
        }

        ratios.value = clampRatios(newRatios, handleIndex)
        latestMouseEvent = null
      })
    }

    currentMouseUp = (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      latestMouseEvent = null
      document.removeEventListener('mousemove', currentMouseMove!)
      document.removeEventListener('mouseup', currentMouseUp!)
      currentMouseMove = null
      currentMouseUp = null
      activeHandleIndex.value = -1
      options.onChange?.([...ratios.value])
    }

    document.addEventListener('mousemove', currentMouseMove)
    document.addEventListener('mouseup', currentMouseUp)
  }

  function cleanup() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (currentMouseMove) {
      document.removeEventListener('mousemove', currentMouseMove)
      currentMouseMove = null
    }
    if (currentMouseUp) {
      document.removeEventListener('mouseup', currentMouseUp)
      currentMouseUp = null
    }
    activeHandleIndex.value = -1
  }

  onUnmounted(cleanup)

  return {
    ratios,
    gridTemplateColumns,
    activeHandleIndex,
    onMouseDown,
    reset,
    setRatios,
    cleanup,
  }
}
