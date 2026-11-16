<script setup>
// Painel do chat (carregado sob demanda pelo ChatWidget). A lógica fica em src/lib/chatController.js;
// aqui só a UI: foco, ESC, aria-live, Turnstile (só depois da escolha da audiência) e estados.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { chatApi } from '../../services/chatApi.js'
import { createChatController } from '../../lib/chatController.js'
import { safeSessionStorage } from '../../lib/chatStorage.js'
import { chatLinkPolicy, chatOwnHosts } from '../../lib/chatLinks.js'
import { formatWait } from '../../lib/chatFormat.js'
import { whatsappIsConfigured, whatsappLink } from '../../config/company.js'
import { track } from '../../services/analytics.js'
import AppIcon from '../ui/AppIcon.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'
import ChatMessage from './ChatMessage.vue'
import ChatLeadForm from './ChatLeadForm.vue'
import ChatRating from './ChatRating.vue'

const props = defineProps({
  slug: { type: String, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'disabled'])

const controller = createChatController({ api: chatApi, storage: safeSessionStorage(), slug: props.slug })
const s = controller.state

const root = ref(null)
const log = ref(null)
const input = ref(null)
const turnstile = ref(null)
const tsError = ref(false)
const confirmClose = ref(false)
let timer = null

const policy = computed(() => chatLinkPolicy())
const ownHosts = computed(() => chatOwnHosts())

const lastId = computed(() => s.messages[s.messages.length - 1]?.id)
const hasFailed = computed(() => s.messages.some((m) => m.status === 'failed'))
const limitReached = computed(() => Boolean(s.remaining && s.remaining.messages <= 0))
const waiting = computed(() => s.retryIn > 0)
const canSend = computed(() => s.draft.trim().length > 0 && !s.busy && !waiting.value && !hasFailed.value)
const showTyping = computed(() => s.typing && !s.messages.some((m) => m.status === 'streaming'))
const canRate = computed(() => s.phase === 'ended' && ['closed', 'closed_by_user'].includes(s.endReason))
const hasUserMessage = computed(() => s.messages.some((m) => m.role === 'user'))
const subtitle = computed(() => (s.audience === 'customer' && s.company?.name ? s.company.name : 'Tire dúvidas sobre o AgendasPro'))
const whatsHref = computed(() =>
  whatsappIsConfigured() ? whatsappLink(s.audience === 'customer' ? 'Olá! Gostaria de falar com a equipe.' : 'Olá! Quero conhecer o AgendasPro.') : '',
)
const charsLeft = computed(() => (s.limits.max_chars || 500) - s.draft.length)

const ENDED_TEXT = {
  expired: 'Esta conversa expirou. Inicie uma nova para continuar.',
  closed: 'Esta conversa foi encerrada.',
  closed_by_user: 'Conversa encerrada. Obrigado por conversar com a gente!',
  blocked: 'Esta conversa foi encerrada por segurança. Fale com a nossa equipe pelo WhatsApp ou pelo formulário de contato.',
  message_limit: 'Você atingiu o limite de mensagens desta conversa. Para continuar, fale com a nossa equipe.',
  not_found: 'Não encontramos o atendimento desta página.',
  rate_limited: 'Muitas conversas iniciadas hoje. Tente de novo mais tarde ou fale com a nossa equipe.',
  unavailable: 'O atendimento por chat está temporariamente indisponível.',
  restore_failed: 'Não foi possível retomar a conversa.',
}
const endedText = computed(() => (s.endText && s.endReason !== 'expired' ? s.endText : ENDED_TEXT[s.endReason] || 'Conversa encerrada.'))
const showFallback = computed(() => ['blocked', 'message_limit', 'unavailable', 'rate_limited', 'not_found'].includes(s.endReason) || (s.phase === 'chat' && limitReached.value))

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function scrollDown() {
  nextTick(() => {
    const el = log.value
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion() ? 'auto' : 'smooth' })
  })
}
function focusMain() {
  nextTick(() => {
    if (!props.open) return
    const target =
      (s.phase === 'chat' && !limitReached.value && input.value) ||
      root.value?.querySelector('[data-autofocus]') ||
      root.value?.querySelector('#chat-title')
    target?.focus({ preventScroll: true })
  })
}

