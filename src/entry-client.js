import { createHead } from '@unhead/vue/client'
import { createAgendasApp } from './app.js'

const normalize = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

const root = document.getElementById('app')
// Só hidrata quando o HTML prerenderizado é exatamente o da rota atual. Nos fallbacks (/b/*,
// /agendamento/*, vite preview, rewrites divergentes) limpa o conteúdo e monta do zero.
const prerendered = root.dataset.prerendered
const hydrate = Boolean(prerendered) && normalize(prerendered) === normalize(window.location.pathname)
if (!hydrate) root.innerHTML = ''

const { app, router } = createAgendasApp({ head: createHead({ init: [] }), hydrate })
router.isReady().then(() => app.mount('#app', hydrate))
