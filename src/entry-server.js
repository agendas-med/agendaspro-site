import { renderToString } from 'vue/server-renderer'
import { createHead, renderSSRHead } from '@unhead/vue/server'
import { createAgendasApp } from './app.js'
import { sitemapEntries } from './routes/routes.js'
import { env } from './config/env.js'
import { hasPlaceholders, whatsappIsConfigured } from './config/company.js'

export { sitemapEntries }

/** Dados de build (as variáveis VITE_* já vêm inlinadas neste bundle). */
export const buildInfo = () => ({
  siteUrl: env.siteUrl,
  hasPlaceholders: hasPlaceholders(),
  whatsappConfigured: whatsappIsConfigured(),
  useMocks: env.useMocks,
  apiBase: env.apiBase,
  turnstileConfigured: Boolean(env.turnstileSiteKey),
})

/** Renderiza uma rota para o prerender. Retorna html do app + tags de <head>. */
export async function render(url) {
  const { app, router, head } = createAgendasApp({ head: createHead({ init: [] }), ssr: true })
  await router.push(url)
  await router.isReady()
  const html = await renderToString(app)
  const payload = await renderSSRHead(head)
  return {
    html,
    // O unhead injeta charset/viewport padrão; o index.html já os declara, então removemos a duplicata.
    headTags: payload.headTags
      .replace(/<meta charset="utf-8">\s*/i, '')
      .replace(/<meta name="viewport" content="width=device-width, initial-scale=1">\s*/i, ''),
    routeName: String(router.currentRoute.value.name || ''),
  }
}
