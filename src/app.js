import { createApp, createSSRApp } from 'vue'
import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import App from './App.vue'
import { routes } from './routes/routes.js'
import './assets/main.css'

/**
 * Fábrica compartilhada por cliente e servidor (prerender).
 * `head` vem do entry (client/server) para não misturar os dois bundles do unhead.
 * @param {{head:object, ssr?:boolean, hydrate?:boolean}} opts
 */
export function createAgendasApp({ head, ssr = false, hydrate = false }) {
  const app = (ssr || hydrate ? createSSRApp : createApp)(App)
  const router = createRouter({
    history: ssr ? createMemoryHistory() : createWebHistory(),
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash, top: 90, behavior: 'smooth' }
      if (to.path === from.path) return false
      return { top: 0 }
    },
  })
  app.use(head)
  app.use(router)
  return { app, router, head }
}
