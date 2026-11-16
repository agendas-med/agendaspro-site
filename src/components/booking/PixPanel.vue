<script setup>
// Pagamento do sinal por Pix: QR (base64), copia e cola, contagem regressiva até expires_at e consulta leve do
// status do token (src/lib/pixPolling.js). Emite `confirmed`, `expired` (prazo/pagamento falhou), `cancelled`
// (cancelado por cliente/empresa) e `retry` (usuário quer refazer o agendamento).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { publicApi } from '../../services/publicApi.js'
import { createStatusPoller, interpretPixStatus, STEADY_POLL_MS } from '../../lib/pixPolling.js'
import { createCountdown } from '../../lib/countdown.js'
import { formatCountdown } from '../../lib/datetime.js'
import { formatBRL } from '../../lib/commission.js'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  payment: { type: Object, required: true }, // {provider, amount_cents, pix_qr_base64, pix_copy_paste, expires_at}
  token: { type: String, required: true },
  pollMs: { type: Number, default: STEADY_POLL_MS },
})
const emit = defineEmits(['confirmed', 'expired', 'cancelled', 'retry'])

const live = ref({ ...props.payment }) // atualizado pelo polling (o Pix pode chegar depois da criação)
const remaining = ref(null) // segundos; null = sem prazo informado
const phase = ref('pending') // pending | verifying | expired | cancelled
const expiredReason = ref('payment_expired')
const checking = ref(false)
const copied = ref(false)
const checkError = ref('')
let verifyMisses = 0
let countdown = null
let poller = null
let lastExpiresAt = null

const hasPix = computed(() => Boolean(live.value.pix_copy_paste))
const qrSrc = computed(() => {
  const v = live.value.pix_qr_base64 || ''
  if (!v) return ''
  return v.startsWith('data:') ? v : `data:image/png;base64,${v}`
})
const amount = computed(() => Number(live.value.amount_cents) || 0)

function setupCountdown() {
  const at = live.value.expires_at
  if (at === lastExpiresAt && countdown) return
  lastExpiresAt = at
  countdown?.stop()
  countdown = createCountdown(at, {
    onTick: (r) => (remaining.value = r),
    onZero: () => {
      // O relógio do aparelho não é autoritativo: confere com o servidor antes de declarar o prazo vencido.
      if (phase.value === 'pending') {
        phase.value = 'verifying'
        verifyMisses = 0
        poller?.checkNow()
      }
    },
  })
  countdown.start()
}

function finish(kind, reason) {
  poller?.stop()
  countdown?.stop()
  if (kind === 'expired') {
    expiredReason.value = reason || 'payment_expired'
    phase.value = 'expired'
    emit('expired', expiredReason.value)
  } else {
    phase.value = 'cancelled'
    emit('cancelled', reason)
  }
}

// Retorna true para encerrar o polling.
function onResult(view, manual = false) {
  const s = interpretPixStatus(view)
  if (s.kind === 'confirmed') {
    poller?.stop()
    countdown?.stop()
    emit('confirmed', s.booking)
    return true
  }
  if (s.kind === 'expired') return finish('expired', s.reason), true
  if (s.kind === 'cancelled') return finish('cancelled', s.reason), true
  if (s.kind === 'pending') {
    if (s.payment) {
      live.value = { ...live.value, ...s.payment }
      setupCountdown()
    }
    if (phase.value === 'verifying' && ++verifyMisses >= 3) return finish('expired', 'payment_expired'), true
    if (manual) checkError.value = 'Ainda não identificamos o pagamento. Pode levar alguns segundos após pagar.'
  }
  return false
}

async function checkManual() {
  if (checking.value || !poller) return
  checking.value = true
  checkError.value = ''
  try {
    const view = await publicApi.getBooking(props.token)
    if (onResult(view, true) === true) return
  } catch {
    checkError.value = 'Não foi possível consultar agora. Tente de novo em instantes.'
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  poller = createStatusPoller({
    fetchStatus: () => publicApi.getBooking(props.token),
    onResult: (v) => onResult(v),
    steadyMs: props.pollMs,
  })
  setupCountdown()
  // Pix ainda não gerado (corrida documentada no core): busca já.
  poller.start({ immediate: !hasPix.value })
})
onBeforeUnmount(() => {
  poller?.stop()
  countdown?.stop()
})

async function copy() {
  const text = live.value.pix_copy_paste
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* sem suporte: o usuário pode copiar manualmente do campo */
    }
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2500)
}

