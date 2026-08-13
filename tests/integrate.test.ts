import { describe, expect, it } from 'vitest'
import { rk4Step, type PState } from '../src/physics/integrate'
import { scale, v } from '../src/physics/vec2'

const oscillator = (pos: ReturnType<typeof v>) => scale(pos, -1) // a = -x, omega = 1

function integrate(s: PState, dt: number, tEnd: number): PState {
  let cur = s
  for (let t = 0; t < tEnd - dt / 2; t += dt) cur = rk4Step(cur, oscillator, dt)
  return cur
}

describe('rk4Step', () => {
  it('matches cos(t) on the harmonic oscillator', () => {
    const end = integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.01, Math.PI)
    expect(end.pos.x).toBeCloseTo(Math.cos(Math.PI), 8)
    expect(end.vel.x).toBeCloseTo(-Math.sin(Math.PI), 8)
  })
  it('shows 4th-order convergence', () => {
    const exact = Math.cos(1)
    const e1 = Math.abs(integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.1, 1).pos.x - exact)
    const e2 = Math.abs(integrate({ pos: v(1, 0), vel: v(0, 0) }, 0.05, 1).pos.x - exact)
    expect(e1 / e2).toBeGreaterThan(12) // ~16 for order 4
  })
})
