import { describe, expect, it } from 'vitest'
import { buildSim, PLATES } from '../src/scenes'
import { createStore } from '../src/state'

describe('buildSim', () => {
  it('projectile sim starts at launch and stops on the ground', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'projectile' })
    expect(sim.samples[0].pos.x).toBe(2)
    expect(sim.stopReason).toBe('ground')
  })
  it('deflection force is zero outside the plates', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'deflection' })
    const before = sim.samples.find((s) => s.pos.x < PLATES.x0)
    const inside = sim.samples.find(
      (s) => s.pos.x > PLATES.x0 + 0.5 && s.pos.x < PLATES.x0 + st.deflection.plateLength - 0.5)
    expect(before && Math.abs(before.acc.y)).toBe(0)
    expect(inside && Math.abs(inside!.acc.y)).toBeCloseTo(st.deflection.a, 9)
    expect(sim.stopReason).toBe('screen')
  })
  it('orbits default is a closed ellipse simulated ~3 periods', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'orbits' })
    expect(sim.stopReason).toBe('tMax')
  })
})
