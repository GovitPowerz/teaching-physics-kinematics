import { describe, expect, it } from 'vitest'
import { duration } from '../src/physics/trajectory'
import { createStore } from '../src/state'
import { v } from '../src/physics/vec2'

describe('store', () => {
  it('scene mutation recomputes sim, resets playback, notifies once', () => {
    const s = createStore()
    let n = 0
    s.subscribe(() => n++)
    s.setPlaying(true)
    s.setT(1)
    const before = s.get().sim
    s.patchProjectile({ g: 3.7 })
    expect(n).toBe(3)
    expect(s.get().sim).not.toBe(before)
    expect(s.get().playback.playing).toBe(false)
    expect(s.get().playback.t).toBe(0)
  })
  it('setT clamps to [0, duration]', () => {
    const s = createStore()
    s.setT(1e9)
    expect(s.get().playback.t).toBeCloseTo(duration(s.get().sim), 9)
    s.setT(-5)
    expect(s.get().playback.t).toBe(0)
  })
  it('setTab switches sim to the new scene', () => {
    const s = createStore()
    s.setTab('orbits')
    expect(s.get().tab).toBe('orbits')
    expect(s.get().sim.samples[0].pos.x).toBeCloseTo(1.5, 9)
  })
  it('charge list: cap 8, q clamped, delete clears selection', () => {
    const s = createStore()
    for (let i = 0; i < 10; i++) s.addCharge(v(i * 0.1, 2), 1)
    expect(s.get().charges.charges.length).toBe(8)
    s.setChargeQ(0, 99)
    expect(s.get().charges.charges[0].q).toBe(5)
    s.setChargeQ(0, 0.2)
    expect(Math.abs(s.get().charges.charges[0].q)).toBeGreaterThanOrEqual(1)
    s.selectCharge(1)
    s.deleteCharge(1)
    expect(s.get().charges.selected).toBeNull()
  })
  it('playback mutations do not recompute the sim', () => {
    const s = createStore()
    const sim = s.get().sim
    s.setPlaying(true)
    s.setSpeed(2)
    s.toggleOverlay('v')
    expect(s.get().sim).toBe(sim)
  })
})
