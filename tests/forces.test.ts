import { describe, expect, it } from 'vitest'
import {
  SOFTENING, combine, coulomb, linearDrag, newtonGravity, uniformField, uniformGravity,
} from '../src/physics/forces'
import { add, len, v } from '../src/physics/vec2'

describe('forces', () => {
  it('uniformGravity and uniformField', () => {
    expect(uniformGravity(9.81)(v(3, 7), v(1, 1))).toEqual(v(0, -9.81))
    expect(uniformField(v(0, -9.81))(v(0, 0), v(0, 0))).toEqual(v(0, -9.81))
  })
  it('linearDrag opposes velocity', () => {
    expect(linearDrag(0.5)(v(0, 0), v(2, -4))).toEqual(v(-1, 2))
  })
  it('combine sums accelerations', () => {
    const f = combine(uniformGravity(10), linearDrag(1))
    expect(f(v(0, 0), v(3, 0))).toEqual(v(-3, -10))
  })
  it('coulomb single charge, hand-computed with softening', () => {
    const E = coulomb([{ pos: v(0, 0), q: 1 }], 1)(v(1, 0), v(0, 0))
    const expected = 1 / Math.pow(1 + SOFTENING * SOFTENING, 1.5)
    expect(E.x).toBeCloseTo(expected, 12)
    expect(E.y).toBeCloseTo(0, 12)
  })
  it('coulomb superposition is exact', () => {
    const c1 = { pos: v(1, 0), q: 1 }
    const c2 = { pos: v(-1, 1), q: -2 }
    const p = v(0.3, -0.4)
    const both = coulomb([c1, c2], 1.5)(p, v(0, 0))
    const sum = add(coulomb([c1], 1.5)(p, v(0, 0)), coulomb([c2], 1.5)(p, v(0, 0)))
    expect(both.x).toBeCloseTo(sum.x, 12)
    expect(both.y).toBeCloseTo(sum.y, 12)
  })
  it('softening keeps acceleration finite at the singularity', () => {
    const a = coulomb([{ pos: v(0, 0), q: 5 }], 1)(v(0, 0), v(0, 0))
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    const near = newtonGravity(1)(v(1e-9, 0), v(0, 0))
    expect(len(near)).toBeLessThan(1 / (SOFTENING * SOFTENING))
  })
  it('newtonGravity attracts toward origin', () => {
    const a = newtonGravity(1)(v(2, 0), v(0, 0))
    expect(a.x).toBeLessThan(0)
    expect(a.y).toBeCloseTo(0, 12)
  })
  it('coulomb with no charges yields zero acceleration', () => {
    expect(coulomb([], 1)(v(1, 2), v(0, 0))).toEqual(v(0, 0))
  })
})
