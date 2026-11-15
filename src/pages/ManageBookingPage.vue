<script setup>
// /agendamento/:token — consultar, cancelar e remarcar um agendamento (link recebido na confirmação).
// Contrato: docs/contratos-f3.md do core (GET/cancel/reschedule por token; Pix do sinal enquanto pending_payment).
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { publicApi, friendlyError, ApiError } from '../services/publicApi.js'
import { useSeo } from '../composables/useSeo.js'
import { todayInTz, addDays, weekdayShort, dayOfMonth, monthShort, formatDateLong, formatLocalDateTime } from '../lib/datetime.js'
import AppIcon from '../components/ui/AppIcon.vue'
import PixPanel from '../components/booking/PixPanel.vue'

useSeo({
  title: 'Meu agendamento | AgendasPro',
  description: 'Consulte, remarque ou cancele o seu agendamento.',
  noindex: true,
})

const route = useRoute()
const token = String(route.params.token)

const state = ref('loading') // loading | ready | notfound | expired | error
const loadError = ref('')
const data = ref(null)
const booking = computed(() => data.value?.booking || null)
const company = computed(() => data.value?.company || null)
const policy = computed(() => data.value?.policy || { can_cancel: false, can_reschedule: false, min_notice_hours: 0 })
const tz = computed(() => company.value?.timezone || 'America/Sao_Paulo')

const heading = ref(null)
const mode = ref('view') // view | confirm-cancel | reschedule
const notice = ref('')
const actionError = ref('')
const busy = ref(false)
const cooldown = ref(0)
let cooldownTimer

async function load() {
  state.value = 'loading'
  try {
    data.value = await publicApi.getBooking(token)
    state.value = 'ready'
  } catch (e) {
    loadError.value = friendlyError(e)
    state.value =
      e instanceof ApiError && (e.status === 410 || e.code === 'token_expired')
        ? 'expired'
        : e instanceof ApiError && e.status === 404
          ? 'notfound'
          : 'error'
  }
}

// Recarrega o estado real do servidor (política mudou, Pix expirou, pagamento caiu...) sem derrubar a tela.
async function refresh() {
  try {
    data.value = await publicApi.getBooking(token)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 410 || e.code === 'token_expired')) {
      loadError.value = friendlyError(e)
      state.value = 'expired'
    }
    /* outros erros: mantém a tela atual */
  }
}

const status = computed(() => booking.value?.status)
const statusLabel = computed(
  () =>
    ({
      confirmed: 'Confirmado',
      pending_payment: 'Aguardando pagamento do sinal',
      cancelled: 'Cancelado',
      completed: 'Concluído',
    })[status.value] || status.value,
)
const statusClass = computed(
  () =>
    ({
      confirmed: 'bg-emerald-100 text-emerald-800',
      pending_payment: 'bg-amber-100 text-amber-800',
      cancelled: 'bg-slate-200 text-slate-700',
    })[status.value] || 'bg-slate-100 text-slate-700',
)
const active = computed(() => status.value === 'confirmed' || status.value === 'pending_payment')

const CANCEL_REASONS = {
  customer: 'Cancelado por você.',
  company: 'Cancelado pelo estabelecimento.',
  payment_expired: 'O prazo para pagar o sinal terminou e o horário foi liberado.',
  payment_failed: 'Não foi possível gerar o Pix do sinal e o horário foi liberado.',
  paid_after_expiry:
    'O pagamento chegou depois do prazo e o horário já havia sido ocupado. Fale com o estabelecimento para o estorno.',
}
const cancelReasonText = computed(() => (status.value === 'cancelled' ? CANCEL_REASONS[booking.value?.cancellation_reason] || '' : ''))
const rebookHref = computed(() => (company.value?.slug ? `/b/${encodeURIComponent(company.value.slug)}` : ''))

