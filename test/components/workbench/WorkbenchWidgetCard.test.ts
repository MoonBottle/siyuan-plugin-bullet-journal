// @vitest-environment happy-dom

import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createApp,
  h,
  nextTick,
} from 'vue'
import { initI18n } from '@/i18n'

async function mountCard(props: Record<string, unknown>) {
  const { default: WorkbenchWidgetCard } = await import('@/components/workbench/dashboard/WorkbenchWidgetCard.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render() {
      return h(WorkbenchWidgetCard, props, { default: () => 'widget body' })
    },
  })
  app.mount(container)
  await nextTick()

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('workbenchWidgetCard', () => {
  beforeEach(() => {
    initI18n('en_US')
    document.body.innerHTML = ''
  })

  it('renders an optional subtitle next to the title', async () => {
    const mounted = await mountCard({
      title: 'Todo List',
      subtitle: '6 项',
    })

    expect(mounted.container.querySelector('.workbench-widget-card__title')?.textContent).toContain('Todo List')
    expect(mounted.container.querySelector('.workbench-widget-card__subtitle')?.textContent).toContain('6 项')

    mounted.unmount()
  })

  it('does not render a subtitle when none is provided', async () => {
    const mounted = await mountCard({
      title: 'Todo List',
    })

    expect(mounted.container.querySelector('.workbench-widget-card__subtitle')).toBeNull()

    mounted.unmount()
  })
})
