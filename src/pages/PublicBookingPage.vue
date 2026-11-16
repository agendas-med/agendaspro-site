<script setup>
// Página pública de agendamento (/b/:slug). SPA, mobile-first.
// Fluxo: serviço -> profissional -> data/hora -> dados do cliente -> confirmação (+ Pix quando houver sinal).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { publicApi, friendlyError, isAmbiguousFailure, ApiError } from '../services/publicApi.js'
import { track } from '../services/analytics.js'
import { env } from '../config/env.js'
import { maskPhoneBR, isValidWhatsappBR } from '../lib/phone.js'
import { maskCpf, isValidCpf } from '../lib/cpf.js'
import { parseSource } from '../lib/source.js'
import { createIdempotencyTracker } from '../lib/idempotency.js'
import { buildBookingPayload } from '../lib/bookingPayload.js'
import { formatBRL } from '../lib/commission.js'
import { todayInTz, addDays, weekdayShort, dayOfMonth, monthShort, formatDateLong, formatLocalDateTime } from '../lib/datetime.js'
import TurnstileWidget from '../components/ui/TurnstileWidget.vue'
import PixPanel from '../components/booking/PixPanel.vue'
import AppIcon from '../components/ui/AppIcon.vue'

const route = useRoute()
const slug = String(route.params.slug)
const source = parseSource(route.query) // link | instagram | qr | whatsapp | site

// ---------- dados da empresa ----------
const loadState = ref('loading') // loading | ready | notfound | error
const loadError = ref('')
const data = ref(null)
const company = computed(() => data.value?.company || null)
const tz = computed(() => company.value?.timezone || 'America/Sao_Paulo')

async function load() {
  loadState.value = 'loading'
  try {
    data.value = await publicApi.getBusiness(slug)
    loadState.value = 'ready'
  } catch (e) {
    loadError.value = friendlyError(e)
    loadState.value = e instanceof ApiError && e.status === 404 ? 'notfound' : 'error'
  }
}

// ---------- tema (cor do negócio) ----------
const theme = computed(() => {
  const c = company.value?.theme?.primary_color
  return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#16794a'
})
const themeFg = computed(() => {
  const n = Number.parseInt(theme.value.slice(1), 16)
  const lin = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.4 ? '#10243a' : '#ffffff'
})
const rootStyle = computed(() => ({ '--bk': theme.value, '--bk-fg': themeFg.value }))

// ---------- meta dinâmicas ----------
const pageTitle = computed(() => (company.value ? `Agende seu horário | ${company.value.name}` : 'Agendamento online'))
const pageDesc = computed(() =>
  company.value
    ? company.value.description || `Agende online com ${company.value.name}: escolha o serviço, o profissional e o melhor horário.`
    : 'Agendamento online.',
)
useHead({
  title: pageTitle,
  meta: [
    { name: 'description', content: pageDesc },
    // 404/erro de carregamento também chegam com status 200 pelo shell SPA: não indexar.
    { name: 'robots', content: computed(() => (loadState.value === 'ready' ? 'index, follow' : 'noindex, nofollow')) },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: pageDesc },
    { name: 'theme-color', content: theme },
  ],
})

// ---------- seleção ----------
const STEPS = ['Serviço', 'Profissional', 'Horário', 'Seus dados']
const step = ref(1) // 1..4, 5 = confirmação
const sel = reactive({ service: null, professionalId: null, date: '', slot: null })
const stepHeading = ref(null)

const professionals = computed(() =>
  sel.service ? (data.value?.professionals || []).filter((p) => p.service_ids.includes(sel.service.id)) : [],
)
const profName = (id) => (data.value?.professionals || []).find((p) => p.id === id)?.name || ''

async function go(n) {
  step.value = n
  await nextTick()
  stepHeading.value?.focus({ preventScroll: false })
  window.scrollTo({ top: 0 })
}

function chooseService(s) {
  sel.service = s
  sel.professionalId = null
  sel.slot = null
  sel.date = ''
  days.value = []
  const eligible = (data.value?.professionals || []).filter((p) => p.service_ids.includes(s.id))
  if (eligible.length === 1) {
    sel.professionalId = eligible[0].id
    go(3)
    loadAvailability(true)
  } else {
    go(2)
  }
}

function chooseProfessional(id) {
  sel.professionalId = id // null = qualquer
  sel.slot = null
  sel.date = ''
  days.value = []
  go(3)
  loadAvailability(true)
}

// ---------- disponibilidade ----------
const days = ref([]) // [{date, slots:[{start, professional_id}]}] apenas dias com horários
const availState = ref('idle') // idle | loading | error
const availError = ref('')
const windowsLoaded = ref(0)
let lastTo = ''

