import { computed, ref, type Ref } from 'vue';

interface ResizableColumnsOptions {
  containerRef: Ref<HTMLElement | undefined>;
  initialRatios?: [number, number, number];
  onChange?: (ratios: [number, number, number]) => void;
}

const DEFAULT_RATIOS: [number, number, number] = [20, 20, 60];
const MIN_RATIOS: [number, number, number] = [10, 15, 30];

function clampRatios(ratios: [number, number, number]): [number, number, number] {
  return [
    Math.max(MIN_RATIOS[0], ratios[0]),
    Math.max(MIN_RATIOS[1], ratios[1]),
    Math.max(MIN_RATIOS[2], ratios[2]),
  ];
}

function normalize(ratios: [number, number, number]): [number, number, number] {
  const total = ratios[0] + ratios[1] + ratios[2];
  if (total === 100) return ratios;
  return [
    (ratios[0] / total) * 100,
    (ratios[1] / total) * 100,
    (ratios[2] / total) * 100,
  ];
}

export function useResizableColumns(options: ResizableColumnsOptions) {
  const ratios = ref<[number, number, number]>(options.initialRatios ?? [...DEFAULT_RATIOS]);

  const gridTemplateColumns = computed<string>(() => {
    return `${ratios.value[0]}% ${ratios.value[1]}% ${ratios.value[2]}%`;
  });

  function setRatios(newRatios: [number, number, number]) {
    ratios.value = normalize(clampRatios(newRatios));
  }

  function reset() {
    ratios.value = [...DEFAULT_RATIOS];
  }

  function onMouseDown(e: MouseEvent, handleIndex: number) {
    e.preventDefault();

    const container = options.containerRef.value;
    if (!container) return;

    const startX = e.clientX;
    const startRatios = [...ratios.value] as [number, number, number];
    const containerWidth = container.offsetWidth;

    function onMouseMove(e: MouseEvent): void {
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;

      let newRatios: [number, number, number];

      if (handleIndex === 0) {
        newRatios = [
          startRatios[0] + deltaPercent,
          startRatios[1] - deltaPercent,
          startRatios[2],
        ];
      } else {
        newRatios = [
          startRatios[0],
          startRatios[1] + deltaPercent,
          startRatios[2] - deltaPercent,
        ];
      }

      ratios.value = normalize(clampRatios(newRatios));
    }

    function onMouseUp(): void {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      options.onChange?.(ratios.value);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return {
    ratios,
    gridTemplateColumns,
    onMouseDown,
    reset,
    setRatios,
  };
}
