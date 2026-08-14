import {
  conicType, eccVector, escapeVelocity, periapsisApoapsis, semiMajorAxis, specificEnergy,
  sweptArea,
} from '../physics/orbital'
import { sampleAt } from '../physics/trajectory'
import { add, len, norm, scale, v } from '../physics/vec2'
import { DOMAINS, MU } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, vecRow, type Handle } from '../ui/controls'
import { fmt } from '../ui/panel'
import { toScreen, toWorld, type Viewport } from './viewport'
import { arrow, COLORS, drawCurrentMarker, drawTrail, type TrailCache } from './draw'

export const createOrbitsScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}
  const trailCache: { current: TrailCache | null } = { current: null }

  const vp = (): Viewport =>
    ({ world: DOMAINS.orbits, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const o = store.get().orbits
    return [
      { id: 'pos', pos: toScreen(vp(), o.pos), radius: 10 },
      { id: 'vel', pos: toScreen(vp(), add(o.pos, o.vel)), radius: 12 },
    ]
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const o = s.orbits
    const st = { pos: o.pos, vel: o.vel }
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const origin = toScreen(vp(), v(0, 0))
    ctx.fillStyle = COLORS.danger
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 10, 0, 2 * Math.PI); ctx.fill()

    drawTrail(ctx, vp(), s.sim, s.revision,
      { color: COLORS.ghost, tickStep: 0.25, tickRadius: 2 }, trailCache)

    if (s.playback.playing || s.playback.t > 0) {
      const t1 = s.playback.t
      const t0 = Math.max(0, t1 - 0.8)
      ctx.fillStyle = COLORS.accent
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      for (let t = t0; t <= t1; t += 0.02) {
        const p = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath(); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = COLORS.fg
      ctx.font = '13px ui-monospace, monospace'
      ctx.fillText(`swept area = ${fmt(sweptArea(s.sim.samples, t0, t1))}`, 12, 56)
    }

    const eVec = eccVector(st, MU)
    const e = len(eVec)
    const kind = conicType(e)
    const { rp, ra } = periapsisApoapsis(st, MU)
    ctx.fillStyle = COLORS.fg
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillText(`${kind}  rp = ${fmt(rp)}  ${ra === null ? 'escape' : 'ra = ' + fmt(ra)}`,
      12, 20)
    ctx.fillText(`\u03b5 = ${fmt(specificEnergy(st, MU))}`, 12, 38)

    if (kind === 'ellipse') {
      let pMin = s.sim.samples[0]
      let pMax = s.sim.samples[0]
      for (const smp of s.sim.samples) {
        if (len(smp.pos) < len(pMin.pos)) pMin = smp
        if (len(smp.pos) > len(pMax.pos)) pMax = smp
      }
      for (const smp of [pMin, pMax]) {
        const p = toScreen(vp(), smp.pos)
        ctx.strokeStyle = COLORS.fg; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.stroke()
      }
      const a = semiMajorAxis(st, MU)
      const emptyFocus = scale(norm(eVec), -2 * a * e)
      for (const f of [v(0, 0), emptyFocus]) {
        const p = toScreen(vp(), f)
        ctx.strokeStyle = COLORS.dim; ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y)
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5)
        ctx.stroke()
      }
    }

    const posPx = toScreen(vp(), o.pos)
    const vEsc = escapeVelocity(len(o.pos), MU)
    const ringPx = toScreen(vp(), add(o.pos, v(vEsc, 0)))
    ctx.strokeStyle = COLORS.dim; ctx.setLineDash([4, 4]); ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(posPx.x, posPx.y, Math.hypot(ringPx.x - posPx.x, ringPx.y - posPx.y),
      0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])

    arrow(ctx, posPx, toScreen(vp(), add(o.pos, o.vel)), COLORS.accent)
    ctx.fillStyle = COLORS.fg
    ctx.beginPath(); ctx.arc(posPx.x, posPx.y, 5, 0, 2 * Math.PI); ctx.fill()

    drawCurrentMarker(ctx, vp(), s)
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        vecRow('position (x, y)', () => store.get().orbits.pos,
          (pos) => store.patchOrbits({ pos })),
        vecRow('velocity (vx, vy)', () => store.get().orbits.vel,
          (vel) => store.patchOrbits({ vel })),
      ]
      controls.append(...rows.map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      const hint = document.createElement('label')
      hint.textContent = 'drag the satellite and its velocity arrow'
      controls.appendChild(hint)
      root.append(canvas, controls)
      attachDrag(canvas, handles, (id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        if (id === 'pos') store.patchOrbits({ pos: w })
        else {
          const o = store.get().orbits
          store.patchOrbits({ vel: v(w.x - o.pos.x, w.y - o.pos.y) })
        }
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
