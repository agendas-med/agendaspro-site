<script setup>
// Pagamento do sinal por Pix: QR, copia e cola, validade (contagem regressiva) e consulta periódica
// do status do agendamento. Emite `confirmed` quando o core confirma o pagamento e `expired` ao vencer.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { publicApi } from '../../services/publicApi.js'
import { secondsUntil, formatCountdown } from '../../lib/datetime.js'
import { formatBRL } from '../../lib/commission.js'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  payment: { type: Object, required: true }, // {provider, pix_qr_base64, pix_copy_paste, expires_at}
  token: { type: String, required: true },
  amountCents: { type: Number, default: 0 },
  pollMs: { type: Number, default: 5000 },
})
const emit = defineEmits(['confirmed', 'expired'])

const remaining = ref(secondsUntil(props.payment.expires_at))
const checking = ref(false)
const copied = ref(false)
const checkError = ref('')
const expired = computed(() => remaining.value <= 0)
let tick
let poll
let done = false

const qrSrc = computed(() => {
  const v = props.payment.pix_qr_base64 || ''
  if (!v) return ''
  return v.startsWith('data:') ? v : `data:image/png;base64,${v}`
})

async function check(manual = false) {
  if (done || checking.value) return
  checking.value = true
  if (manual) checkError.value = ''
  try {
    const r = await publicApi.getBooking(props.token)
    if (r.booking.status === 'confirmed') {
      done = true
      stop()
      emit('confirmed', r.booking)
    } else if (r.booking.status === 'cancelled' && !expired.value) {
      done = true
      stop()
      emit('expired')
    } else if (manual) {
      checkError.value = 'Ainda não identificamos o pagamento. Pode levar alguns segundos após pagar.'
    }
  } catch {
    if (manual) checkError.value = 'Não foi possível consultar agora. Tente de novo em instantes.'
  } finally {
    checking.value = false
  }
}

function stop() {
  clearInterval(tick)
  clearInterval(poll)
}

onMounted(() => {
  tick = setInterval(() => {
    remaining.value = secondsUntil(props.payment.expires_at)
    if (remaining.value <= 0 && !done) {
      done = true
      stop()
      emit('expired')
    }
  }, 1000)
  poll = setInterval(() => check(false), props.pollMs)
})
onBeforeUnmount(stop)

async function copy() {
  const text = props.payment.pix_copy_paste
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
</script>

<template>
  <section class="rounded-2xl border border-[var(--color-line)] bg-white p-5 text-center" aria-labelledby="pix-title">
    <h2 id="pix-title" class="text-lg">Pague o sinal para garantir o horário</h2>
    <p v-if="amountCents" class="mt-1 text-2xl font-bold">{{ formatBRL(amountCents) }}</p>

    <template v-if="!expired">
      <img v-if="qrSrc" :src="qrSrc" alt="QR Code Pix para pagar o sinal" width="192" height="192" class="mx-auto my-4 h-48 w-48 rounded-lg border border-[var(--color-line)]" />
      <p class="text-sm text-[var(--color-ink-soft)]">
        Abra o app do seu banco, escolha pagar com Pix e leia o QR Code, ou use o código abaixo.
      </p>
      <label for="pix-code" class="sr-only">Pix copia e cola</label>
      <textarea id="pix-code" class="field mt-3 font-mono text-xs" rows="3" readonly :value="payment.pix_copy_paste" @focus="$event.target.select()" />
      <button type="button" class="btn btn-outline mt-3 w-full" @click="copy">
        <AppIcon name="copy" :size="18" /> {{ copied ? 'Código copiado' : 'Copiar código Pix' }}
      </button>
      <p class="sr-only" role="status" aria-live="polite">{{ copied ? 'Código Pix copiado' : '' }}</p>
      <p class="mt-4 text-sm font-semibold" aria-live="off">Expira em {{ formatCountdown(remaining) }}</p>
      <button type="button" class="btn btn-primary mt-3 w-full" :disabled="checking" :aria-busy="checking" @click="check(true)">
        {{ checking ? 'Verificando...' : 'Já paguei, verificar' }}
      </button>
      <p v-if="checkError" class="field-error" role="status">{{ checkError }}</p>
      <p class="mt-3 text-xs text-[var(--color-ink-soft)]">O horário é confirmado automaticamente após o pagamento. Pagamento processado pelo Asaas.</p>
    </template>
    <p v-else class="mt-4 text-[var(--color-ink-soft)]" role="alert">O prazo para pagar o Pix terminou e o horário foi liberado. Faça um novo agendamento para tentar de novo.</p>
  </section>
</template>