function startCooldown(s) {
  cooldown.value = Math.max(1, Math.min(Number(s) || 15, 120))
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

function handleActionError(e) {
  actionError.value = friendlyError(e)
  if (e instanceof ApiError && e.status === 429) startCooldown(e.retryAfter)
  // A política/estado mudou no servidor: volta para a visualização com os dados atualizados.
  if (e instanceof ApiError && (e.code === 'not_allowed' || e.code === 'cancel_window_closed')) {
    mode.value = 'view'
    refresh()
  }
}

// Resposta de cancel/reschedule traz a visão completa ({booking, company?, policy?, payment?}); mescla sem perder o que faltar.
function applyView(r, forced = {}) {
  data.value = {
    ...data.value,
    ...(r?.company ? { company: r.company } : {}),
    ...(r?.policy ? { policy: r.policy } : {}),
    ...(r && 'payment' in r ? { payment: r.payment } : {}),
    booking: { ...data.value.booking, ...(r?.booking || {}), ...forced },
  }
}

function onPixConfirmed(b) {
  applyView({ booking: b }, { status: 'confirmed' })
  notice.value = 'Pagamento identificado. Seu agendamento está confirmado.'
  refresh() // política (cancelar/remarcar) muda após confirmar
}
function onPixClosed() {
  refresh() // expirou/cancelou: traz status e cancellation_reason reais
}

async function focusHeading() {
  await nextTick()
  heading.value?.focus()
}

// ---------- cancelar ----------
async function cancel() {
  if (busy.value || cooldown.value > 0) return
  busy.value = true
  actionError.value = ''
  try {
    const r = await publicApi.cancelBooking(token)
    applyView(r, { status: 'cancelled' })
    notice.value = 'Agendamento cancelado. O horário foi liberado.'
    mode.value = 'view'
    focusHeading()
  } catch (e) {
    if (e instanceof ApiError && e.code === 'already_cancelled') {
      applyView(null, { status: 'cancelled' })
      mode.value = 'view'
    }
    handleActionError(e)
  } finally {
    busy.value = false
  }
}

// ---------- remarcar ----------
const days = ref([])
const availState = ref('idle')
const availError = ref('')
const windowsLoaded = ref(0)
const selDate = ref('')
const selTime = ref('')
let lastTo = ''

async function fetchWindow(reset) {
  const from = reset ? todayInTz(tz.value) : addDays(lastTo, 1)
  const to = addDays(from, 13)
  const r = await publicApi.getAvailability(company.value.slug, {
    serviceIds: booking.value.service_ids || [],
    professionalId: booking.value.professional_id || undefined,
    from,
    to,
  })
  lastTo = to
  windowsLoaded.value = reset ? 1 : windowsLoaded.value + 1
  const withSlots = (r.days || []).filter((d) => d.slots?.length)
  days.value = reset ? withSlots : [...days.value, ...withSlots]
}

async function loadAvailability(reset = true) {
  availState.value = 'loading'
  availError.value = ''
  try {
    await fetchWindow(reset)
    let guard = 0
    while (!days.value.length && windowsLoaded.value < 3 && guard++ < 2) await fetchWindow(false)
    availState.value = 'idle'
    if (!selDate.value || !days.value.some((d) => d.date === selDate.value)) selDate.value = days.value[0]?.date || ''
  } catch (e) {
    availError.value = friendlyError(e)
    availState.value = 'error'
  }
}

async function openReschedule() {
  actionError.value = ''
  notice.value = ''
  selTime.value = ''
  mode.value = 'reschedule'
  focusHeading()
  await loadAvailability(true)
}

const daySlots = computed(() => {
  const d = days.value.find((x) => x.date === selDate.value)
  if (!d) return []
  const seen = new Map()
  for (const s of d.slots) if (!seen.has(s.start)) seen.set(s.start, s)
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start))
})

async function reschedule() {
  if (busy.value || !selTime.value || cooldown.value > 0) return
  busy.value = true
  actionError.value = ''
  try {
    const r = await publicApi.rescheduleBooking(token, `${selDate.value}T${selTime.value}`)
    applyView(r)
    notice.value = 'Agendamento remarcado. Você receberá a nova confirmação pelo WhatsApp.'
    mode.value = 'view'
    focusHeading()
  } catch (e) {
    handleActionError(e)
    if (e instanceof ApiError && e.code === 'slot_taken') {
      selTime.value = ''
      await loadAvailability(true)
    }
  } finally {
    busy.value = false
  }
}

function back() {
  mode.value = 'view'
  actionError.value = ''
  focusHeading()
}

