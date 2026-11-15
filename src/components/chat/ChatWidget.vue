<script setup>
// Placeholder da fase F5: apenas o botão flutuante e o painel com o "gate" de audiência.
// Sem backend: o campo de mensagem fica desabilitado. Ligado por VITE_CHAT_ENABLED=true.
import { ref, nextTick, onMounted } from 'vue'
import { env } from '../../config/env.js'
import AppIcon from '../ui/AppIcon.vue'
import ChatGate from './ChatGate.vue'

const mounted = ref(false)
const open = ref(false)
const audience = ref(null) // 'customer' | 'business' | null
const panel = ref(null)
const button = ref(null)

onMounted(() => (mounted.value = true))

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    panel.value?.focus()
  } else {
    button.value?.focus()
  }
}
function onKeydown(e) {
  if (e.key === 'Escape' && open.value) toggle()
}
</script>

<template>
  <div v-if="env.chatEnabled && mounted" class="fixed bottom-4 right-4 z-40" @keydown="onKeydown">
    <section
      v-show="open"
      id="chat-panel"
      ref="panel"
      tabindex="-1"
      role="dialog"
      aria-label="Chat do AgendasPro"
      class="mb-3 flex h-[28rem] max-h-[70dvh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
    >
      <header class="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
        <h2 class="text-base font-semibold !text-white">Fale com a gente</h2>
        <button type="button" class="rounded p-1 hover:bg-white/15" aria-label="Fechar chat" @click="toggle">
          <AppIcon name="x" :size="20" />
        </button>
      </header>
      <div class="flex-1 overflow-y-auto p-4">
        <ChatGate v-if="!audience" @select="audience = $event" />
        <div v-else class="space-y-3 text-sm">
          <p class="rounded-xl bg-brand-50 p-3 text-ink">
            {{
              audience === 'customer'
                ? 'Você está procurando agendar um atendimento.'
                : 'Você tem uma empresa interessada no AgendasPro.'
            }}
          </p>
          <p class="text-ink-soft">
            O atendimento por chat (e por voz) está em breve. Enquanto isso, use o WhatsApp ou o formulário de contato.
          </p>
          <button type="button" class="text-brand-700 underline" @click="audience = null">Trocar escolha</button>
        </div>
      </div>
      <form class="flex gap-2 border-t border-line p-3" @submit.prevent>
        <label for="chat-input" class="sr-only">Mensagem</label>
        <input id="chat-input" type="text" class="field" placeholder="Em breve" disabled />
        <button type="submit" class="btn btn-primary" disabled>Enviar</button>
      </form>
    </section>

    <button
      ref="button"
      type="button"
      class="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop hover:bg-brand-700"
      :aria-expanded="open"
      aria-controls="chat-panel"
      :aria-label="open ? 'Fechar chat' : 'Abrir chat'"
      @click="toggle"
    >
      <AppIcon :name="open ? 'x' : 'chat'" :size="26" />
    </button>
  </div>
</template>
