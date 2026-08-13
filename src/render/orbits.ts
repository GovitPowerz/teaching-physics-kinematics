import {
  conicType, eccVector, eccentricity, escapeVelocity, periapsisApoapsis, semiMajorAxis,
  specificEnergy,
} from '../physics/orbital'
import { duration, sampleAt } from '../physics/trajectory'
import { add, len, norm, scale, v, type Vec2 } from '../physics/vec2'
import { DOMAINS, MU } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, vecRow, type Handle } from '../ui/controls'
import { fmt } from '../ui/panel'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const createOrbitsScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.orbits, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const o = store.get().orbits
    return [
      { id: 'pos', pos: toScreen(vp(), o.pos), radius: 10 },
      { id: 'vel', pos: toScreen(vp(), add(o.pos, o.vel)), radius: 12 },
    ]
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
    const o = s.orbits
    const st = { pos: o.pos, vel: o.vel }
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const origin = toScreen(vp(), v(0, 0))
    ctx.fillStyle = css('--danger')
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 10, 0, 2 * Math.PI); ctx.fill()

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
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 2 * Math.PI); ctx.fill()
    }

    if (s.playback.playing || s.playback.t > 0) {
      const t1 = s.playback.t
      const t0 = Math.max(0, t1 - 0.8)
      ctx.fillStyle = css('--accent')
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      for (let t = t0; t <= t1; t += 0.02) {
        const p = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath(); ctx.fill()
      ctx.globalAlpha = 1
    }

    const e = eccentricity(st, MU)
    const kind = conicType(e)
    const { rp, ra } = periapsisApoapsis(st, MU)
    ctx.fillStyle = css('--fg')
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
        ctx.strokeStyle = css('--fg'); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.stroke()
      }
      const a = semiMajorAxis(st, MU)
      const emptyFocus = scale(norm(eccVector(st, MU)), -2 * a * e)
      for (const f of [v(0, 0), emptyFocus]) {
        const p = toScreen(vp(), f)
        ctx.strokeStyle = css('--dim'); ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y)
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5)
        ctx.stroke()
      }
    }

    const posPx = toScreen(vp(), o.pos)
    const vEsc = escapeVelocity(len(o.pos), MU)
    const ringPx = toScreen(vp(), add(o.pos, v(vEsc, 0)))
    ctx.strokeStyle = css('--dim'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(posPx.x, posPx.y, Math.hypot(ringPx.x - posPx.x, ringPx.y - posPx.y),
      0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])

    arrow(posPx, toScreen(vp(), add(o.pos, o.vel)), css('--accent'))
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(posPx.x, posPx.y, 5, 0, 2 * Math.PI); ctx.fill()

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