async function fetchWindow(reset) {
  const from = reset ? todayInTz(tz.value) : addDays(lastTo, 1)
  const to = addDays(from, 13)
  const r = await publicApi.getAvailability(slug, {
    serviceId: sel.service.id,
    professionalId: sel.professionalId || undefined,
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
    // sem horários na primeira janela: procura nas duas seguintes
    let guard = 0
    while (!days.value.length && windowsLoaded.value < 3 && guard++ < 2) await fetchWindow(false)
    availState.value = 'idle'
    if (!sel.date || !days.value.some((d) => d.date === sel.date)) sel.date = days.value[0]?.date || ''
  } catch (e) {
    availError.value = friendlyError(e)
    availState.value = 'error'
  }
}

const daySlots = computed(() => {
  const d = days.value.find((x) => x.date === sel.date)
  if (!d) return []
  const seen = new Map()
  for (const s of d.slots) if (!seen.has(s.start)) seen.set(s.start, s)
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start))
})

// Horários agrupados por período (o cabeçalho some quando só há um período).
const slotGroups = computed(() => {
  const defs = [
    { key: 'manha', label: 'Manhã', test: (h) => h < 12 },
    { key: 'tarde', label: 'Tarde', test: (h) => h >= 12 && h < 18 },
    { key: 'noite', label: 'Noite', test: (h) => h >= 18 },
  ]
  return defs
    .map((d) => ({ ...d, slots: daySlots.value.filter((s) => d.test(Number.parseInt(s.start, 10))) }))
    .filter((g) => g.slots.length)
})

function pickSlot(s) {
  sel.slot = { date: sel.date, time: s.start, professional_id: s.professional_id }
}

// ---------- dados do cliente ----------
const form = reactive({ name: '', phone: '', email: '', cpf: '', consent: false })
const errors = reactive({ name: '', phone: '', email: '', cpf: '', consent: '' })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const turnstile = ref(null)
const tsToken = ref('') // envio liberado só com token do Turnstile (ou bypass explícito de dev)
const needsDeposit = (s) => Boolean(s?.requires_payment && s.deposit_cents > 0)

function validateForm() {
  errors.name = form.name.trim().length >= 2 ? '' : 'Informe o seu nome.'
  errors.phone = isValidWhatsappBR(form.phone) ? '' : 'Informe um WhatsApp válido com DDD.'
  errors.email = !form.email || EMAIL_RE.test(form.email.trim()) ? '' : 'E-mail inválido. Corrija ou deixe em branco.'
  errors.cpf = !form.cpf || isValidCpf(form.cpf) ? '' : 'CPF inválido. Confira os números ou deixe em branco.'
  errors.consent = form.consent ? '' : 'Para agendar é preciso concordar com o tratamento dos dados.'
  return !errors.name && !errors.phone && !errors.email && !errors.cpf && !errors.consent
}

// ---------- envio ----------
// A chave é gerada por tentativa e reaproveitada no retry do MESMO payload (rede/5xx/429); muda se os dados mudam.
const idem = createIdempotencyTracker()
const submitting = ref(false)
const submitError = ref('')
const cooldown = ref(0)
let cooldownTimer

function startCooldown(s) {
  cooldown.value = Math.max(1, Math.min(Number(s) || 15, 120))
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const result = ref(null) // {booking, payment?, manage_token}
const pixExpired = ref(false)
const confirmedTracked = ref(false)

function trackConfirmed(paid) {
  if (confirmedTracked.value) return
  confirmedTracked.value = true
  track('booking_confirmed', { slug, source, paid })
}

async function submit() {
  if (submitting.value || cooldown.value > 0) return
  submitError.value = ''
  if (!validateForm()) {
    const first = ['name', 'phone', 'email', 'cpf', 'consent'].find((k) => errors[k])
    document.getElementById(`bk-${first}`)?.focus()
    return
  }
  const token = turnstile.value?.getToken() || ''
  if (!token) {
    submitError.value = 'Aguarde a verificação de segurança terminar e tente de novo.'
    return
  }
  submitting.value = true
  try {
    const payload = buildBookingPayload({
      serviceIds: [sel.service.id],
      professionalId: sel.professionalId,
      slot: sel.slot,
      form: needsDeposit(sel.service) ? form : { ...form, cpf: '' },
      source,
    })
    const res = await publicApi.createBooking(slug, {
      ...payload,
      idempotency_key: idem.keyFor(payload),
      turnstile_token: token,
    })
    idem.reset()
    result.value = res
    if (res.booking?.status === 'confirmed') trackConfirmed(false)
    await go(5)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'slot_taken') {
      // horário ocupado: nova chave, volta para a escolha de horário com a agenda atualizada
      idem.reset()
      sel.slot = null
      submitError.value = friendlyError(e)
      await go(3)
      await loadAvailability(true)
    } else if (e instanceof ApiError && e.status === 429) {
      submitError.value = friendlyError(e)
      startCooldown(e.retryAfter)
    } else {
      // rede/timeout/5xx: mantém a idempotency_key (o servidor pode ter gravado). Falha definitiva: chave nova.
      submitError.value = friendlyError(e)
      if (!isAmbiguousFailure(e)) idem.reset()
    }
  } finally {
    submitting.value = false
    turnstile.value?.reset()
  }
}