watch(() => s.messages.length, scrollDown)
watch(
  () => s.messages[s.messages.length - 1]?.text,
  () => scrollDown(),
)
watch(
  () => s.phase,
  (p, old) => {
    if (p === 'disabled') emit('disabled')
    if (p === 'chat' && old === 'verifying') track('chat_start', { audience: s.audience, context: props.slug ? 'booking' : 'site' })
    tsError.value = false
    confirmClose.value = false
    focusMain()
  },
)
watch(
  () => s.leadOpen,
  (v) => {
    if (!v) focusMain()
    else scrollDown()
  },
)
watch(
  () => props.open,
  (v) => {
    if (v) focusMain()
  },
)
watch(
  () => props.slug,
  (v) => controller.setContext(v),
)

// Quando o elemento focado some (ex.: o botão da nota é trocado pelo "obrigado"), o foco cai no <body> e o
// keydown do painel não recebe mais nada: o ESC precisa continuar funcionando e o Tab devolve o foco ao painel.
function onWindowKeydown(e) {
  if (!props.open || !root.value) return
  const a = document.activeElement
  if (a && a !== document.body && root.value.contains(a)) return // o handler do painel cuida
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'Tab' && (!a || a === document.body)) {
    e.preventDefault()
    focusMain()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  timer = setInterval(() => controller.tick(), 1000)
  controller.restore().finally(focusMain)
  focusMain()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  clearInterval(timer)
  controller.dispose()
})

// --- Turnstile: só existe na fase "verifying" (depois da escolha da audiência) ---
function onToken(t) {
  tsError.value = false
  controller.start(t)
}
function onTsError() {
  tsError.value = true
}
function retryStart() {
  controller.clearStartError()
  tsError.value = false
  // token já renovado => cria agora; senão o evento `token` do widget dispara o start
  const t = turnstile.value?.getToken()
  if (t) controller.start(t)
}
// Tokens são de uso único: se a criação falhar, o próximo precisa vir de um novo desafio.
watch(
  () => s.startError,
  (e) => {
    if (e && turnstile.value?.mode === 'widget') turnstile.value.reset()
  },
)

function pick(audience) {
  controller.chooseAudience(audience)
  track('chat_audience', { audience })
}

function submitMessage() {
  if (controller.send()) {
    nextTick(() => input.value?.focus({ preventScroll: true }))
  }
}
function onComposerKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submitMessage()
  }
}
function suggest(text) {
  controller.send(text)
}

async function submitLead(form) {
  const r = await controller.submitLead(form)
  if (r.ok) track('generate_lead', { location: 'chat' })
}
async function doClose() {
  confirmClose.value = false
  await controller.close()
}

