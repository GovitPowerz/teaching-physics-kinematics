import { describe, expect, it } from 'vitest'
import { pxPerUnit, toScreen, toWorld } from '../src/render/viewport'
import { v } from '../src/physics/vec2'

const vp = { world: { xMin: 0, xMax: 60, yMin: 0, yMax: 30 }, w: 800, h: 600 }

describe('viewport', () => {
  it('uniform scale is the min fit', () => {
    expect(pxPerUnit(vp)).toBeCloseTo(800 / 60, 9) // 13.33 < 600/30 = 20
  })
  it('world y up, screen y down, box centered', () => {
    const center = toScreen(vp, v(30, 15))
    expect(center.x).toBeCloseTo(400, 9)
    expect(center.y).toBeCloseTo(300, 9)
    const origin = toScreen(vp, v(0, 0))
    expect(origin.y).toBeGreaterThan(300) // below center on screen
  })
  it('toWorld inverts toScreen', () => {
    const p = v(12.3, 4.56)
    const back = toWorld(vp, toScreen(vp, p))
    expect(back.x).toBeCloseTo(p.x, 9)
    expect(back.y).toBeCloseTo(p.y, 9)
  })
})
