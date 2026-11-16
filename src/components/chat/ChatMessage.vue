<script setup>
// Uma mensagem do chat. Texto SEMPRE como nós Vue interpolados ({{ }}), sem v-html; links só pela allowlist.
import { computed } from 'vue'
import { parseChatText, safeHref } from '../../lib/chatText.js'
import { formatBps, formatPriceCents, formatSlot } from '../../lib/chatFormat.js'
import { hintCta } from '../../lib/chatActions.js'
import { appLink } from '../../config/env.js'
import ChatLink from './ChatLink.vue'

const props = defineProps({
  message: { type: Object, required: true },
  policy: { type: Object, required: true },
  ownHosts: { type: Array, default: () => [] },
  isLast: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  audience: { type: String, default: 'customer' },
  company: { type: Object, default: null },
  leadSent: { type: Boolean, default: false },
  retryBlocked: { type: Boolean, default: false },
})
const emit = defineEmits(['suggest', 'retry', 'discard', 'lead'])

const isUser = computed(() => props.message.role === 'user')
const blocks = computed(() => parseChatText(props.message.text, props.policy))
const streaming = computed(() => props.message.status === 'streaming')

const links = computed(() =>
  (props.message.actions || [])
    .filter((a) => a.type === 'link' || a.type === 'handoff')
    .map((a) => ({ ...a, href: safeHref(a.url, props.policy) }))
    .filter((a) => a.href),
)
const plans = computed(() => (props.message.actions || []).find((a) => a.type === 'plans')?.plans || [])
const slots = computed(() => {
  const a = (props.message.actions || []).find((x) => x.type === 'slots')
  if (!a) return null
  const href = safeHref(a.booking_url, props.policy)
  const list = a.slots.map((s) => ({ ...s, label: formatSlot(s) })).filter((s) => s.label)
  return href && list.length ? { href, list } : null
})
const wantsLead = computed(
  () => !props.leadSent && props.audience === 'business' && (props.message.actions || []).some((a) => a.type === 'lead_form'),
)
const cta = computed(() =>
  props.isLast && !isUser.value
    ? hintCta(props.message.hint, { audience: props.audience, company: props.company, leadSent: props.leadSent, appLink })
    : null,
)
const showSuggestions = computed(() => props.isLast && !props.busy && !isUser.value && (props.message.suggestions || []).length > 0)
</script>

<template>
  <li class="flex flex-col" :class="isUser ? 'items-end' : 'items-start'">
    <div
      class="max-w-[88%] break-words rounded-2xl px-3 py-2 text-sm leading-relaxed"
      :class="isUser ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-ink'"
    >
      <span class="sr-only">{{ isUser ? 'Você: ' : 'Assistente: ' }}</span>
      <template v-for="(b, i) in blocks" :key="i">
        <p v-if="b.type === 'p'" :class="i > 0 ? 'mt-2' : ''">
          <template v-for="(n, j) in b.inline" :key="j">
            <br v-if="n.t === 'br'" />
            <strong v-else-if="n.t === 'strong'">{{ n.v }}</strong>
            <ChatLink
              v-else-if="n.t === 'link'"
              :href="n.href"
              :own-hosts="ownHosts"
              :class="isUser ? 'underline' : 'font-medium text-brand-700 underline'"
              >{{ n.v }}</ChatLink
            >
            <template v-else>{{ n.v }}</template>
          </template>
        </p>
        <ul v-else class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="(item, k) in b.items" :key="k">
            <template v-for="(n, j) in item" :key="j">
              <strong v-if="n.t === 'strong'">{{ n.v }}</strong>
              <ChatLink v-else-if="n.t === 'link'" :href="n.href" :own-hosts="ownHosts" class="font-medium text-brand-700 underline">{{ n.v }}</ChatLink>
              <template v-else>{{ n.v }}</template>
            </template>
          </li>
        </ul>
      </template>
      <span v-if="streaming && !message.text" class="sr-only">Digitando</span>
    </div>

    <p v-if="message.degraded" class="mt-1 max-w-[88%] text-xs text-[var(--color-ink-soft)]">
      Estou com instabilidade e respondendo só o essencial. Para algo específico, fale com a equipe.
    </p>

    <ul v-if="plans.length" class="mt-2 grid w-full max-w-[88%] gap-2" aria-label="Planos">
      <li v-for="p in plans" :key="p.code || p.name" class="rounded-xl border border-line bg-white p-3 text-sm">
        <p class="font-semibold">{{ p.name }}</p>
        <p class="text-[var(--color-ink-soft)]">
          {{ p.price_cents ? `${formatPriceCents(p.price_cents)}/mês` : 'Sem mensalidade' }} · comissão de {{ formatBps(p.commission_bps) }} por agendamento pago
        </p>
      </li>
    </ul>

    <div v-if="slots" class="mt-2 w-full max-w-[88%] rounded-xl border border-line bg-white p-3 text-sm">
      <p class="font-semibold">Horários livres</p>
      <ul class="mt-1 flex flex-wrap gap-1.5">
        <li v-for="s in slots.list" :key="s.date + s.time" class="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{{ s.label }}</li>
      </ul>
      <ChatLink :href="slots.href" :own-hosts="ownHosts" class="btn btn-primary mt-2 w-full">Reservar na página de agendamento</ChatLink>
    </div>

    <div v-if="links.length || wantsLead || cta" class="mt-2 flex max-w-[88%] flex-wrap gap-2">
      <ChatLink v-for="l in links" :key="l.url" :href="l.href" :own-hosts="ownHosts" class="btn btn-outline text-sm">{{ l.label }}</ChatLink>
      <button v-if="wantsLead" type="button" class="btn btn-primary text-sm" @click="emit('lead')">Deixar meu contato</button>
      <template v-if="cta">
        <button v-if="cta.kind === 'lead'" type="button" class="btn btn-primary text-sm" @click="emit('lead')">{{ cta.label }}</button>
        <ChatLink v-else :href="cta.href" :own-hosts="ownHosts" class="btn btn-primary text-sm">{{ cta.label }}</ChatLink>
      </template>
    </div>

    <ul v-if="showSuggestions" class="mt-2 flex max-w-full flex-wrap gap-1.5" aria-label="Sugestões de resposta">
      <li v-for="s in message.suggestions" :key="s">
        <button
          type="button"
          class="inline-flex min-h-11 items-center rounded-full border border-brand-600 bg-white px-3.5 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-50 sm:min-h-9 sm:text-xs"
          @click="emit('suggest', s)"
        >
          {{ s }}
        </button>
      </li>
    </ul>

    <div v-if="message.status === 'failed'" class="mt-1 flex max-w-[88%] flex-col items-end gap-1 text-xs" role="alert">
      <p class="text-red-700">{{ message.error || 'Não foi possível enviar.' }}</p>
      <div class="flex gap-1">
        <button type="button" class="inline-flex min-h-11 items-center px-2 font-semibold text-brand-700 underline disabled:opacity-50" :disabled="retryBlocked" @click="emit('retry', message.id)">
          Tentar de novo
        </button>
        <button type="button" class="inline-flex min-h-11 items-center px-2 underline" @click="emit('discard', message.id)">Descartar</button>
      </div>
    </div>
    <p v-else-if="message.status === 'sending'" class="mt-0.5 text-[11px] text-[var(--color-ink-soft)]">Enviando…</p>
  </li>
</template>
