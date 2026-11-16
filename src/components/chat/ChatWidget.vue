<script setup>
// Lançador do chat: leve e sem SSR (só monta no cliente). O painel (controlador, Turnstile, formulários) vira um
// chunk separado, carregado na PRIMEIRA abertura; o bundle inicial e o HTML pré-renderizado não o incluem.
// Liga/desliga: VITE_CHAT_ENABLED (site) + PUBLIC_CHAT_ENABLED (core). 503 chat_disabled esconde o botão.
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { env } from '../../config/env.js'
import { consentBannerOpen } from '../../services/analytics.js'
import { isChatMarkedDisabled } from '../../lib/chatStorage.js'
import AppIcon from '../ui/AppIcon.vue'

defineProps({
  /** Slug da página /b/:slug (chat do cliente daquela empresa) ou null nas páginas do site. */
  slug: { type: String, default: null },
})

const ChatPanel = defineAsyncComponent(() => import('./ChatPanel.vue'))

const mounted = ref(false)
const hidden = ref(false)
const open = ref(false)
const everOpened = ref(false)
const button = ref(null)

onMounted(() => {
  hidden.value = isChatMarkedDisabled()
  mounted.value = true
})

// Teclado virtual: dvh não acompanha o teclado em todos os navegadores (iOS Safari). Enquanto o painel está aberto
// no celular, medimos o visualViewport e subimos o painel acima do teclado para o campo de digitação nunca ficar coberto.
const kb = ref(0)
const vvh = ref(0)
function syncViewport() {
  const vv = window.visualViewport
  if (!vv || window.innerWidth >= 640) {
    kb.value = 0
    vvh.value = 0
    return
  }
  vvh.value = Math.round(vv.height)
  kb.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}
function trackViewport(on) {
  const vv = typeof window === 'undefined' ? null : window.visualViewport
  if (!vv) return
  vv.removeEventListener('resize', syncViewport)
  vv.removeEventListener('scroll', syncViewport)
  if (on) {
    syncViewport()
    vv.addEventListener('resize', syncViewport)
    vv.addEventListener('scroll', syncViewport)
  } else {
    kb.value = 0
    vvh.value = 0
  }
}
watch(open, (o) => trackViewport(o))
onBeforeUnmount(() => trackViewport(false))

function toggle() {
  open.value = !open.value
  if (open.value) everOpened.value = true
  else nextTick(() => button.value?.focus())
}
function close() {
  if (!open.value) return
  open.value = false
  nextTick(() => button.value?.focus())
}
</script>

<template>
  <div
    v-if="env.chatEnabled && mounted && !hidden"
    class="chat-dock fixed z-40 flex flex-col items-end gap-3"
    :class="[open && 'is-open', kb > 0 && 'kb-open', consentBannerOpen && 'consent-open']"
    :style="open && vvh ? { '--ap-kb': kb + 'px', '--ap-vvh': vvh + 'px' } : undefined"
  >
    <ChatPanel v-if="everOpened" v-show="open" :slug="slug" :open="open" @close="close" @disabled="hidden = true" />
    <button
      ref="button"
      type="button"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop hover:bg-brand-700 motion-safe:transition-colors"
      :class="open && 'max-sm:hidden'"
      :aria-expanded="open"
      :aria-label="open ? 'Fechar chat' : 'Abrir chat com o assistente'"
      @click="toggle"
    >
      <AppIcon :name="open ? 'x' : 'chat'" :size="26" />
    </button>
  </div>
</template>
