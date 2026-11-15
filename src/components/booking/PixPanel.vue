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
  <section class="rounded-2xl border border-[var(--color-line)] bg-white p-5 text-center" aria-labelledby="pix-title">
    <h2 id="pix-title" class="text-lg">
      {{ phase === 'expired' ? 'Prazo do Pix encerrado' : phase === 'cancelled' ? 'Agendamento cancelado' : 'Pague o sinal para garantir o horário' }}
    </h2>
    <p v-if="amount && (phase === 'pending' || phase === 'verifying')" class="mt-1 text-2xl font-bold">{{ formatBRL(amount) }}</p>

    <template v-if="phase === 'pending' || phase === 'verifying'">
      <p v-if="!hasPix" class="mt-4 text-sm text-[var(--color-ink-soft)]" role="status">Gerando o seu Pix...</p>
      <template v-else>
        <img v-if="qrSrc" :src="qrSrc" alt="QR Code Pix para pagar o sinal" width="192" height="192" class="mx-auto my-4 h-48 w-48 rounded-lg border border-[var(--color-line)]" />
        <p class="text-sm text-[var(--color-ink-soft)]">
          Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou use o código abaixo.
        </p>
        <label for="pix-code" class="sr-only">Pix copia e cola</label>
        <textarea id="pix-code" class="field mt-3 font-mono text-xs" rows="3" readonly :value="live.pix_copy_paste" @focus="$event.target.select()" />
        <button type="button" class="btn btn-outline mt-3 w-full" @click="copy">
          <AppIcon name="copy" :size="18" /> {{ copied ? 'Código copiado' : 'Copiar código Pix' }}
        </button>
        <p class="sr-only" role="status" aria-live="polite">{{ copied ? 'Código Pix copiado' : '' }}</p>
      </template>

      <p v-if="phase === 'verifying'" class="mt-4 text-sm font-semibold" role="status">Conferindo o pagamento...</p>
      <p v-else-if="remaining !== null" class="mt-4 text-sm font-semibold" aria-live="off">Expira em {{ formatCountdown(remaining) }}</p>

      <button type="button" class="btn btn-primary mt-3 w-full" :disabled="checking" :aria-busy="checking" @click="checkManual">
        {{ checking ? 'Verificando...' : 'Já paguei, verificar' }}
      </button>
      <p v-if="checkError" class="field-error" role="status">{{ checkError }}</p>
      <p class="mt-3 text-xs text-[var(--color-ink-soft)]">O horário é confirmado automaticamente após o pagamento. Pagamento processado pelo Asaas.</p>
    </template>

    <template v-else-if="phase === 'expired'">
      <p class="mt-4 text-[var(--color-ink-soft)]" role="alert">{{ expiredText }}</p>
      <button v-if="expiredReason !== 'paid_after_expiry'" type="button" class="btn btn-primary mt-4 w-full" @click="emit('retry')">Refazer agendamento</button>
    </template>

    <p v-else class="mt-4 text-[var(--color-ink-soft)]" role="status">Este agendamento foi cancelado e o horário foi liberado.</p>
  </section>
</template>
