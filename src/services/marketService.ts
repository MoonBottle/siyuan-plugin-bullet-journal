export interface MarketSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
  content: string
}

class MarketService {
  private static instance: MarketService
  private catalog: MarketSkill[] = []

  private constructor() {}

  static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService()
    }
    return MarketService.instance
  }

  loadBuiltinCatalog(): void {
    const modules = import.meta.glob('/src/market-skills/*.json', { eager: true })
    this.catalog = Object.values(modules).map(
      (m: any) => m.default as MarketSkill,
    )
  }

  getCatalog(): MarketSkill[] {
    return this.catalog
  }

  getSkill(name: string): MarketSkill | undefined {
    return this.catalog.find((s) => s.name === name)
  }
}

export { MarketService }
