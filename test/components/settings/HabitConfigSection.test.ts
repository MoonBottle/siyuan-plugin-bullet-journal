// @vitest-environment happy-dom

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  defineComponent,
  h,
} from 'vue'
import HabitConfigSection from '@/components/settings/HabitConfigSection.vue'

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: {
      modelValue: {
        type: String,
        required: true,
      },
      options: {
        type: Array,
        default: () => [],
      },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('button', {
        "type": 'button',
        'data-testid': 'habit-precision-select',
        'data-value': props.modelValue,
        "onClick": () => emit('update:modelValue', 'second'),
      })
    },
  }),
}))

function mountHabitConfigSection(props: Record<string, unknown> = {}) {
  const events: Array<string> = []
  const TestHost = defineComponent({
    setup() {
      return () => h(HabitConfigSection, {
        "habitCheckInTimePrecision": 'day',
        'onUpdate:habitCheckInTimePrecision': (value: string) => events.push(value),
        ...props,
      })
    },
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(TestHost)
  app.mount(container)

  return {
    container,
    events,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('habitConfigSection', () => {
  it('emits updated habit check-in time precision when selection changes', async () => {
    const mounted = mountHabitConfigSection()

    const trigger = mounted.container.querySelector('[data-testid="habit-precision-select"]')
    expect(trigger).not.toBeNull()

    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mounted.events).toEqual(['second'])

    mounted.unmount()
  })
})
