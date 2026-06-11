import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  insertMarkerBeforeFirst,
  normalizeMarkerLine,
  parseMarkerLine,
  removeMarker,
  upsertMarker,
} from '@/utils/blockWriter/render/markerCluster'

describe('markerCluster', () => {
  describe('taskTag', () => {
    it('recognizes 📋 as taskTag marker', () => {
      const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 📋')
      expect(parsed.markers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'taskTag',
            raw: '📋',
          }),
        ]),
      )
    })

    it('upserts taskTag marker after existing markers', () => {
      const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 ⏰14:00')
      const result = normalizeMarkerLine(upsertMarker(parsed, 'taskTag', '📋'))
      expect(result).toBe('评审视觉稿 📅2026-05-15 ⏰14:00 📋')
    })

    it('removes taskTag marker', () => {
      const parsed = parseMarkerLine('评审视觉稿 📅2026-05-15 📋')
      const result = normalizeMarkerLine(removeMarker(parsed, 'taskTag'))
      expect(result).toBe('评审视觉稿 📅2026-05-15')
    })

    it('inserts taskTag after priority marker', () => {
      const parsed = parseMarkerLine('任务 🔥 📅2026-05-15')
      const result = normalizeMarkerLine(upsertMarker(parsed, 'taskTag', '📋'))
      expect(result).toBe('任务 🔥 📅2026-05-15 📋')
    })

    it('does not duplicate taskTag marker', () => {
      const parsed = parseMarkerLine('任务 📅2026-05-15 📋')
      const result = normalizeMarkerLine(upsertMarker(parsed, 'taskTag', '📋'))
      expect(result).toBe('任务 📅2026-05-15 📋')
    })
  })

  describe('insertMarkerBeforeFirst', () => {
    it('inserts date marker before existing markers', () => {
      const parsed = parseMarkerLine('任务 🔁每天 ⏰10:00 📌')
      const result = normalizeMarkerLine(insertMarkerBeforeFirst(parsed, 'date', '📅2026-06-12'))
      expect(result).toBe('任务 📅2026-06-12 🔁每天 ⏰10:00 📌')
    })

    it('replaces existing date marker in-place', () => {
      const parsed = parseMarkerLine('任务 📅2026-06-11 🔁每天 ⏰10:00 📌')
      const result = normalizeMarkerLine(insertMarkerBeforeFirst(parsed, 'date', '📅2026-06-12'))
      expect(result).toBe('任务 📅2026-06-12 🔁每天 ⏰10:00 📌')
    })

    it('appends when no other markers exist', () => {
      const parsed = parseMarkerLine('任务')
      const result = normalizeMarkerLine(insertMarkerBeforeFirst(parsed, 'date', '📅2026-06-12'))
      expect(result).toBe('任务 📅2026-06-12')
    })

    it('inserts before first marker when content has text and one marker', () => {
      const parsed = parseMarkerLine('任务 🔁每天')
      const result = normalizeMarkerLine(insertMarkerBeforeFirst(parsed, 'date', '📅2026-06-12'))
      expect(result).toBe('任务 📅2026-06-12 🔁每天')
    })
  })
})
