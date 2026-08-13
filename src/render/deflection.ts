import { duration, sampleAt } from '../physics/trajectory'
import { add, v, type Vec2 } from '../physics/vec2'
import { DOMAINS, PLATES } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, sliderRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const createDeflectionScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.deflection, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const d = store.get().deflection
    return [{ id: 'v0', pos: toScreen(vp(), v(0.2 + d.v0, 0)), radius: 12 }]
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
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
    const topColor = d.sign > 0 ? css('--accent') : css('--danger')
    const botColor = d.sign > 0 ? css('--danger') : css('--accent')
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
      arrow(from, to, css('--dim'))
    }

    const sc0 = toScreen(vp(), v(PLATES.screenX, -3))
    const sc1 = toScreen(vp(), v(PLATES.screenX, 3))
    ctx.strokeStyle = css('--fg'); ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sc0.x, sc0.y); ctx.lineTo(sc1.x, sc1.y); ctx.stroke()

    ctx.strokeStyle = css('--ghost'); ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, i) => {
      const p = toScreen(vp(), smp.pos)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.25) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }
    if (s.sim.stopReason === 'screen') {
      const hit = toScreen(vp(), s.sim.samples[s.sim.samples.length - 1].pos)
      ctx.fillStyle = css('--danger')
      ctx.beginPath(); ctx.arc(hit.x, hit.y, 5, 0, 2 * Math.PI); ctx.fill()
    }

    arrow(toScreen(vp(), v(0.2, 0)), toScreen(vp(), v(0.2 + d.v0, 0)), css('--accent'))

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
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
