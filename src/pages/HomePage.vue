<script setup>
import { RouterLink } from 'vue-router'
import { useSeo, organizationLd, softwareLd, faqLd } from '../composables/useSeo.js'
import { env } from '../config/env.js'
import { featureById } from '../data/features.js'
import { niches } from '../data/niches.js'
import { homeFaq } from '../data/faq.js'
import { plans } from '../data/plans.js'
import { socialProof } from '../data/socialProof.js'
import { formatBRL } from '../lib/commission.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'
import WhatsappLink from '../components/ui/WhatsappLink.vue'
import FaqAccordion from '../components/ui/FaqAccordion.vue'
import LeadForm from '../components/forms/LeadForm.vue'
import BookingPageMock from '../components/mocks/BookingPageMock.vue'
import WhatsappMock from '../components/mocks/WhatsappMock.vue'
import AgendaMock from '../components/mocks/AgendaMock.vue'
import PixMock from '../components/mocks/PixMock.vue'
import ReportsMock from '../components/mocks/ReportsMock.vue'

useSeo({
  title: 'AgendasPro: agendamento online com WhatsApp e sinal por Pix para negócios de serviços',
  description:
    'Reduza faltas e atenda 24h: página de agendamento, lembretes e IA no WhatsApp e cobrança de sinal por Pix para clínicas, barbearias, estética e mais. Comece grátis.',
  path: '/',
  jsonLd: [organizationLd(), softwareLd(env.premiumPriceCents), faqLd(homeFaq)],
})

const pains = [
  {
    pain: 'Cliente que marca e não aparece',
    solution: 'Lembrete no WhatsApp e sinal por Pix: horário confirmado vale mais do que horário combinado.',
    icon: 'clock',
  },
  {
    pain: 'Recepção presa no WhatsApp o dia todo',
    solution: 'Uma assistente com IA responde e agenda 24h e passa para a sua equipe quando necessário.',
    icon: 'chat',
  },
  {
    pain: 'Agenda em caderno, planilha e mensagens soltas',
    solution: 'Uma agenda por profissional, sempre atualizada, e uma página para o cliente marcar sozinho.',
    icon: 'calendar',
  },
]

const showcase = [
  { id: 'public-page', mock: BookingPageMock },
  { id: 'ai-whatsapp', mock: WhatsappMock, props: { variant: 'ai' } },
  { id: 'pix-deposit', mock: PixMock },
  { id: 'agenda', mock: AgendaMock },
  { id: 'whatsapp-reminders', mock: WhatsappMock, props: { variant: 'reminder' } },
  { id: 'reports', mock: ReportsMock },
]

const steps = [
  { n: 1, title: 'Crie a conta e cadastre serviços e profissionais', text: 'Defina horários de atendimento, duração e, se quiser, o valor do sinal de cada serviço.' },
  { n: 2, title: 'Divulgue o seu link ou QR Code', text: 'Coloque na bio do Instagram, no WhatsApp e no balcão. O cliente agenda sozinho, a qualquer hora.' },
  { n: 3, title: 'Atenda: o resto é automático', text: 'Confirmação, lembretes e cobrança do sinal acontecem sem você precisar mandar mensagem.' },
]

