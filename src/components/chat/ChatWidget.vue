<script setup>
// Lançador do chat: leve e sem SSR (só monta no cliente). O painel (controlador, Turnstile, formulários) vira um
// chunk separado, carregado na PRIMEIRA abertura; o bundle inicial e o HTML pré-renderizado não o incluem.
// Liga/desliga: VITE_CHAT_ENABLED (site) + PUBLIC_CHAT_ENABLED (core). 503 chat_disabled esconde o botão.
import { defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
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
    class="fixed right-3 z-40 flex flex-col items-end gap-3 sm:bottom-4 sm:right-4"
    :class="consentBannerOpen ? 'bottom-48 sm:bottom-4' : 'bottom-3'"
  >
    <ChatPanel v-if="everOpened" v-show="open" :slug="slug" :open="open" @close="close" @disabled="hidden = true" />
    <button
      ref="button"
      type="button"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop hover:bg-brand-700 motion-safe:transition-colors"
      :aria-expanded="open"
      :aria-label="open ? 'Fechar chat' : 'Abrir chat com o assistente'"
      @click="toggle"
    >
      <AppIcon :name="open ? 'x' : 'chat'" :size="26" />
    </button>
  </div>
</template>
