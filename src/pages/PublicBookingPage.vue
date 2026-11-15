<script setup>
// Página pública de agendamento (/b/:slug). SPA, mobile-first.
// Fluxo: serviço -> profissional -> data/hora -> dados do cliente -> confirmação (+ Pix quando houver sinal).
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { publicApi, friendlyError, newIdempotencyKey, ApiError } from '../services/publicApi.js'
import { track } from '../services/analytics.js'
import { env } from '../config/env.js'
import { maskPhoneBR, isValidWhatsappBR, toE164BR } from '../lib/phone.js'
import { formatBRL } from '../lib/commission.js'
import { todayInTz, addDays, weekdayShort, dayOfMonth, monthShort, formatDateLong, formatLocalDateTime } from '../lib/datetime.js'
import TurnstileWidget from '../components/ui/TurnstileWidget.vue'
import PixPanel from '../components/booking/PixPanel.vue'
import AppIcon from '../components/ui/AppIcon.vue'

const route = useRoute()
const slug = String(route.params.slug)
const SOURCES = ['instagram', 'qr', 'link', 'whatsapp', 'site']
const source = SOURCES.includes(String(route.query.src || '').toLowerCase()) ? String(route.query.src).toLowerCase() : 'link'

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
    { name: 'robots', content: 'index, follow' },
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
  idemKey.value = newIdempotencyKey()
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
  idemKey.value = newIdempotencyKey()
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

function pickSlot(s) {
  sel.slot = { date: sel.date, time: s.start, professional_id: s.professional_id }
  idemKey.value = newIdempotencyKey()
}

// ---------- dados do cliente ----------
const form = reactive({ name: '', phone: '', email: '', consent: false })
const errors = reactive({ name: '', phone: '', email: '', consent: '' })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const turnstile = ref(null)

function validateForm() {
  errors.name = form.name.trim().length >= 2 ? '' : 'Informe o seu nome.'
  errors.phone = isValidWhatsappBR(form.phone) ? '' : 'Informe um WhatsApp válido com DDD.'
  errors.email = !form.email || EMAIL_RE.test(form.email.trim()) ? '' : 'E-mail inválido. Corrija ou deixe em branco.'
  errors.consent = form.consent ? '' : 'Para agendar é preciso concordar com o tratamento dos dados.'
  return !errors.name && !errors.phone && !errors.email && !errors.consent
}

// ---------- envio ----------
const idemKey = ref(newIdempotencyKey())
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
    const first = ['name', 'phone', 'email', 'consent'].find((k) => errors[k])
    document.getElementById(`bk-${first}`)?.focus()
    return
  }
  submitting.value = true
  try {
    const res = await publicApi.createBooking(slug, {
      service_ids: [sel.service.id],
      professional_id: sel.slot.professional_id ?? sel.professionalId ?? null,
      start: `${sel.slot.date}T${sel.slot.time}`,
      customer: {
        name: form.name.trim(),
        phone: toE164BR(form.phone),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      },
      consent: true,
      source,
      idempotency_key: idemKey.value,
      turnstile_token: turnstile.value?.getToken() || '',
    })
    result.value = res
    if (res.booking?.status === 'confirmed') trackConfirmed(false)
    await go(5)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'slot_taken') {
      // horário ocupado: nova chave, volta para a escolha de horário com a agenda atualizada
      idemKey.value = newIdempotencyKey()
      sel.slot = null
      submitError.value = friendlyError(e)
      await go(3)
      await loadAvailability(true)
    } else if (e instanceof ApiError && e.status === 429) {
      submitError.value = friendlyError(e)
      startCooldown(e.retryAfter)
    } else {
      // falha de rede/5xx: mantém a mesma idempotency_key para não duplicar se o servidor chegou a gravar
      submitError.value = friendlyError(e)
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) idemKey.value = newIdempotencyKey()
    }
  } finally {
    submitting.value = false
    turnstile.value?.reset()
  }
}

function onPixConfirmed(booking) {
  if (result.value) result.value = { ...result.value, booking: { ...result.value.booking, ...booking, status: 'confirmed' } }
  trackConfirmed(true)
}

// ---------- confirmação ----------
const isPending = computed(() => result.value?.booking?.status === 'pending_payment')
const showPix = computed(() => isPending.value && result.value?.payment && !pixExpired.value)
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
const summaryProf = computed(() => profName(sel.slot?.professional_id ?? sel.professionalId))
const depositText = (s) => (s.requires_payment && s.deposit_cents > 0 ? `Sinal de ${formatBRL(s.deposit_cents)} via Pix` : '')

onMounted(load)
onBeforeUnmount(() => clearInterval(cooldownTimer))
</script>

