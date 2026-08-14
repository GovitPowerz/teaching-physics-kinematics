import { describe, expect, it } from 'vitest'
import { CAPTIONS, fmt, formulasFor } from '../src/ui/panel'
import { createStore } from '../src/state'

describe('panel formatters', () => {
  it('fmt fixes digits and normalizes negative zero', () => {
    expect(fmt(1.2345)).toBe('1.23')
    expect(fmt(-0.0001)).toBe('0.00')
    expect(fmt(2, 1)).toBe('2.0')
  })
  it('projectile formulas carry live numbers', () => {
    const s = createStore().get()
    const lines = formulasFor(s)
    expect(lines[0]).toBe('x(t) = 2.00 + 12.00\u00b7t')
    expect(lines[1]).toBe('y(t) = 0.00 + 8.00\u00b7t \u2212 \u00bd\u00b79.81\u00b7t\u00b2')
    expect(lines[2]).toContain('range')
  })
  it('orbit formulas show energy sign and conic label', () => {
    const store = createStore()
    store.setTab('orbits')
    const lines = formulasFor(store.get())
    expect(lines[0]).toContain('\u03b5')
    expect(lines[0]).toContain('ellipse')
    expect(lines[1]).toContain('v\u00b2')
    expect(lines[2]).toContain('v_esc')
  })
  it('deflection formula reports a plate hit when the beam is stopped by the field', () => {
    const store = createStore()
    store.setTab('deflection')
    store.patchDeflection({ a: 3 })
    const lines = formulasFor(store.get())
    expect(lines[2]).toContain('hit a plate')
  })
  it('every tab has a caption', () => {
    for (const tab of ['projectile', 'deflection', 'charges', 'orbits'] as const)
      expect(CAPTIONS[tab].length).toBeGreaterThan(10)
  })
})
