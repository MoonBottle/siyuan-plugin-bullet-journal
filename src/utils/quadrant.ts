import type { PriorityLevel } from '@/types/models';
import type { WorkbenchQuadrantKey } from '@/types/workbench';

export type QuadrantDefinition = {
  key: WorkbenchQuadrantKey;
  titleKey: string;
  priorities: PriorityLevel[];
  includeNoPriority: boolean;
};

export const QUADRANT_DEFINITIONS: QuadrantDefinition[] = [
  {
    key: 'high',
    titleKey: 'quadrant.panels.high',
    priorities: ['high'],
    includeNoPriority: false,
  },
  {
    key: 'medium',
    titleKey: 'quadrant.panels.medium',
    priorities: ['medium'],
    includeNoPriority: false,
  },
  {
    key: 'low',
    titleKey: 'quadrant.panels.low',
    priorities: ['low'],
    includeNoPriority: false,
  },
  {
    key: 'none',
    titleKey: 'quadrant.panels.none',
    priorities: [],
    includeNoPriority: true,
  },
];

export function getQuadrantDefinition(key: WorkbenchQuadrantKey | undefined): QuadrantDefinition {
  return QUADRANT_DEFINITIONS.find(item => item.key === key) ?? QUADRANT_DEFINITIONS[0];
}