// ESC fecha o painel; Tab fica dentro dele (foco gerenciado).
function onKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !root.value) return
  const list = [...root.value.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null,
  )
  if (!list.length) return
  const first = list[0]
  const last = list[list.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <section
    ref="root"
    role="dialog"
    aria-modal="false"
    aria-labelledby="chat-title"
    tabindex="-1"
    class="flex h-[min(34rem,calc(var(--ap-vvh,100dvh)-1.5rem-env(safe-area-inset-bottom,0px)))] w-[calc(100vw-1.5rem)] max-w-sm sm:h-[min(34rem,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop outline-none"
    @keydown="onKeydown"
  >
    <header class="flex items-start justify-between gap-2 bg-brand-600 px-4 py-3 text-white">
      <div class="min-w-0">
        <h2 id="chat-title" tabindex="-1" class="text-base font-semibold !text-white outline-none">Assistente AgendasPro</h2>
        <p class="truncate text-xs text-white/85">{{ subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          v-if="s.phase === 'chat' && hasUserMessage && !confirmClose"
          type="button"
          class="min-h-11 rounded px-3 text-xs font-medium hover:bg-white/15"
          @click="confirmClose = true"
        >
          Encerrar
        </button>
        <button type="button" class="grid h-11 w-11 place-items-center rounded hover:bg-white/15" aria-label="Fechar chat" @click="emit('close')">
          <AppIcon name="x" :size="20" />
        </button>
      </div>
    </header>

    <div v-if="confirmClose" class="flex items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-900" role="alert">
      <span>Encerrar esta conversa?</span>
      <span class="flex gap-3">
        <button type="button" class="font-semibold underline" :disabled="s.closing" @click="doClose">Sim, encerrar</button>
        <button type="button" class="underline" @click="confirmClose = false">Continuar</button>
      </span>
    </div>

    <div ref="log" class="flex-1 space-y-3 overflow-y-auto p-4">
      <!-- 1) pergunta de audiência: nada é criado no servidor antes dela -->
      <div v-if="s.phase === 'gate'">
        <p v-if="s.restoring" role="status" class="text-sm text-[var(--color-ink-soft)]">Retomando a conversa…</p>
        <fieldset v-else>
          <legend class="text-base font-semibold">Olá! Para começar, me conta:</legend>
          <p class="mt-1 text-xs text-[var(--color-ink-soft)]">Assim eu respondo do jeito certo para você.</p>
          <div class="mt-3 space-y-2">
            <button
              type="button"
              data-autofocus
              class="w-full rounded-xl border border-line p-3 text-left text-sm font-medium hover:border-brand-600 hover:bg-brand-50"
              @click="pick('customer')"
            >
              Quero agendar ou tirar dúvidas como cliente
            </button>
            <button type="button" class="w-full rounded-xl border border-line p-3 text-left text-sm font-medium hover:border-brand-600 hover:bg-brand-50" @click="pick('business')">
              Tenho um negócio e quero conhecer o AgendasPro
            </button>
          </div>
          <p class="mt-3 text-xs text-[var(--color-ink-soft)]">
            A conversa só começa depois da sua escolha, com uma verificação de segurança automática (Cloudflare Turnstile).
          </p>
        </fieldset>
      </div>

      <!-- 2) verificação de segurança -> cria a sessão -->
      <div v-else-if="s.phase === 'verifying'" class="space-y-3" data-autofocus tabindex="-1">
        <p class="text-sm font-medium">
          {{ s.audience === 'customer' ? 'Certo, vamos falar sobre o seu atendimento.' : 'Certo, vamos falar sobre o AgendasPro para o seu negócio.' }}
        </p>
        <TurnstileWidget ref="turnstile" @token="onToken" @error="onTsError" />
        <p v-if="s.starting" role="status" class="text-sm text-[var(--color-ink-soft)]">Iniciando a conversa…</p>
        <div v-if="s.startError || tsError" class="space-y-2" role="alert">
          <p class="field-error">{{ s.startError?.text || 'Não foi possível concluir a verificação de segurança.' }}</p>
          <button v-if="!s.startError || s.startError.retryable" type="button" class="btn btn-primary w-full" @click="s.startError ? retryStart() : controller.backToGate()">
            {{ s.startError ? 'Tentar de novo' : 'Voltar' }}
          </button>
        </div>
        <button v-if="!s.starting" type="button" class="text-xs underline" @click="controller.backToGate()">Trocar a minha escolha</button>
      </div>

      <!-- 3) conversa / encerrada -->
      <template v-else-if="s.phase === 'chat' || s.phase === 'ended'">
        <ol role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversa" :aria-busy="s.busy" class="space-y-3">
          <ChatMessage
            v-for="m in s.messages"
            :key="m.id"
            :message="m"
            :policy="policy"
            :own-hosts="ownHosts"
            :is-last="m.id === lastId && s.phase === 'chat'"
            :busy="s.busy"
            :audience="s.audience || 'customer'"
            :company="s.company"
            :lead-sent="s.leadSent"
            :retry-blocked="s.busy || waiting"
            @suggest="suggest"
            @retry="controller.retry"
            @discard="controller.discard"
            @lead="controller.openLead"
          />
          <li v-if="showTyping" class="flex items-start" aria-hidden="true">
            <span class="flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-3 py-3">
              <span v-for="i in 3" :key="i" class="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-pulse" :style="{ animationDelay: `${i * 150}ms` }" />
            </span>
          </li>
        </ol>
        <p v-if="showTyping" class="sr-only" role="status">O assistente está digitando.</p>

        <ChatLeadForm v-if="s.leadOpen" :busy="s.leadBusy" :error="s.leadError" @submit="submitLead" @cancel="controller.closeLead" />

        <div v-if="s.phase === 'ended'" class="space-y-3" role="status">
          <p class="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{{ endedText }}</p>
          <ChatRating v-if="canRate" :busy="s.ratingBusy" :done="s.rated" :error="s.ratingError" @rate="controller.rate" />
          <button v-if="s.endReason === 'restore_failed'" type="button" class="btn btn-primary w-full" @click="controller.retryRestore()">Tentar de novo</button>
          <button
            v-else-if="!['blocked', 'not_found', 'rate_limited', 'unavailable'].includes(s.endReason)"
            type="button"
            class="btn btn-primary w-full"
            data-autofocus
            @click="controller.newConversation()"
          >
            Iniciar nova conversa
          </button>
        </div>
      </template>

      <div v-else-if="s.phase === 'disabled'" class="text-sm">O chat está indisponível no momento.</div>

      <div v-if="showFallback || tsError" class="space-y-2 rounded-xl border border-line p-3 text-sm">
        <p class="font-medium">Prefere falar com a nossa equipe?</p>
        <div class="flex flex-wrap gap-2">
          <a v-if="whatsHref" :href="whatsHref" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp text-sm">WhatsApp</a>
          <RouterLink to="/contato" class="btn btn-outline text-sm">Formulário de contato</RouterLink>
          <button v-if="s.audience === 'business' && !s.leadSent && s.phase !== 'verifying'" type="button" class="btn btn-primary text-sm" @click="controller.openLead()">Deixar meu contato</button>
        </div>
      </div>
    </div>

    <div class="border-t border-line bg-white">
      <!-- A contagem muda a cada segundo: fica fora da região viva (aria-hidden) para o leitor de tela não repetir. -->
      <div class="min-h-5 px-3 pt-2 text-xs">
        <div aria-live="polite">
          <p v-if="s.notice" :class="s.notice.kind === 'error' ? 'text-red-700' : 'text-[var(--color-ink-soft)]'">{{ s.notice.text }}</p>
        </div>
        <p v-if="waiting" aria-hidden="true" class="text-[var(--color-ink-soft)]">Tente de novo em {{ formatWait(s.retryIn) }}.</p>
      </div>
      <form v-if="s.phase === 'chat' && !limitReached" class="flex items-end gap-2 px-3 pb-2" @submit.prevent="submitMessage">
        <label for="chat-input" class="sr-only">Sua mensagem</label>
        <textarea
          id="chat-input"
          ref="input"
          v-model="s.draft"
          rows="1"
          class="field max-h-28 min-h-11 flex-1 resize-none"
          placeholder="Escreva sua mensagem"
          :maxlength="s.limits.max_chars || 500"
          :aria-describedby="s.inputError ? 'chat-input-err' : undefined"
          :aria-invalid="Boolean(s.inputError)"
          autocomplete="off"
          @keydown="onComposerKey"
        />
        <button type="submit" class="btn btn-primary shrink-0" :disabled="!canSend" :aria-busy="s.busy">{{ s.busy ? '…' : 'Enviar' }}</button>
      </form>
      <p v-if="s.inputError" id="chat-input-err" class="field-error px-3" role="alert">{{ s.inputError }}</p>
      <p v-if="s.phase === 'chat' && !limitReached" class="flex justify-between px-3 pb-1 text-[11px] text-[var(--color-ink-soft)]">
        <span v-if="s.remaining">{{ s.remaining.messages }} {{ s.remaining.messages === 1 ? 'mensagem restante' : 'mensagens restantes' }}</span>
        <span v-else />
        <span v-if="charsLeft < 100" :class="charsLeft < 0 ? 'text-red-700' : ''">{{ charsLeft }} caracteres</span>
      </p>
      <p class="px-3 pb-3 text-[11px] leading-snug text-[var(--color-ink-soft)]">
        Assistente de IA — pode errar; não substitui atendimento humano.
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" class="underline">Política de privacidade</a>
      </p>
    </div>
  </section>
</template>
