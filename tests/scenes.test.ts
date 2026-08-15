import { describe, expect, it } from 'vitest'
import { duration } from '../src/physics/trajectory'
import { buildSim, INCLINE, PLATES } from '../src/scenes'
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
  it('deflection beam stops at the plate when the field is strong enough', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'deflection', deflection: { ...st.deflection, a: 3 } })
    expect(sim.stopReason).toBe('custom')
    const last = sim.samples[sim.samples.length - 1]
    expect(Math.abs(last.pos.y)).toBeGreaterThanOrEqual(0.8)
    expect(Math.abs(last.pos.y)).toBeLessThanOrEqual(0.83)
    expect(last.pos.x).toBeGreaterThanOrEqual(2)
    expect(last.pos.x).toBeLessThanOrEqual(6)
  })
  it('orbits default is a closed ellipse simulated ~3 periods', () => {
    const st = createStore().get()
    const sim = buildSim({ ...st, tab: 'orbits' })
    expect(sim.stopReason).toBe('tMax')
  })
  it('incline frictionless motion matches the closed form (RK4 exact on a quadratic)', () => {
    const st = createStore().get()
    const theta = 30 * Math.PI / 180
    const sim = buildSim({
      ...st, tab: 'incline', incline: { s0: 2, v0: 3, theta, mu: 0 },
    })
    for (const sample of sim.samples) {
      const expected = 2 + 3 * sample.t - 0.5 * INCLINE.g * Math.sin(theta) * sample.t ** 2
      expect(sample.pos.x).toBeCloseTo(expected, 9)
    }
    expect(sim.stopReason).toBe('bounds')
  })
  it('incline sticks on a shallow slope when static friction holds (tan theta <= mu)', () => {
    const st = createStore().get()
    const theta = 15 * Math.PI / 180
    const mu = 0.3
    const sim = buildSim({
      ...st, tab: 'incline', incline: { s0: 3, v0: 4, theta, mu },
    })
    expect(sim.stopReason).toBe('custom')
    const last = sim.samples[sim.samples.length - 1]
    const analytic = 3 + 16 / (2 * INCLINE.g * (Math.sin(theta) + mu * Math.cos(theta)))
    expect(Math.abs(last.pos.x - analytic) / analytic).toBeLessThan(0.02)
  })
  it('incline slides back down a steep slope after the uphill launch stalls', () => {
    const st = createStore().get()
    const theta = 25 * Math.PI / 180
    const sim = buildSim({
      ...st, tab: 'incline', incline: { s0: 3, v0: 4, theta, mu: 0.2 },
    })
    expect(sim.samples.some((sample) => sample.vel.x < -0.1)).toBe(true)
    expect(sim.stopReason).toBe('bounds')
  })
  it('incline with zero initial velocity sticks immediately when static friction holds', () => {
    const st = createStore().get()
    const theta = 10 * Math.PI / 180
    const sim = buildSim({
      ...st, tab: 'incline', incline: { s0: 3, v0: 0, theta, mu: 0.5 },
    })
    expect(sim.stopReason).toBe('custom')
    expect(duration(sim)).toBeLessThan(0.1)
  })
})
