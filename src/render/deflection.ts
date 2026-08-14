import { v } from '../physics/vec2'
import { DOMAINS, PLATES } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, sliderRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { arrow, COLORS, drawCurrentMarker, drawTrail, type TrailCache } from './draw'

export const createDeflectionScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}
  const trailCache: { current: TrailCache | null } = { current: null }

  const vp = (): Viewport =>
    ({ world: DOMAINS.deflection, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const d = store.get().deflection
    return [{ id: 'v0', pos: toScreen(vp(), v(0.2 + d.v0, 0)), radius: 12 }]
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const d = s.deflection
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const x0 = PLATES.x0
    const x1 = PLATES.x0 + d.plateLength
    const yTop = PLATES.gap / 2
    // force on the particle is d.sign * a in +y; field arrows follow it,
    // the plate the force points AWAY from is the positive (red) one
    const topColor = d.sign > 0 ? COLORS.accent : COLORS.danger
    const botColor = d.sign > 0 ? COLORS.danger : COLORS.accent
    const plate = (y: number, color: string) => {
      const a = toScreen(vp(), v(x0, y))
      const b = toScreen(vp(), v(x1, y))
      ctx.fillStyle = color
      ctx.fillRect(a.x, a.y - 3, b.x - a.x, 6)
    }
    plate(yTop, topColor)
    plate(-yTop, botColor)

    for (let i = 0; i < 5; i++) {
      const x = x0 + ((i + 0.5) / 5) * d.plateLength
      const from = toScreen(vp(), v(x, -yTop * 0.7 * d.sign))
      const to = toScreen(vp(), v(x, yTop * 0.7 * d.sign))
      arrow(ctx, from, to, COLORS.dim)
    }

    const sc0 = toScreen(vp(), v(PLATES.screenX, -3))
    const sc1 = toScreen(vp(), v(PLATES.screenX, 3))
    ctx.strokeStyle = COLORS.fg; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sc0.x, sc0.y); ctx.lineTo(sc1.x, sc1.y); ctx.stroke()

    drawTrail(ctx, vp(), s.sim, s.revision,
      { color: COLORS.ghost, tickStep: 0.25, tickRadius: 2.5 }, trailCache)
    if (s.sim.stopReason === 'screen' || s.sim.stopReason === 'custom') {
      const hit = toScreen(vp(), s.sim.samples[s.sim.samples.length - 1].pos)
      ctx.fillStyle = COLORS.danger
      ctx.beginPath(); ctx.arc(hit.x, hit.y, 5, 0, 2 * Math.PI); ctx.fill()
    }

    arrow(ctx, toScreen(vp(), v(0.2, 0)), toScreen(vp(), v(0.2 + d.v0, 0)), COLORS.accent)

    drawCurrentMarker(ctx, vp(), s)
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('field a = qE/m', 0, 3, 0.01,
          () => store.get().deflection.a, (a) => store.patchDeflection({ a })),
        sliderRow('plate length L', 1, 6, 0.1,
          () => store.get().deflection.plateLength,
          (plateLength) => store.patchDeflection({ plateLength })),
        sliderRow('entry speed v0', 1, 5, 0.1,
          () => store.get().deflection.v0, (v0) => store.patchDeflection({ v0 })),
      ]
      controls.append(...rows.map((r) => r.el),
        buttonRow(['flip charge'], () =>
          store.patchDeflection({ sign: store.get().deflection.sign > 0 ? -1 : 1 })))
      refreshRows = () => rows.forEach((r) => r.refresh())
      root.append(canvas, controls)
      attachDrag(canvas, handles, (_id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        store.patchDeflection({ v0: Math.min(5, Math.max(1, w.x - 0.2)) })
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