<template>
  <div class="bk min-h-screen bg-slate-50" :style="rootStyle">
    <!-- carregando / erro -->
    <div v-if="loadState === 'loading'" class="mx-auto max-w-xl p-6" role="status" aria-live="polite">
      <div class="h-24 animate-pulse rounded-2xl bg-slate-200" />
      <div class="mt-4 h-40 animate-pulse rounded-2xl bg-slate-200" />
      <span class="sr-only">Carregando página de agendamento...</span>
    </div>

    <main v-else-if="loadState !== 'ready'" id="conteudo" class="mx-auto max-w-xl p-6 text-center">
      <h1 class="text-2xl">{{ loadState === 'notfound' ? 'Página não encontrada' : 'Não foi possível carregar' }}</h1>
      <p class="mt-3 text-[var(--color-ink-soft)]">{{ loadError }}</p>
      <button v-if="loadState === 'error'" type="button" class="btn btn-primary mt-6" @click="load">Tentar de novo</button>
    </main>

    <template v-else>
      <header class="bk-head">
        <div class="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          <img v-if="company.logo_url" :src="company.logo_url" :alt="`Logo de ${company.name}`" width="48" height="48" class="h-12 w-12 rounded-full bg-white object-cover" />
          <div class="min-w-0">
            <p class="truncate text-lg font-bold">{{ company.name }}</p>
            <p v-if="company.hours" class="truncate text-sm opacity-90">{{ company.hours }}</p>
          </div>
        </div>
      </header>

      <main id="conteudo" class="mx-auto max-w-xl px-4 pb-10 pt-5">
        <p v-if="company.description" class="mb-4 text-sm text-[var(--color-ink-soft)]">{{ company.description }}</p>

        <!-- progresso -->
        <ol v-if="step < 5" class="mb-5 flex gap-1.5" aria-label="Etapas do agendamento">
          <li
            v-for="(label, i) in STEPS"
            :key="label"
            class="flex-1"
            :aria-current="step === i + 1 ? 'step' : undefined"
          >
            <span class="block h-1.5 rounded-full" :class="step >= i + 1 ? 'bk-bar-on' : 'bg-slate-300'" />
            <span class="mt-1 block text-center text-[11px] font-medium" :class="step === i + 1 ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'">{{ label }}</span>
          </li>
        </ol>

        <p v-if="submitError && step !== 4" class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ submitError }}</p>

        <!-- 1: serviço -->
        <section v-if="step === 1" aria-labelledby="bk-h1">
          <h1 id="bk-h1" ref="stepHeading" tabindex="-1" class="mb-3 text-xl outline-none">Escolha o serviço</h1>
          <ul class="space-y-3">
            <li v-for="s in data.services" :key="s.id">
              <button type="button" class="bk-option w-full text-left" @click="chooseService(s)">
                <span class="flex items-start justify-between gap-3">
                  <span class="font-semibold">{{ s.name }}</span>
                  <span class="shrink-0 font-semibold">{{ formatBRL(s.price_cents) }}</span>
                </span>
                <span v-if="s.description" class="mt-1 block text-sm text-[var(--color-ink-soft)]">{{ s.description }}</span>
                <span class="mt-1 block text-sm text-[var(--color-ink-soft)]">
                  {{ s.duration_min }} min<template v-if="depositText(s)"> · {{ depositText(s) }}</template>
                </span>
              </button>
            </li>
          </ul>
        </section>

        <!-- 2: profissional -->
        <section v-else-if="step === 2" aria-labelledby="bk-h2">
          <h1 id="bk-h2" ref="stepHeading" tabindex="-1" class="mb-1 text-xl outline-none">Com quem você quer ser atendido?</h1>
          <p class="mb-3 text-sm text-[var(--color-ink-soft)]">{{ sel.service.name }}</p>
          <ul class="space-y-3">
            <li>
              <button type="button" class="bk-option w-full text-left" @click="chooseProfessional(null)">
                <span class="font-semibold">Qualquer profissional</span>
                <span class="block text-sm text-[var(--color-ink-soft)]">Mostra todos os horários livres</span>
              </button>
            </li>
            <li v-for="p in professionals" :key="p.id">
              <button type="button" class="bk-option flex w-full items-center gap-3 text-left" @click="chooseProfessional(p.id)">
                <img v-if="p.photo_url" :src="p.photo_url" :alt="`Foto de ${p.name}`" width="40" height="40" class="h-10 w-10 rounded-full object-cover" />
                <span v-else class="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-[var(--color-ink-soft)]"><AppIcon name="user" :size="20" /></span>
                <span class="font-semibold">{{ p.name }}</span>
              </button>
            </li>
          </ul>
          <button type="button" class="bk-back" @click="go(1)">Voltar</button>
        </section>

        <!-- 3: data e hora -->
        <section v-else-if="step === 3" aria-labelledby="bk-h3">
          <h1 id="bk-h3" ref="stepHeading" tabindex="-1" class="mb-1 text-xl outline-none">Escolha o dia e o horário</h1>
          <p class="mb-3 text-sm text-[var(--color-ink-soft)]">
            {{ sel.service.name }}<template v-if="sel.professionalId"> · {{ profName(sel.professionalId) }}</template>
          </p>

          <p v-if="submitError" class="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ submitError }}</p>

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
            Não há horários livres nos próximos dias para esta escolha.
            <template v-if="company.phone"> Entre em contato pelo telefone {{ company.phone }}.</template>
          </div>

          <template v-else>
            <div class="-mx-4 overflow-x-auto px-4" role="group" aria-label="Dias disponíveis">
              <ul class="flex gap-2 pb-2">
                <li v-for="d in days" :key="d.date">
                  <button
                    type="button"
                    class="bk-day"
                    :class="sel.date === d.date && 'bk-on'"
                    :aria-pressed="sel.date === d.date"
                    :aria-label="formatDateLong(d.date)"
                    @click="((sel.date = d.date), (sel.slot = null))"
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

            <h2 class="mb-2 mt-5 text-base">Horários em {{ formatDateLong(sel.date) }}</h2>
            <ul class="grid grid-cols-3 gap-2" role="group" aria-label="Horários disponíveis">
              <li v-for="s in daySlots" :key="s.start">
                <button type="button" class="bk-slot w-full" :class="sel.slot?.time === s.start && sel.slot?.date === sel.date && 'bk-on'" :aria-pressed="sel.slot?.time === s.start && sel.slot?.date === sel.date" @click="pickSlot(s)">
                  {{ s.start }}
                </button>
              </li>
            </ul>
          </template>

          <div class="mt-6 flex items-center gap-3">
            <button type="button" class="bk-back mt-0" @click="go(professionals.length > 1 ? 2 : 1)">Voltar</button>
            <button type="button" class="bk-primary flex-1" :disabled="!sel.slot" @click="go(4)">Continuar</button>
          </div>
        </section>

        <!-- 4: dados -->
        <section v-else-if="step === 4" aria-labelledby="bk-h4">
          <h1 id="bk-h4" ref="stepHeading" tabindex="-1" class="mb-3 text-xl outline-none">Seus dados</h1>

          <div class="mb-4 rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm">
            <p class="font-semibold">{{ sel.service.name }}</p>
            <p class="text-[var(--color-ink-soft)]">{{ slotLabel }}</p>
            <p v-if="summaryProf" class="text-[var(--color-ink-soft)]">com {{ summaryProf }}</p>
            <p class="mt-1 font-semibold">{{ formatBRL(sel.service.price_cents) }}</p>
            <p v-if="depositText(sel.service)" class="mt-1 rounded-lg bg-[var(--color-sand)] px-2 py-1 text-xs">{{ depositText(sel.service) }}: você recebe o Pix na próxima tela.</p>
          </div>

          <form novalidate class="space-y-4" @submit.prevent="submit">
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
            <div>
              <label for="bk-email" class="field-label">E-mail <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
              <input id="bk-email" v-model="form.email" class="field" type="email" autocomplete="email" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'bk-email-err' : undefined" />
              <p v-if="errors.email" id="bk-email-err" class="field-error">{{ errors.email }}</p>
            </div>
            <div>
              <label class="flex items-start gap-3 text-sm">
                <input id="bk-consent" v-model="form.consent" type="checkbox" class="mt-1 h-5 w-5 shrink-0" :aria-invalid="Boolean(errors.consent)" :aria-describedby="errors.consent ? 'bk-consent-err' : undefined" />
                <span>
                  Concordo com o tratamento dos meus dados para realizar este agendamento e receber confirmações e lembretes por WhatsApp, conforme a
                  <RouterLink to="/privacidade" target="_blank" class="underline">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></RouterLink>.
                </span>
              </label>
              <p v-if="errors.consent" id="bk-consent-err" class="field-error">{{ errors.consent }}</p>
            </div>

            <TurnstileWidget ref="turnstile" />

            <p v-if="submitError" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {{ submitError }}<template v-if="cooldown > 0"> Tente de novo em {{ cooldown }}s.</template>
            </p>

            <div class="flex items-center gap-3">
              <button type="button" class="bk-back mt-0" :disabled="submitting" @click="go(3)">Voltar</button>
              <button type="submit" class="bk-primary flex-1" :disabled="submitting || cooldown > 0" :aria-busy="submitting">
                {{ submitting ? 'Agendando...' : cooldown > 0 ? `Aguarde ${cooldown}s` : sel.service.requires_payment && sel.service.deposit_cents > 0 ? 'Agendar e pagar sinal' : 'Confirmar agendamento' }}
              </button>
            </div>
          </form>
        </section>

        <!-- 5: confirmação -->
        <section v-else aria-labelledby="bk-h5">
          <div class="text-center">
            <span class="mx-auto grid h-14 w-14 place-items-center rounded-full" :class="isPending && !pixExpired ? 'bg-amber-100 text-amber-700' : 'bk-ok'">
              <AppIcon :name="isPending && !pixExpired ? 'clock' : pixExpired ? 'alert' : 'check'" :size="28" />
            </span>
            <h1 id="bk-h5" ref="stepHeading" tabindex="-1" class="mt-3 text-2xl outline-none">
              {{ pixExpired ? 'Prazo do Pix encerrado' : isPending ? 'Falta pagar o sinal' : 'Agendamento confirmado!' }}
            </h1>
            <p class="mt-1 text-[var(--color-ink-soft)]">
              {{ pixExpired ? 'O horário foi liberado.' : isPending ? 'Seu horário fica reservado até o fim do prazo do Pix.' : 'Enviaremos a confirmação e os lembretes pelo WhatsApp.' }}
            </p>
          </div>

          <div class="mt-5 rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm">
            <p class="font-semibold">{{ (result.booking.service_names || []).join(', ') || sel.service.name }}</p>
            <p class="text-[var(--color-ink-soft)]">{{ formatLocalDateTime(result.booking.start) }}</p>
            <p v-if="result.booking.professional_name" class="text-[var(--color-ink-soft)]">com {{ result.booking.professional_name }}</p>
            <p class="mt-1 text-[var(--color-ink-soft)]">{{ company.name }}<template v-if="company.address"> · {{ company.address }}</template></p>
          </div>

          <div v-if="showPix" class="mt-5">
            <PixPanel :payment="result.payment" :token="result.manage_token" :amount-cents="sel.service.deposit_cents" @confirmed="onPixConfirmed" @expired="pixExpired = true" />
          </div>

          <div v-if="!pixExpired" class="mt-5 rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm">
            <p class="font-semibold">Precisa remarcar ou cancelar?</p>
            <p class="mt-1 text-[var(--color-ink-soft)]">Guarde o link do seu agendamento. Com ele você consulta, remarca ou cancela.</p>
            <p class="mt-2 break-all rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs">{{ manageUrl }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <RouterLink :to="manageHref" class="bk-primary !w-auto px-4">Ver meu agendamento</RouterLink>
              <button type="button" class="bk-back mt-0" @click="copyManageLink">{{ linkCopied ? 'Link copiado' : 'Copiar link' }}</button>
            </div>
            <p class="sr-only" role="status" aria-live="polite">{{ linkCopied ? 'Link copiado' : '' }}</p>
          </div>
          <button v-else type="button" class="bk-primary mt-5" @click="((pixExpired = false), (result = null), go(3), loadAvailability(true))">Escolher outro horário</button>
        </section>

        <footer v-if="company.powered_by" class="mt-10 text-center text-xs text-[var(--color-ink-soft)]">
          Feito com
          <a :href="`${env.siteUrl}/?utm_source=booking_page&utm_medium=powered_by&utm_campaign=${encodeURIComponent(company.slug)}`" target="_blank" rel="noopener" class="font-semibold underline">AgendasPro<span class="sr-only"> (abre em nova aba)</span></a>
        </footer>
      </main>
    </template>
  </div>
</template>

<style scoped>
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
  transition: border-color 0.15s, background-color 0.15s;
}
.bk-option:hover,
.bk-day:hover,
.bk-slot:hover {
  border-color: var(--bk);
}
.bk-day {
  min-width: 4.25rem;
  padding: 0.5rem 0.4rem;
  text-align: center;
}
.bk-slot {
  padding: 0.6rem 0;
  font-weight: 600;
  text-align: center;
}
.bk-on {
  background: var(--bk);
  color: var(--bk-fg);
  border-color: var(--bk);
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
}
.bk-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bk-back {
  margin-top: 1rem;
  min-height: 3rem;
  padding: 0.7rem 1.1rem;
  border-radius: 0.85rem;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  font-weight: 600;
}
.bk :deep(.field:focus-visible) {
  border-color: var(--bk);
}
</style>
