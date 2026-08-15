import { describe, expect, it } from 'vitest'
import { CAPTIONS, fmt, formulasFor } from '../src/ui/panel'
import { createStore } from '../src/state'
import { fieldAt } from '../src/physics/fields'
import { len } from '../src/physics/vec2'

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
  it('deflection formula reports the screen deflection on the default (screen) path', () => {
    const store = createStore()
    store.setTab('deflection')
    const s = store.get()
    const last = s.sim.samples[s.sim.samples.length - 1]
    const lines = formulasFor(s)
    expect(s.sim.stopReason).toBe('screen')
    expect(lines[2]).toBe(`deflection at screen = ${fmt(last.pos.y)}`)
  })
  it('charges formulas match an independently computed field sample', () => {
    const store = createStore()
    store.setTab('charges')
    const s = store.get()
    const E = fieldAt(s.charges.charges, s.charges.testPos)
    const lines = formulasFor(s)
    expect(lines[0]).toBe(`E(test) = (${fmt(E.x)}, ${fmt(E.y)}), |E| = ${fmt(len(E))}`)
    expect(lines[1]).toContain('superposition of 2 charges')
  })
  it('every tab has a caption', () => {
    for (const tab of ['projectile', 'deflection', 'charges', 'orbits', 'incline'] as const)
      expect(CAPTIONS[tab].length).toBeGreaterThan(10)
  })
  it('incline formulas carry live numbers, with a stuck message when static friction holds', () => {
    const store = createStore()
    store.setTab('incline')
    const lines = formulasFor(store.get())
    expect(lines[0]).toContain('N = ')
    expect(lines[1]).toContain('a = ')
    expect(lines[2]).toContain('stops after')

    store.patchIncline({ v0: 0, mu: 0.5, theta: 10 * Math.PI / 180 })
    const stuckLines = formulasFor(store.get())
    expect(stuckLines[1]).toContain('static friction')
  })
})