const premiumPrice = formatBRL(plans.premium.priceCents)
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="hero-title">
      <div class="container-x grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
        <div>
          <p class="eyebrow">Para clínicas, barbearias, estética e outros negócios de serviços</p>
          <h1 id="hero-title" class="mt-3 text-4xl sm:text-5xl">Agenda cheia, menos faltas e recepção 24 horas no WhatsApp</h1>
          <p class="mt-5 text-lg text-[var(--color-ink-soft)]">
            O AgendasPro é o sistema de agendamento online que confirma os clientes, cobra o sinal por Pix e atende pelo WhatsApp mesmo quando você está fechado.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <SignupLink location="hero" large />
            <WhatsappLink location="hero" large />
          </div>
          <p class="mt-4 text-sm text-[var(--color-ink-soft)]">Plano Free sem mensalidade. Premium a partir de {{ premiumPrice }}/mês.</p>
          <ul class="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
            <li class="flex items-center gap-1.5"><AppIcon name="check" :size="18" class="text-brand-600" />Reduz o no-show</li>
            <li class="flex items-center gap-1.5"><AppIcon name="check" :size="18" class="text-brand-600" />Recepção 24h</li>
            <li class="flex items-center gap-1.5"><AppIcon name="check" :size="18" class="text-brand-600" />Sinal antecipado por Pix</li>
          </ul>
        </div>
        <div class="grid grid-cols-2 items-start gap-4" aria-hidden="true">
          <BookingPageMock />
          <div class="mt-10"><WhatsappMock variant="reminder" /></div>
        </div>
      </div>
    </section>

    <!-- Dores -> solução -->
    <section class="section" aria-labelledby="pains-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">O problema</p>
          <h2 id="pains-title" class="mt-2 text-3xl sm:text-4xl">Cada horário vazio é dinheiro que não volta</h2>
        </div>
        <ul class="mt-10 grid gap-5 md:grid-cols-3">
          <li v-for="p in pains" :key="p.pain" class="card p-6">
            <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><AppIcon :name="p.icon" /></span>
            <h3 class="mt-4 text-lg">{{ p.pain }}</h3>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ p.solution }}</p>
          </li>
        </ul>
      </div>
    </section>

    <!-- Recursos -->
    <section class="section bg-slate-50" aria-labelledby="features-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">O que você ganha</p>
          <h2 id="features-title" class="mt-2 text-3xl sm:text-4xl">Tudo para agendar, confirmar e receber</h2>
        </div>
        <div class="mt-12 space-y-14">
          <article v-for="(s, i) in showcase" :key="s.id" class="grid items-center gap-8 md:grid-cols-2">
            <div :class="i % 2 === 1 && 'md:order-2'">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><AppIcon :name="featureById[s.id].icon" /></span>
              <h3 class="mt-4 text-2xl">{{ featureById[s.id].title }}</h3>
              <p class="mt-3 text-[var(--color-ink-soft)]">{{ featureById[s.id].long }}</p>
            </div>
            <component :is="s.mock" v-bind="s.props" aria-hidden="true" />
          </article>
        </div>
        <p class="mt-12">
          <RouterLink to="/recursos" class="font-semibold text-brand-700 underline">Ver todos os recursos, inclusive os que estão em breve</RouterLink>
        </p>
      </div>
    </section>

    <!-- Como funciona -->
    <section class="section" aria-labelledby="how-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">Como funciona</p>
          <h2 id="how-title" class="mt-2 text-3xl sm:text-4xl">Em 3 passos o seu negócio já recebe agendamentos</h2>
        </div>
        <ol class="mt-10 grid gap-5 md:grid-cols-3">
          <li v-for="s in steps" :key="s.n" class="card p-6">
            <span class="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-bold text-white" aria-hidden="true">{{ s.n }}</span>
            <h3 class="mt-4 text-lg"><span class="sr-only">Passo {{ s.n }}: </span>{{ s.title }}</h3>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ s.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Segmentos -->
    <section class="section bg-slate-50" aria-labelledby="segments-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">Para quem é</p>
          <h2 id="segments-title" class="mt-2 text-3xl sm:text-4xl">Feito para negócios que vivem de horário marcado</h2>
        </div>
        <ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li v-for="n in niches" :key="n.slug">
            <RouterLink :to="`/para/${n.slug}`" class="card flex h-full items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-pop)]">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><AppIcon :name="n.icon" /></span>
              <span class="font-semibold">{{ n.short }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- Prova social (exemplos ilustrativos) -->
    <section class="section" aria-labelledby="proof-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">Depoimentos</p>
          <h2 id="proof-title" class="mt-2 text-3xl sm:text-4xl">O que dizem os clientes</h2>
        </div>
        <ul class="mt-10 grid gap-5 md:grid-cols-3">
          <li v-for="(p, i) in socialProof" :key="i" class="card p-6">
            <span v-if="p.isPlaceholder" class="badge-soon">Exemplo ilustrativo</span>
            <blockquote class="mt-3 text-[var(--color-ink-soft)]">{{ p.quote }}</blockquote>
            <p class="mt-4 text-sm font-semibold">{{ p.author }}</p>
            <p class="text-sm text-[var(--color-ink-soft)]">{{ p.role }}</p>
          </li>
        </ul>
      </div>
    </section>

    <!-- Preços -->
    <section class="section bg-slate-50" aria-labelledby="pricing-title">
      <div class="container-x">
        <div class="max-w-2xl">
          <p class="eyebrow">Preços</p>
          <h2 id="pricing-title" class="mt-2 text-3xl sm:text-4xl">Comece grátis e evolua quando fizer sentido</h2>
        </div>
        <div class="mt-10 grid gap-5 md:grid-cols-2">
          <div class="card p-6">
            <h3 class="text-xl">{{ plans.free.name }}</h3>
            <p class="mt-1 text-3xl font-bold">R$ 0<span class="text-base font-medium text-[var(--color-ink-soft)]">/mês</span></p>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ plans.free.tagline }}</p>
            <ul class="mt-4 space-y-2 text-sm">
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />1 profissional e 2 usuários</li>
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />Página pública, lembretes no WhatsApp e sinal por Pix</li>
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />Comissão de {{ plans.free.commissionLabel }} sobre vendas online</li>
            </ul>
          </div>
          <div class="card border-brand-600 p-6 ring-2 ring-brand-600">
            <h3 class="text-xl">{{ plans.premium.name }}</h3>
            <p class="mt-1 text-3xl font-bold">{{ premiumPrice }}<span class="text-base font-medium text-[var(--color-ink-soft)]">/mês</span></p>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ plans.premium.tagline }}</p>
            <ul class="mt-4 space-y-2 text-sm">
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />Profissionais e usuários ilimitados</li>
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />Página sem marca, com a cor do seu negócio</li>
              <li class="flex gap-2"><AppIcon name="check" :size="18" class="shrink-0 text-brand-600" />Comissão de {{ plans.premium.commissionLabel }} sobre vendas online</li>
            </ul>
          </div>
        </div>
        <p class="mt-8"><RouterLink to="/precos" class="font-semibold text-brand-700 underline">Comparar planos e calcular quando o Premium compensa</RouterLink></p>
      </div>
    </section>

    <!-- FAQ -->
    <section class="section" aria-labelledby="faq-title">
      <div class="container-x max-w-3xl">
        <h2 id="faq-title" class="text-3xl sm:text-4xl">Perguntas frequentes</h2>
        <div class="mt-8"><FaqAccordion :items="homeFaq" id-prefix="home-faq" /></div>
      </div>
    </section>

    <!-- CTA final + lead -->
    <section id="contato-comercial" class="section bg-brand-900 text-white" aria-labelledby="cta-title">
      <div class="container-x grid items-start gap-10 md:grid-cols-2">
        <div>
          <h2 id="cta-title" class="!text-white text-3xl sm:text-4xl">Pronto para ter a agenda cheia e o WhatsApp sob controle?</h2>
          <p class="mt-4 text-white/85">Crie a conta grátis agora ou deixe seu contato e nossa equipe fala com você.</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <SignupLink location="cta_final" large />
            <WhatsappLink location="cta_final" large />
          </div>
        </div>
        <div class="text-[var(--color-ink)]"><LeadForm id-prefix="home-lead" location="home" /></div>
      </div>
    </section>
  </div>
</template>