// Pix vencido: o horário foi liberado; recomeça da escolha de horário com slot e idempotency_key novos
// (reusar a chave devolveria a reserva expirada).
async function pickAnotherTime() {
  pixExpired.value = false
  confirmedTracked.value = false
  result.value = null
  sel.slot = null
  idem.reset()
  submitError.value = ''
  await go(3)
  await loadAvailability(true)
}

function onPixConfirmed(booking) {
  if (result.value) result.value = { ...result.value, booking: { ...result.value.booking, ...booking, status: 'confirmed' } }
  trackConfirmed(true)
}
function onPixCancelled() {
  if (result.value) result.value = { ...result.value, booking: { ...result.value.booking, status: 'cancelled' } }
}

// ---------- confirmação ----------
const isPending = computed(() => result.value?.booking?.status === 'pending_payment')
const isCancelled = computed(() => result.value?.booking?.status === 'cancelled')
// pending_payment sempre mostra o painel; sem `payment` (Pix ainda sendo gerado) ele busca pelo token.
const showPix = computed(() => isPending.value)
const outcome = computed(() => (isCancelled.value ? 'cancelled' : pixExpired.value ? 'expired' : isPending.value ? 'pending' : 'confirmed'))
const manageHref = computed(() => `/agendamento/${encodeURIComponent(result.value?.manage_token || '')}`)
const manageUrl = computed(() => (typeof window === 'undefined' ? manageHref.value : `${window.location.origin}${manageHref.value}`))
const linkCopied = ref(false)
async function copyManageLink() {
  try {
    await navigator.clipboard.writeText(manageUrl.value)
    linkCopied.value = true
    setTimeout(() => (linkCopied.value = false), 2500)
  } catch {
    /* o link também fica visível na tela para cópia manual */
  }
}

const slotLabel = computed(() => (sel.slot ? formatLocalDateTime(`${sel.slot.date}T${sel.slot.time}`) : ''))
const slotShort = computed(() => (sel.slot ? `${weekdayShort(sel.slot.date)}, ${dayOfMonth(sel.slot.date)} ${monthShort(sel.slot.date)} às ${sel.slot.time}` : ''))
const summaryProf = computed(() => profName(sel.slot?.professional_id ?? sel.professionalId))
// Barra fixa no mobile (etapas 3 e 4): resumo + ação. O botão do chat sobe junto (classe lida por .chat-dock).
const showBar = computed(() => loadState.value === 'ready' && (step.value === 3 || step.value === 4))
watch(
  showBar,
  (on) => {
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('has-sticky-bar', on)
  },
  { flush: 'post' },
)
const depositText = (s) => (needsDeposit(s) ? `Sinal de ${formatBRL(s.deposit_cents)} via Pix` : '')
const submitLabel = computed(() =>
  submitting.value ? 'Agendando...' : cooldown.value > 0 ? `Aguarde ${cooldown.value}s` : needsDeposit(sel.service) ? 'Agendar e pagar sinal' : 'Confirmar agendamento',
)

onMounted(load)
onBeforeUnmount(() => {
  clearInterval(cooldownTimer)
  if (typeof document !== 'undefined') document.documentElement.classList.remove('has-sticky-bar')
})
</script>

