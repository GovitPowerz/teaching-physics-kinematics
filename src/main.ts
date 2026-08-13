import './style.css'
import { duration } from './physics/trajectory'
import { createStore, type Tab } from './state'
import { createPanel } from './ui/panel'
import { createPlayback } from './ui/playback'
import { createTopbar } from './ui/topbar'

export interface SceneRenderer {
  mount: (root: HTMLElement) => void
  unmount: () => void
  render: () => void
}

const store = createStore()
const sceneRoot = document.getElementById('scene')!
const placeholder = (): SceneRenderer => {
  let canvas: HTMLCanvasElement | null = null
  return {
    mount: (root) => { canvas = document.createElement('canvas'); root.appendChild(canvas) },
    unmount: () => { canvas?.remove() },
    render: () => {},
  }
}
const scenes: Record<Tab, SceneRenderer> = {
  projectile: placeholder(), deflection: placeholder(),
  charges: placeholder(), orbits: placeholder(),
}

const topbar = createTopbar(store)
document.getElementById('topbar')!.appendChild(topbar.el)
const panel = createPanel(store)
const playback = createPlayback(store)
const panelRoot = document.getElementById('panel')!
panelRoot.append(playback.el, panel.el)

let activeTab: Tab = store.get().tab
scenes[activeTab].mount(sceneRoot)

store.subscribe(() => {
  const tab = store.get().tab
  if (tab !== activeTab) {
    scenes[activeTab].unmount()
    activeTab = tab
    scenes[activeTab].mount(sceneRoot)
  }
  topbar.render()
  panel.render()
  playback.render()
})
topbar.render(); panel.render(); playback.render()

let last = performance.now()
const loop = (now: number) => {
  const dt = (now - last) / 1000
  last = now
  const s = store.get()
  if (s.playback.playing) {
    const tNext = s.playback.t + dt * s.playback.speed
    if (tNext >= duration(s.sim)) { store.setT(duration(s.sim)); store.setPlaying(false) }
    else store.setT(tNext)
  }
  scenes[activeTab].render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
