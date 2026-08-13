import './style.css'
import { duration } from './physics/trajectory'
import { createStore, type Tab } from './state'
import { createPanel } from './ui/panel'
import { createPlayback } from './ui/playback'
import { createTopbar } from './ui/topbar'
import { createProjectileScene } from './render/projectile'
import { createDeflectionScene } from './render/deflection'
import { createChargesScene } from './render/charges'
import { createOrbitsScene } from './render/orbits'

export interface SceneRenderer {
  mount: (root: HTMLElement) => void
  unmount: () => void
  render: () => void
}

const store = createStore()
const sceneRoot = document.getElementById('scene')!
const scenes: Record<Tab, SceneRenderer> = {
  projectile: createProjectileScene(store), deflection: createDeflectionScene(store),
  charges: createChargesScene(store), orbits: createOrbitsScene(store),
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