<template>
  <div class="bk min-h-screen bg-slate-50" :style="rootStyle">
    <!-- carregando: esqueleto com a mesma geometria da página pronta (evita salto de layout) -->
    <div v-if="loadState === 'loading'" role="status" aria-live="polite">
      <div class="bk-head"><div class="bk-wrap py-4"><div class="h-12" /></div></div>
      <div class="bk-wrap pt-5">
        <div class="mb-5 flex gap-1.5"><span v-for="n in 4" :key="n" class="h-1.5 flex-1 animate-pulse rounded-full bg-slate-200" /></div>
        <div class="mb-3 h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div class="space-y-3">
          <div v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
      <span class="sr-only">Carregando página de agendamento...</span>
    </div>

    <main v-else-if="loadState !== 'ready'" id="conteudo" class="mx-auto max-w-md px-6 py-16 text-center">
      <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-200 text-[var(--color-ink-soft)]"><AppIcon :name="loadState === 'notfound' ? 'pin' : 'alert'" :size="26" /></span>
      <h1 class="mt-4 text-2xl">{{ loadState === 'notfound' ? 'Página não encontrada' : 'Não foi possível carregar' }}</h1>
      <p class="mt-3 text-[var(--color-ink-soft)]">{{ loadError }}</p>
      <button v-if="loadState === 'error'" type="button" class="btn btn-primary mt-6" @click="load">Tentar de novo</button>
      <RouterLink v-else to="/" class="btn btn-outline mt-6">Conhecer o AgendasPro</RouterLink>
    </main>

    <template v-else>
      <header class="bk-head">
        <div class="bk-wrap flex items-center gap-3 py-4">
          <img v-if="company.logo_url" :src="company.logo_url" :alt="`Logo de ${company.name}`" width="48" height="48" class="h-12 w-12 shrink-0 rounded-full bg-white object-cover" />
          <div class="min-w-0">
            <p class="truncate text-lg font-bold">{{ company.name }}</p>
            <p v-if="company.hours" class="truncate text-sm opacity-90">{{ company.hours }}</p>
          </div>
        </div>
      </header>

      <main id="conteudo" class="bk-wrap pt-5 lg:pb-12" :class="showBar ? 'pb-32' : 'pb-10'">
        <p v-if="company.description" class="mb-4 max-w-2xl text-sm text-[var(--color-ink-soft)]">{{ company.description }}</p>

        <!-- progresso -->
        <ol v-if="step < 5" class="mb-6 flex gap-1.5" aria-label="Etapas do agendamento">
          <li v-for="(label, i) in STEPS" :key="label" class="flex-1" :aria-current="step === i + 1 ? 'step' : undefined">
            <span class="block h-1.5 rounded-full" :class="step >= i + 1 ? 'bk-bar-on' : 'bg-slate-300'" />
            <span class="mt-1.5 block text-center text-xs" :class="step === i + 1 ? 'font-semibold text-[var(--color-ink)]' : 'font-medium text-[var(--color-ink-soft)]'">
              <span class="sr-only">Etapa {{ i + 1 }} de {{ STEPS.length }}: </span>{{ label }}
            </span>
          </li>
        </ol>

        <p v-if="submitError && step !== 4" class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ submitError }}</p>

        <div :class="step < 5 ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start lg:gap-10' : 'mx-auto max-w-xl'">
          <div class="min-w-0">
            <!-- 1: serviço -->
            <section v-if="step === 1" aria-labelledby="bk-h1">
              <h1 id="bk-h1" ref="stepHeading" tabindex="-1" class="mb-1 text-xl outline-none">Escolha o serviço</h1>
              <p class="mb-4 text-sm text-[var(--color-ink-soft)]">Leva menos de 1 minuto. Você recebe a confirmação pelo WhatsApp.</p>
              <ul class="space-y-3">
                <li v-for="s in data.services" :key="s.id">
                  <button type="button" class="bk-option w-full text-left" @click="chooseService(s)">
                    <span class="flex items-start justify-between gap-3">
                      <span class="min-w-0 break-words font-semibold">{{ s.name }}</span>
                      <span class="shrink-0 font-semibold">{{ formatBRL(s.price_cents) }}</span>
                    </span>
                    <span v-if="s.description" class="mt-1 block break-words text-sm text-[var(--color-ink-soft)]">{{ s.description }}</span>
                    <span class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-ink-soft)]">
                      <span class="inline-flex items-center gap-1"><AppIcon name="clock" :size="14" /> {{ s.duration_min }} min</span>
                      <span v-if="depositText(s)" class="rounded-full bg-[var(--color-sand)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink)]">{{ depositText(s) }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </section>

            <!-- 2: profissional -->
            <section v-else-if="step === 2" aria-labelledby="bk-h2">
              <button type="button" class="bk-link-back" @click="go(1)"><AppIcon name="arrow" :size="16" class="rotate-180" /> Voltar</button>
              <h1 id="bk-h2" ref="stepHeading" tabindex="-1" class="mb-1 text-xl outline-none">Com quem você quer ser atendido?</h1>
              <p class="mb-4 text-sm text-[var(--color-ink-soft)]">{{ sel.service.name }}</p>
              <ul class="space-y-3">
                <li>
                  <button type="button" class="bk-option w-full text-left" @click="chooseProfessional(null)">
                    <span class="block font-semibold">Qualquer profissional</span>
                    <span class="block text-sm text-[var(--color-ink-soft)]">Mostra todos os horários livres</span>
                  </button>
                </li>
                <li v-for="p in professionals" :key="p.id">
                  <button type="button" class="bk-option flex w-full items-center gap-3 text-left" @click="chooseProfessional(p.id)">
                    <img v-if="p.photo_url" :src="p.photo_url" :alt="`Foto de ${p.name}`" width="40" height="40" class="h-10 w-10 shrink-0 rounded-full object-cover" />
                    <span v-else class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-[var(--color-ink-soft)]"><AppIcon name="user" :size="20" /></span>
                    <span class="min-w-0 break-words font-semibold">{{ p.name }}</span>
                  </button>
                </li>
              </ul>
            </section>

            <!-- 3: data e hora -->
            <section v-else-if="step === 3" aria-labelledby="bk-h3">
              <button type="button" class="bk-link-back" @click="go(professionals.length > 1 ? 2 : 1)"><AppIcon name="arrow" :size="16" class="rotate-180" /> Voltar</button>
              <h1 id="bk-h3" ref="stepHeading" tabindex="-1" class="mb-1 text-xl outline-none">Escolha o dia e o horário</h1>
              <p class="mb-4 text-sm text-[var(--color-ink-soft)]">
                {{ sel.service.name }}<template v-if="sel.professionalId"> · {{ profName(sel.professionalId) }}</template>
              </p>

              <p v-if="submitError" class="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ submitError }}</p>

              <div v-if="availState === 'loading' && !days.length" class="space-y-3" role="status" aria-live="polite">
                <div class="flex gap-2"><div v-for="n in 5" :key="n" class="h-[4.5rem] w-[4.25rem] shrink-0 animate-pulse rounded-xl bg-slate-200" /></div>
                <div class="h-6 w-56 animate-pulse rounded bg-slate-200" />
                <div class="grid grid-cols-3 gap-2 sm:grid-cols-4"><div v-for="n in 6" :key="n" class="h-11 animate-pulse rounded-xl bg-slate-200" /></div>
                <span class="sr-only">Carregando horários...</span>
              </div>

              <div v-else-if="availState === 'error'" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                {{ availError }}
                <button type="button" class="btn btn-outline mt-3 !min-h-11 !bg-white" @click="loadAvailability(true)">Tentar de novo</button>
              </div>

              <div v-else-if="!days.length" class="rounded-xl border border-[var(--color-line)] bg-white p-5 text-center">
                <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-[var(--color-ink-soft)]"><AppIcon name="calendar" :size="22" /></span>
                <p class="mt-3 font-semibold">Sem horários livres nos próximos dias</p>
                <p class="mt-1 text-sm text-[var(--color-ink-soft)]">
                  Tente outro profissional ou serviço<template v-if="company.phone">, ou fale com a gente pelo telefone <a :href="`tel:${company.phone.replace(/[^\d+]/g, '')}`" class="font-semibold underline">{{ company.phone }}</a></template>.
                </p>
                <button type="button" class="btn btn-outline mt-4" @click="go(professionals.length > 1 ? 2 : 1)">Escolher outra opção</button>
              </div>

              <template v-else>
                <div class="bk-strip -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Dias disponíveis">
                  <ul class="flex gap-2 pb-2">
                    <li v-for="d in days" :key="d.date" class="shrink-0">
                      <button
                        type="button"
                        class="bk-day"
                        :class="sel.date === d.date && 'bk-on'"
                        :aria-pressed="sel.date === d.date"
                        :aria-label="formatDateLong(d.date)"
                        @click="((sel.date = d.date), (sel.slot = null))"
                      >
                        <span class="block text-xs uppercase">{{ weekdayShort(d.date) }}</span>
                        <span class="block text-lg font-bold leading-tight">{{ dayOfMonth(d.date) }}</span>
                        <span class="block text-xs">{{ monthShort(d.date) }}</span>
                      </button>
                    </li>
                  </ul>
                </div>
                <button v-if="windowsLoaded < 6" type="button" class="bk-more" :disabled="availState === 'loading'" @click="loadAvailability(false)">
                  {{ availState === 'loading' ? 'Buscando...' : 'Ver mais datas' }}
                </button>

                <h2 class="mb-3 mt-4 text-base">Horários em {{ formatDateLong(sel.date) }}</h2>
                <div v-for="g in slotGroups" :key="g.key" class="mb-4">
                  <p v-if="slotGroups.length > 1" class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">{{ g.label }}</p>
                  <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" :aria-label="`Horários disponíveis (${g.label.toLowerCase()})`">
                    <li v-for="s in g.slots" :key="s.start">
                      <button type="button" class="bk-slot w-full" :class="sel.slot?.time === s.start && sel.slot?.date === sel.date && 'bk-on'" :aria-pressed="sel.slot?.time === s.start && sel.slot?.date === sel.date" @click="pickSlot(s)">
                        {{ s.start }}
                      </button>
                    </li>
                  </ul>
                </div>
              </template>

              <div class="mt-6 hidden lg:block">
                <button type="button" class="bk-primary lg:!w-auto lg:px-8" :disabled="!sel.slot" @click="go(4)">Continuar</button>
              </div>
            </section>

            <!-- 4: dados -->
            <section v-else-if="step === 4" aria-labelledby="bk-h4">
              <button type="button" class="bk-link-back" :disabled="submitting" @click="go(3)"><AppIcon name="arrow" :size="16" class="rotate-180" /> Voltar</button>
              <h1 id="bk-h4" ref="stepHeading" tabindex="-1" class="mb-3 text-xl outline-none">Seus dados</h1>

              <p v-if="depositText(sel.service)" class="mb-4 flex items-start gap-2 rounded-xl bg-[var(--color-sand)] px-3 py-2.5 text-sm">
                <AppIcon name="pix" :size="18" class="mt-0.5 shrink-0" />
                <span>{{ depositText(sel.service) }}: você recebe o Pix na próxima tela.</span>
              </p>

              <form id="bk-form" novalidate class="space-y-4" @submit.prevent="submit">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label for="bk-name" class="field-label">Nome</label>
                    <input id="bk-name" v-model="form.name" class="field" type="text" autocomplete="name" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'bk-name-err' : undefined" required />
                    <p v-if="errors.name" id="bk-name-err" class="field-error">{{ errors.name }}</p>
                  </div>
                  <div>
                    <label for="bk-phone" class="field-label">WhatsApp</label>
                    <input
                      id="bk-phone"
                      :value="form.phone"
                      class="field"
                      type="tel"
                      inputmode="tel"
                      autocomplete="tel-national"
                      placeholder="(11) 91234-5678"
                      :aria-invalid="Boolean(errors.phone)"
                      :aria-describedby="errors.phone ? 'bk-phone-err' : undefined"
                      required
                      @input="form.phone = maskPhoneBR($event.target.value)"
                    />
                    <p v-if="errors.phone" id="bk-phone-err" class="field-error">{{ errors.phone }}</p>
                  </div>
                </div>
                <div>
                  <label for="bk-email" class="field-label">E-mail <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
                  <input id="bk-email" v-model="form.email" class="field" type="email" autocomplete="email" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'bk-email-err' : undefined" />
                  <p v-if="errors.email" id="bk-email-err" class="field-error">{{ errors.email }}</p>
                </div>

                <div v-if="needsDeposit(sel.service)">
                  <label for="bk-cpf" class="field-label">CPF <span class="font-normal text-[var(--color-ink-soft)]">(opcional, usado só para gerar o Pix)</span></label>
                  <input
                    id="bk-cpf"
                    :value="form.cpf"
                    class="field"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="000.000.000-00"
                    :aria-invalid="Boolean(errors.cpf)"
                    :aria-describedby="errors.cpf ? 'bk-cpf-err' : undefined"
                    @input="form.cpf = maskCpf($event.target.value)"
                  />
                  <p v-if="errors.cpf" id="bk-cpf-err" class="field-error">{{ errors.cpf }}</p>
                </div>

                <div>
                  <label class="flex min-h-11 items-start gap-3 text-sm">
                    <input id="bk-consent" v-model="form.consent" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0" :style="{ accentColor: 'var(--bk)' }" :aria-invalid="Boolean(errors.consent)" :aria-describedby="errors.consent ? 'bk-consent-err' : undefined" />
                    <span>
                      Concordo com o tratamento dos meus dados para realizar este agendamento e receber confirmações e lembretes por WhatsApp, conforme a
                      <RouterLink to="/privacidade" target="_blank" class="underline">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></RouterLink>.
                    </span>
                  </label>
                  <p v-if="errors.consent" id="bk-consent-err" class="field-error">{{ errors.consent }}</p>
                </div>

                <TurnstileWidget
                  ref="turnstile"
                  @token="tsToken = $event"
                  @expired="tsToken = ''"
                  @error="tsToken = ''"
                />

                <p v-if="submitError" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                  {{ submitError }}<template v-if="cooldown > 0"> Tente de novo em {{ cooldown }}s.</template>
                </p>

                <div class="hidden lg:block">
                  <button type="submit" class="bk-primary lg:!w-auto lg:px-8" :disabled="submitting || cooldown > 0 || !tsToken" :aria-busy="submitting">
                    {{ submitLabel }}
                  </button>
                </div>
              </form>
            </section>

            <!-- 5: confirmação -->
            <section v-else aria-labelledby="bk-h5">
              <div class="text-center">
                <span class="mx-auto grid h-14 w-14 place-items-center rounded-full" :class="outcome === 'pending' ? 'bg-amber-100 text-amber-700' : outcome === 'confirmed' ? 'bk-ok' : 'bg-red-100 text-red-700'">
                  <AppIcon :name="outcome === 'pending' ? 'clock' : outcome === 'confirmed' ? 'check' : 'alert'" :size="28" />
                </span>
                <h1 id="bk-h5" ref="stepHeading" tabindex="-1" class="mt-3 text-2xl outline-none">
                  {{ outcome === 'expired' ? 'Prazo do Pix encerrado' : outcome === 'cancelled' ? 'Agendamento não concluído' : outcome === 'pending' ? 'Falta pagar o sinal' : 'Agendamento confirmado!' }}
                </h1>
                <p class="mt-1 text-[var(--color-ink-soft)]">
                  {{ outcome === 'expired' || outcome === 'cancelled' ? 'O horário foi liberado.' : outcome === 'pending' ? 'Seu horário fica reservado até o fim do prazo do Pix.' : 'Enviaremos a confirmação e os lembretes pelo WhatsApp.' }}
                </p>
              </div>

              <!-- Pix primeiro: é a ação pendente e precisa ficar acima da dobra no celular -->
              <div v-if="showPix" class="mt-5">
                <PixPanel
                  :payment="result.payment || {}"
                  :token="result.manage_token"
                  @confirmed="onPixConfirmed"
                  @expired="pixExpired = true"
                  @cancelled="onPixCancelled"
                  @retry="pickAnotherTime"
                />
              </div>

              <div class="mt-5 rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-card">
                <p class="font-semibold">{{ (result.booking.service_names || []).join(', ') || sel.service.name }}</p>
                <p class="mt-1 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]"><AppIcon name="calendar" :size="16" class="mt-0.5 shrink-0" /> {{ formatLocalDateTime(result.booking.start) }}</p>
                <p v-if="result.booking.professional_name" class="mt-1 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]"><AppIcon name="user" :size="16" class="mt-0.5 shrink-0" /> com {{ result.booking.professional_name }}</p>
                <p class="mt-1 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]"><AppIcon name="pin" :size="16" class="mt-0.5 shrink-0" /> <span class="min-w-0 break-words">{{ company.name }}<template v-if="company.address"> · {{ company.address }}</template></span></p>
              </div>

              <div v-if="outcome === 'pending' || outcome === 'confirmed'" class="mt-4 rounded-2xl border border-[var(--color-line)] bg-white p-4 text-sm">
                <p class="font-semibold">Precisa remarcar ou cancelar?</p>
                <p class="mt-1 text-[var(--color-ink-soft)]">Guarde o link do seu agendamento. Com ele você consulta, remarca ou cancela.</p>
                <p class="mt-2 break-all rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs">{{ manageUrl }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <RouterLink :to="manageHref" class="bk-primary !w-auto px-4">Ver meu agendamento</RouterLink>
                  <button type="button" class="bk-back" @click="copyManageLink">{{ linkCopied ? 'Link copiado' : 'Copiar link' }}</button>
                </div>
                <p class="sr-only" role="status" aria-live="polite">{{ linkCopied ? 'Link copiado' : '' }}</p>
              </div>
              <button v-else-if="outcome === 'cancelled'" type="button" class="bk-primary mt-5" @click="pickAnotherTime">Escolher outro horário</button>
            </section>
          </div>

          <!-- resumo (desktop): acompanha a escolha e permite voltar a cada etapa -->
          <aside v-if="step < 5" class="hidden lg:sticky lg:top-6 lg:block" aria-label="Resumo do agendamento">
            <div class="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-card">
              <h2 class="text-base">Seu agendamento</h2>
              <dl class="mt-3 space-y-3 text-sm">
                <div>
                  <dt class="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Serviço
                    <button v-if="step > 1 && sel.service" type="button" class="bk-edit" @click="go(1)">Alterar</button>
                  </dt>
                  <dd v-if="sel.service" class="mt-0.5">
                    <span class="font-semibold">{{ sel.service.name }}</span>
                    <span class="block text-[var(--color-ink-soft)]">{{ sel.service.duration_min }} min · {{ formatBRL(sel.service.price_cents) }}</span>
                  </dd>
                  <dd v-else class="mt-0.5 text-[var(--color-ink-soft)]">Escolha o serviço</dd>
                </div>
                <div v-if="sel.service && step > 2">
                  <dt class="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Profissional
                    <button v-if="professionals.length > 1" type="button" class="bk-edit" @click="go(2)">Alterar</button>
                  </dt>
                  <dd class="mt-0.5 font-semibold">{{ summaryProf || 'Qualquer profissional' }}</dd>
                </div>
                <div v-if="step >= 3">
                  <dt class="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Data e hora
                    <button v-if="step === 4" type="button" class="bk-edit" @click="go(3)">Alterar</button>
                  </dt>
                  <dd class="mt-0.5" :class="slotLabel ? 'font-semibold' : 'text-[var(--color-ink-soft)]'">{{ slotLabel || 'Escolha um horário' }}</dd>
                </div>
              </dl>
              <p v-if="sel.service && needsDeposit(sel.service)" class="mt-4 rounded-lg bg-[var(--color-sand)] px-3 py-2 text-xs">{{ depositText(sel.service) }} para garantir o horário.</p>
            </div>
          </aside>
        </div>

        <footer v-if="company.powered_by !== false" class="mt-10 text-center text-xs text-[var(--color-ink-soft)]">
          Feito com
          <a :href="`${env.siteUrl}/?utm_source=booking_page&utm_medium=powered_by&utm_campaign=${encodeURIComponent(company.slug)}`" target="_blank" rel="noopener" class="font-semibold underline">AgendasPro<span class="sr-only"> (abre em nova aba)</span></a>
        </footer>
      </main>

      <!-- barra fixa (mobile): resumo + ação da etapa. No desktop o resumo fica ao lado e a ação no fim do conteúdo. -->
      <div v-if="showBar" class="bk-bar lg:hidden">
        <div class="bk-bar-in">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ slotShort || 'Escolha um horário' }}</p>
            <p class="flex gap-1 text-xs text-[var(--color-ink-soft)]"><span class="min-w-0 truncate">{{ sel.service.name }}</span><span class="shrink-0">· {{ formatBRL(sel.service.price_cents) }}</span></p>
          </div>
          <button v-if="step === 3" type="button" class="bk-primary !w-auto shrink-0 px-6" :disabled="!sel.slot" @click="go(4)">Continuar</button>
          <button v-else type="submit" form="bk-form" class="bk-primary !w-auto shrink-0 px-5" :disabled="submitting || cooldown > 0 || !tsToken" :aria-busy="submitting">
            {{ submitting ? 'Agendando...' : cooldown > 0 ? `Aguarde ${cooldown}s` : needsDeposit(sel.service) ? 'Agendar e pagar' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bk-wrap {
  width: 100%;
  max-width: 36rem;
  margin-inline: auto;
  padding-inline: 1rem;
}
@media (min-width: 640px) {
  .bk-wrap {
    padding-inline: 1.5rem;
  }
}
@media (min-width: 1024px) {
  .bk-wrap {
    max-width: 58rem;
  }
}
.bk-head {
  background: var(--bk);
  color: var(--bk-fg);
}
.bk-bar-on {
  background: var(--bk);
}
.bk-ok {
  background: color-mix(in srgb, var(--bk) 15%, white);
  color: color-mix(in srgb, var(--bk) 80%, black);
}
.bk-option,
.bk-day,
.bk-slot {
  background: #fff;
  border: 1.5px solid #cbd5e1;
  border-radius: 0.85rem;
  padding: 0.85rem 1rem;
  min-height: 2.75rem;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    box-shadow 0.15s;
}
.bk-option {
  box-shadow: 0 1px 2px rgb(16 36 58 / 0.04);
}
.bk-option:hover,
.bk-day:hover,
.bk-slot:hover {
  border-color: var(--bk);
}
.bk-option:hover {
  box-shadow: var(--shadow-card);
}
.bk-day {
  min-width: 4.25rem;
  min-height: 4.5rem;
  padding: 0.5rem 0.4rem;
  text-align: center;
}
.bk-slot {
  padding: 0.6rem 0;
  min-height: 2.75rem;
  font-weight: 600;
  text-align: center;
}
.bk-on,
.bk-on:hover {
  background: var(--bk);
  color: var(--bk-fg);
  border-color: var(--bk);
}
.bk-strip {
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 1rem;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.bk-strip::-webkit-scrollbar {
  display: none;
}
.bk-strip li {
  scroll-snap-align: start;
}
@media (max-width: 639px) {
  /* esmaece a borda direita: indica que há mais dias ao rolar */
  .bk-strip {
    mask-image: linear-gradient(to right, #000 calc(100% - 1.75rem), transparent);
  }
}
.bk-more {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: underline;
}
.bk-more:disabled {
  opacity: 0.6;
}
.bk-link-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.75rem;
  margin: -0.25rem 0 0.25rem -0.25rem;
  padding: 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-ink-soft);
}
.bk-link-back:hover:not(:disabled) {
  color: var(--color-ink);
}
.bk-edit {
  min-height: 2rem;
  padding: 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  text-decoration: underline;
  color: var(--color-ink);
}
.bk-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  width: 100%;
  padding: 0.7rem 1.2rem;
  border-radius: 0.85rem;
  background: var(--bk);
  color: var(--bk-fg);
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}
.bk-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bk-back {
  min-height: 3rem;
  padding: 0.7rem 1.1rem;
  border-radius: 0.85rem;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  font-weight: 600;
}
.bk-bar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 30;
  background: #fff;
  border-top: 1px solid var(--color-line);
  box-shadow: 0 -8px 24px rgb(16 36 58 / 0.08);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.bk-bar-in {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 36rem;
  margin-inline: auto;
  padding: 0.75rem 1rem;
}
.bk :deep(.field:focus-visible) {
  border-color: var(--bk);
}
</style>