onMounted(load)
onBeforeUnmount(() => clearInterval(cooldownTimer))
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <div v-if="state === 'loading'" class="mx-auto max-w-xl p-6" role="status" aria-live="polite">
      <div class="h-24 animate-pulse rounded-2xl bg-slate-200" />
      <div class="mt-4 h-40 animate-pulse rounded-2xl bg-slate-200" />
      <span class="sr-only">Carregando agendamento...</span>
    </div>

    <main v-else-if="state !== 'ready'" id="conteudo" class="mx-auto max-w-xl p-6 text-center">
      <h1 class="text-2xl">
        {{ state === 'notfound' ? 'Agendamento não encontrado' : state === 'expired' ? 'Este link expirou' : 'Não foi possível carregar' }}
      </h1>
      <p class="mt-3 text-[var(--color-ink-soft)]">
        {{
          state === 'notfound'
            ? 'O link pode estar incompleto. Confira a mensagem de confirmação ou fale com o estabelecimento.'
            : state === 'expired'
              ? 'O link de acesso a este agendamento não vale mais. Para consultar ou alterar o horário, fale com o estabelecimento.'
              : loadError
        }}
      </p>
      <button v-if="state === 'error'" type="button" class="btn btn-primary mt-6" @click="load">Tentar de novo</button>
      <RouterLink v-else to="/" class="btn btn-outline mt-6">Ir para o início</RouterLink>
    </main>

    <main v-else id="conteudo" class="mx-auto max-w-xl px-4 pb-12 pt-6">
      <p class="text-sm font-semibold text-[var(--color-ink-soft)]">{{ company.name }}</p>
      <h1 ref="heading" tabindex="-1" class="mt-1 text-2xl outline-none">
        {{ mode === 'reschedule' ? 'Remarcar agendamento' : mode === 'confirm-cancel' ? 'Cancelar agendamento?' : 'Meu agendamento' }}
      </h1>

      <p v-if="notice" class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{{ notice }}</p>

      <section class="mt-4 rounded-2xl border border-[var(--color-line)] bg-white p-4" aria-label="Detalhes do agendamento">
        <span class="inline-block rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass">{{ statusLabel }}</span>
        <p class="mt-3 font-semibold">{{ (booking.service_names || []).join(', ') }}</p>
        <p class="text-[var(--color-ink-soft)]">{{ formatLocalDateTime(booking.start) }}</p>
        <p v-if="booking.professional_name" class="text-[var(--color-ink-soft)]">com {{ booking.professional_name }}</p>
        <p v-if="cancelReasonText" class="mt-2 text-sm text-[var(--color-ink-soft)]">{{ cancelReasonText }}</p>
        <p v-if="company.address" class="mt-2 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
          <AppIcon name="pin" :size="16" class="mt-0.5 shrink-0" /> {{ company.address }}
        </p>
        <p v-if="company.phone" class="mt-1 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
          <AppIcon name="phone" :size="16" class="mt-0.5 shrink-0" /> {{ company.phone }}
        </p>
      </section>

      <p v-if="actionError" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
        {{ actionError }}<template v-if="cooldown > 0"> Tente de novo em {{ cooldown }}s.</template>
      </p>

      <!-- Pix do sinal enquanto aguarda pagamento -->
      <div v-if="status === 'pending_payment' && mode === 'view'" class="mt-5">
        <PixPanel
          :payment="data.payment || {}"
          :token="token"
          @confirmed="onPixConfirmed"
          @expired="onPixClosed"
          @cancelled="onPixClosed"
          @retry="rebookHref && $router.push(rebookHref)"
        />
      </div>

      <!-- visualização -->
      <section v-if="mode === 'view'" class="mt-5">
        <p v-if="status === 'pending_payment'" class="mb-3 text-sm text-[var(--color-ink-soft)]">
          O horário será confirmado automaticamente quando o pagamento do sinal por Pix for identificado.
        </p>
        <template v-if="active">
          <div v-if="policy.can_reschedule || policy.can_cancel" class="flex flex-col gap-3 sm:flex-row">
            <button v-if="policy.can_reschedule" type="button" class="btn btn-primary flex-1" @click="openReschedule">Remarcar</button>
            <button v-if="policy.can_cancel" type="button" class="btn btn-outline flex-1" @click="((mode = 'confirm-cancel'), (actionError = ''), (notice = ''), focusHeading())">Cancelar agendamento</button>
          </div>
          <p v-else class="rounded-xl bg-white p-3 text-sm text-[var(--color-ink-soft)]">
            O prazo para alterar este agendamento pela internet já passou<template v-if="policy.min_notice_hours"> (mínimo de {{ policy.min_notice_hours }}h de antecedência)</template>.
            <template v-if="company.phone"> Fale com o estabelecimento: {{ company.phone }}.</template>
          </p>
          <p v-if="(policy.can_cancel || policy.can_reschedule) && policy.min_notice_hours" class="mt-3 text-xs text-[var(--color-ink-soft)]">
            Alterações são permitidas com pelo menos {{ policy.min_notice_hours }}h de antecedência.
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-[var(--color-ink-soft)]">Este agendamento não pode mais ser alterado.</p>
          <RouterLink v-if="status === 'cancelled' && rebookHref" :to="rebookHref" class="btn btn-primary mt-4">Agendar novo horário</RouterLink>
        </template>
      </section>

      <!-- confirmar cancelamento -->
      <section v-else-if="mode === 'confirm-cancel'" class="mt-5" aria-live="polite">
        <p class="text-sm">Tem certeza? O horário será liberado e esta ação não pode ser desfeita por aqui.</p>
        <p v-if="status === 'pending_payment'" class="mt-2 text-sm text-[var(--color-ink-soft)]">Como o sinal ainda não foi pago, nenhuma cobrança será feita.</p>
        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" class="btn btn-outline flex-1" :disabled="busy" @click="back">Manter agendamento</button>
          <button type="button" class="btn flex-1 bg-red-600 text-white hover:bg-red-700" :disabled="busy || cooldown > 0" :aria-busy="busy" @click="cancel">
            {{ busy ? 'Cancelando...' : 'Sim, cancelar' }}
          </button>
        </div>
      </section>

      <!-- remarcar -->
      <section v-else class="mt-5">
        <div v-if="availState === 'loading' && !days.length" class="space-y-3" role="status" aria-live="polite">
          <div class="h-16 animate-pulse rounded-xl bg-slate-200" />
          <div class="h-32 animate-pulse rounded-xl bg-slate-200" />
          <span class="sr-only">Carregando horários...</span>
        </div>
        <div v-else-if="availState === 'error'" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {{ availError }}
          <button type="button" class="mt-3 block font-semibold underline" @click="loadAvailability(true)">Tentar de novo</button>
        </div>
        <div v-else-if="!days.length" class="rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm">
          Não há horários livres nos próximos dias.<template v-if="company.phone"> Fale com o estabelecimento: {{ company.phone }}.</template>
        </div>
        <template v-else>
          <div class="-mx-4 overflow-x-auto px-4" role="group" aria-label="Dias disponíveis">
            <ul class="flex gap-2 pb-2">
              <li v-for="d in days" :key="d.date">
                <button
                  type="button"
                  class="min-w-[4.25rem] rounded-xl border-[1.5px] px-1 py-2 text-center"
                  :class="selDate === d.date ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'"
                  :aria-pressed="selDate === d.date"
                  :aria-label="formatDateLong(d.date)"
                  @click="((selDate = d.date), (selTime = ''))"
                >
                  <span class="block text-xs uppercase">{{ weekdayShort(d.date) }}</span>
                  <span class="block text-lg font-bold">{{ dayOfMonth(d.date) }}</span>
                  <span class="block text-xs">{{ monthShort(d.date) }}</span>
                </button>
              </li>
            </ul>
          </div>
          <button v-if="windowsLoaded < 6" type="button" class="mt-1 text-sm font-semibold underline" :disabled="availState === 'loading'" @click="loadAvailability(false)">
            {{ availState === 'loading' ? 'Buscando...' : 'Ver mais datas' }}
          </button>

          <h2 class="mb-2 mt-5 text-base">Horários em {{ formatDateLong(selDate) }}</h2>
          <ul class="grid grid-cols-3 gap-2" role="group" aria-label="Horários disponíveis">
            <li v-for="s in daySlots" :key="s.start">
              <button
                type="button"
                class="w-full rounded-xl border-[1.5px] py-2.5 font-semibold"
                :class="selTime === s.start ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'"
                :aria-pressed="selTime === s.start"
                @click="selTime = s.start"
              >
                {{ s.start }}
              </button>
            </li>
          </ul>
        </template>

        <div class="mt-6 flex items-center gap-3">
          <button type="button" class="btn btn-outline" :disabled="busy" @click="back">Voltar</button>
          <button type="button" class="btn btn-primary flex-1" :disabled="busy || !selTime || cooldown > 0" :aria-busy="busy" @click="reschedule">
            {{ busy ? 'Remarcando...' : 'Confirmar novo horário' }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
