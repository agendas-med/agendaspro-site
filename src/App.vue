<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import SiteHeader from './components/layout/SiteHeader.vue'
import SiteFooter from './components/layout/SiteFooter.vue'
import CookieBanner from './components/layout/CookieBanner.vue'
import ChatWidget from './components/chat/ChatWidget.vue'
import { initConsent, trackPageView } from './services/analytics.js'
import { captureAttribution } from './composables/useAttribution.js'

const route = useRoute()
const router = useRouter()

// Chat: páginas do site (slug null) e /b/:slug (company_slug). Fora: páginas minimalistas com token (/agendamento).
const chatSlug = computed(() => {
  if (route.name === 'booking') return String(route.params.slug || '') || undefined
  return route.meta.minimal ? undefined : null
})
const main = ref(null)

onMounted(() => {
  captureAttribution()
  initConsent()
  router.afterEach((to, from) => {
    if (to.path === from.path) return
    trackPageView(to.path)
    // acessibilidade em SPA: leva o foco ao conteúdo após navegar
    nextTick(() => main.value?.focus({ preventScroll: true }))
  })
})
</script>

<template>
  <a
    href="#conteudo"
    class="sr-only-focusable fixed left-3 top-3 z-[60] rounded-lg bg-white px-4 py-2 font-semibold text-ink shadow-pop"
  >
    Pular para o conteúdo
  </a>
  <SiteHeader v-if="!route.meta.minimal" />
  <main id="conteudo" ref="main" tabindex="-1" class="outline-none">
    <RouterView :key="route.path" />
  </main>
  <SiteFooter v-if="!route.meta.minimal" />
  <CookieBanner />
  <ChatWidget v-if="chatSlug !== undefined" :slug="chatSlug" />
</template>
