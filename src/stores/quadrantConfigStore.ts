import type {
  QuadrantConfigFile,
  QuadrantPanelConfig,
  QuadrantPanelId,
} from '@/types/quadrant'
import { defineStore } from 'pinia'
import {
  loadQuadrantConfig,
  resetQuadrantConfig,
  saveQuadrantConfig,
} from '@/services/quadrantConfigService'

export const useQuadrantConfigStore = defineStore('quadrantConfig', {
  state: () => ({
    loaded: false,
    config: null as QuadrantConfigFile | null,
  }),
  getters: {
    panels: (state) => state.config?.panels ?? [],
  },
  actions: {
    async loadConfig() {
      this.config = await loadQuadrantConfig()
      this.loaded = true
    },
    async savePanel(panelId: QuadrantPanelId, nextPanel: QuadrantPanelConfig) {
      const base = this.config ?? await loadQuadrantConfig()
      const nextConfig = {
        ...base,
        panels: base.panels.map((panel) => panel.id === panelId ? nextPanel : panel),
      }
      this.config = await saveQuadrantConfig(nextConfig)
    },
    async resetAll() {
      this.config = await resetQuadrantConfig()
    },
  },
})
