<script setup>
import { computed, ref } from 'vue'
import { useSeo, softwareLd, faqLd } from '../composables/useSeo.js'
import { env } from '../config/env.js'
import { plans, planMatrix } from '../data/plans.js'
import { pricingFaq } from '../data/faq.js'
import { calcCommission, parseBRLToCents, formatBRL } from '../lib/commission.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'
import WhatsappLink from '../components/ui/WhatsappLink.vue'
import FaqAccordion from '../components/ui/FaqAccordion.vue'

useSeo({
  title: 'Preços do AgendasPro: plano Free e Premium, com calculadora de comissão',
  description:
    'Compare o plano Free (comissão de 5%) e o Premium (mensalidade e comissão de 0,5%) e use a calculadora para ver a partir de quanto o Premium compensa.',
  path: '/precos',
  jsonLd: [softwareLd(env.premiumPriceCents), faqLd(pricingFaq)],
})

const salesInput = ref('3000')
const cents = computed(() => parseBRLToCents(salesInput.value))
const calc = computed(() =>
  calcCommission({
    monthlySalesCents: cents.value,
    freeBps: plans.free.commissionBps,
    premiumBps: plans.premium.commissionBps,
    premiumPriceCents: plans.premium.priceCents,
  }),
)
const verdict = computed(() => {
  if (!cents.value) return 'Informe o quanto você espera receber por mês em vendas online.'
  if (calc.value.best === 'premium') return `Com esse volume, o Premium custa ${formatBRL(calc.value.savingsCents)} a menos por mês.`
  if (calc.value.best === 'free') return `Com esse volume, o Free custa ${formatBRL(-calc.value.savingsCents)} a menos por mês.`
  return 'Com esse volume, os dois planos custam o mesmo.'
})
const premiumPrice = formatBRL(plans.premium.priceCents)
</script>

<template>
  <div>
    <section class="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="pricing-h1">
      <div class="container-x py-14 text-center md:py-20">
        <p class="eyebrow">Preços</p>
        <h1 id="pricing-h1" class="mx-auto mt-3 max-w-3xl text-4xl sm:text-5xl">Comece grátis. Assine o Premium quando compensar.</h1>
        <p class="mx-auto mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">
          Sem fidelidade. No Free você paga {{ plans.free.commissionLabel }} sobre o que receber online; no Premium, {{ premiumPrice }} por mês mais {{ plans.premium.commissionLabel }}.
        </p>
        <div class="mt-7 flex flex-wrap justify-center gap-3">
          <SignupLink location="pricing_hero" large />
          <WhatsappLink location="pricing_hero" large message="Olá! Tenho dúvidas sobre os planos do AgendasPro." />
        </div>
      </div>
    </section>

    <!-- Planos -->
    <section class="section pt-6 md:pt-6" aria-labelledby="matrix-title">
      <div class="container-x">
        <h2 id="matrix-title" class="text-3xl">Free x Premium</h2>
        <p class="mt-2 text-[var(--color-ink-soft)]">
          Itens com o selo <span class="badge-soon">Em breve</span> ainda não foram liberados e chegam ao plano indicado quando ficarem prontos.
        </p>
        <div class="relative mt-6 overflow-x-auto rounded-2xl border border-[var(--color-line)]">
          <table class="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption class="sr-only">Comparação entre os planos Free e Premium</caption>
            <thead class="bg-slate-50">
              <tr>
                <th scope="col" class="p-4 font-semibold">Recurso</th>
                <th scope="col" class="p-4 font-semibold">{{ plans.free.name }}</th>
                <th scope="col" class="p-4 font-semibold text-brand-700">{{ plans.premium.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in planMatrix" :key="row.label" class="border-t border-[var(--color-line)] align-top">
                <th scope="row" class="p-4 font-medium">
                  {{ row.label }} <span v-if="row.soon" class="badge-soon ml-1">Em breve</span>
                </th>
                <td v-for="col in ['free', 'premium']" :key="col" class="p-4 text-[var(--color-ink-soft)]">
                  <template v-if="row[col] === true">
                    <AppIcon name="check" :size="20" class="text-brand-600" /><span class="sr-only">Incluído</span>
                  </template>
                  <template v-else-if="row[col] === false">
                    <AppIcon name="x" :size="20" class="text-slate-400" /><span class="sr-only">Não incluído</span>
                  </template>
                  <template v-else>{{ row[col] }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-4 text-sm text-[var(--color-ink-soft)]">
          Os pagamentos online são processados pelo Asaas, que pode cobrar tarifas próprias, conforme a tabela vigente dele.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <SignupLink location="pricing_matrix" large>Começar no Free</SignupLink>
        </div>
      </div>
    </section>

    <!-- Calculadora -->
    <section class="section bg-slate-50" aria-labelledby="calc-title">
      <div class="container-x grid gap-8 md:grid-cols-2">
        <div>
          <p class="eyebrow">Calculadora</p>
          <h2 id="calc-title" class="mt-2 text-3xl">A partir de quanto o Premium compensa?</h2>
          <p class="mt-3 text-[var(--color-ink-soft)]">
            Compare a comissão do Free ({{ plans.free.commissionLabel }}) com a mensalidade do Premium ({{ premiumPrice }}) mais a comissão de {{ plans.premium.commissionLabel }}.
            O cálculo considera apenas valores recebidos online pela plataforma.
          </p>
          <p class="mt-3 text-[var(--color-ink-soft)]">
            Ponto de equilíbrio: cerca de <strong class="text-[var(--color-ink)]">{{ formatBRL(calc.breakEvenCents) }}</strong> por mês.
          </p>
        </div>
        <div class="card p-6">
          <label for="calc-sales" class="field-label">Vendas online por mês (R$)</label>
          <input
            id="calc-sales"
            v-model="salesInput"
            class="field"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            aria-describedby="calc-result"
          />
          <dl class="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-[var(--color-ink-soft)]">Custo no Free</dt>
              <dd class="mt-1 text-xl font-bold">{{ formatBRL(calc.freeCostCents) }}</dd>
            </div>
            <div class="rounded-xl bg-brand-50 p-4">
              <dt class="text-[var(--color-ink-soft)]">Custo no Premium</dt>
              <dd class="mt-1 text-xl font-bold">{{ formatBRL(calc.premiumCostCents) }}</dd>
            </div>
          </dl>
          <p id="calc-result" class="mt-4 font-semibold" role="status" aria-live="polite">{{ verdict }}</p>
          <p class="mt-2 text-xs text-[var(--color-ink-soft)]">Simulação ilustrativa, sem incluir tarifas do meio de pagamento.</p>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="billing-faq-title">
      <div class="container-x max-w-3xl">
        <h2 id="billing-faq-title" class="text-3xl">Dúvidas sobre cobrança</h2>
        <div class="mt-8"><FaqAccordion :items="pricingFaq" id-prefix="pricing-faq" /></div>
        <div class="mt-10 flex flex-wrap gap-3">
          <SignupLink location="pricing_faq" large />
          <RouterLink to="/contato" class="btn btn-outline btn-lg">Falar com a equipe</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