const expiredText = computed(() =>
  expiredReason.value === 'paid_after_expiry'
    ? 'Identificamos um pagamento depois do prazo e o horário já havia sido ocupado. Fale com o estabelecimento para o estorno.'
    : expiredReason.value === 'payment_failed'
      ? 'Não foi possível gerar o Pix e o horário foi liberado. Você pode tentar de novo.'
      : 'O prazo para pagar o Pix terminou e o horário foi liberado. Refaça o agendamento para tentar de novo.',
)
</script>

<template>
  <section class="px-panel rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-card sm:p-5" aria-labelledby="pix-title">
    <template v-if="phase === 'pending' || phase === 'verifying'">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div class="min-w-0">
          <h2 id="pix-title" class="text-base">Pagar com Pix</h2>
          <p v-if="amount" class="text-2xl font-bold leading-tight">{{ formatBRL(amount) }}</p>
        </div>
        <p v-if="phase === 'verifying'" class="px-pill" role="status">Conferindo o pagamento...</p>
        <p v-else-if="remaining !== null" class="px-pill" :class="{ 'px-pill-warn': remaining <= 120 }" aria-live="off">
          <AppIcon name="clock" :size="16" /> Expira em {{ formatCountdown(remaining) }}
        </p>
      </div>

      <p v-if="!hasPix" class="mt-4 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]" role="status">
        <span class="px-spin" aria-hidden="true"></span> Gerando o seu Pix...
      </p>
      <template v-else>
        <!-- no celular o copia e cola vem primeiro: quem paga no mesmo aparelho não consegue ler o QR -->
        <div class="mt-4 grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
          <img v-if="qrSrc" :src="qrSrc" alt="QR Code Pix para pagar o sinal" width="176" height="176" class="order-2 mx-auto h-44 w-44 rounded-lg border border-[var(--color-line)] md:order-1" />
          <div class="order-1 md:order-2">
            <label for="pix-code" class="text-sm font-semibold">Pix copia e cola</label>
            <textarea id="pix-code" class="field mt-1 font-mono text-xs" rows="3" readonly :value="live.pix_copy_paste" @focus="$event.target.select()" />
            <button type="button" class="px-copy mt-2" @click="copy">
              <AppIcon :name="copied ? 'check' : 'copy'" :size="18" /> {{ copied ? 'Código copiado' : 'Copiar código Pix' }}
            </button>
            <p class="sr-only" role="status" aria-live="polite">{{ copied ? 'Código Pix copiado' : '' }}</p>
            <ol class="mt-3 list-decimal space-y-0.5 pl-5 text-sm text-[var(--color-ink-soft)]">
              <li>Abra o app do seu banco e escolha pagar com Pix.</li>
              <li>Cole o código ou leia o QR Code.</li>
              <li>Confirme o pagamento: o horário é garantido na hora.</li>
            </ol>
          </div>
        </div>
      </template>

      <button type="button" class="btn btn-outline mt-4 w-full" :disabled="checking" :aria-busy="checking" @click="checkManual">
        {{ checking ? 'Verificando...' : 'Já paguei, verificar' }}
      </button>
      <p v-if="checkError" class="field-error" role="status">{{ checkError }}</p>
      <p class="mt-3 text-center text-xs text-[var(--color-ink-soft)]">O horário é confirmado automaticamente após o pagamento. Pagamento processado pelo Asaas.</p>
    </template>

    <template v-else-if="phase === 'expired'">
      <h2 id="pix-title" class="text-base">Prazo do Pix encerrado</h2>
      <p class="mt-2 text-sm text-[var(--color-ink-soft)]" role="alert">{{ expiredText }}</p>
      <button v-if="expiredReason !== 'paid_after_expiry'" type="button" class="btn btn-primary mt-4 w-full" @click="emit('retry')">Refazer agendamento</button>
    </template>

    <template v-else>
      <h2 id="pix-title" class="text-base">Agendamento cancelado</h2>
      <p class="mt-2 text-sm text-[var(--color-ink-soft)]" role="status">Este agendamento foi cancelado e o horário foi liberado.</p>
    </template>
  </section>
</template>

<style scoped>
.px-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 9999px;
  background: #f1f5f9;
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}
.px-pill-warn {
  background: #fef3c7;
  color: #92400e;
}
.px-copy {
  display: inline-flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  background: var(--bk, var(--color-brand-600));
  color: var(--bk-fg, #fff);
  font-weight: 600;
  transition: filter 0.15s;
}
.px-copy:hover {
  filter: brightness(0.92);
}
.px-copy:focus-visible {
  outline: 3px solid var(--bk, var(--color-brand-600));
  outline-offset: 2px;
}
.px-spin {
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  border: 2px solid #cbd5e1;
  border-top-color: var(--bk, var(--color-brand-600));
  animation: px-rot 0.8s linear infinite;
}
@keyframes px-rot {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .px-spin {
    animation: none;
  }
}
</style>
