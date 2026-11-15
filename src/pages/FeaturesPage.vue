<script setup>
import { useSeo } from '../composables/useSeo.js'
import { features } from '../data/features.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'
import WhatsappLink from '../components/ui/WhatsappLink.vue'

useSeo({
  title: 'Recursos do AgendasPro: agenda, WhatsApp com IA, Pix e relatórios',
  description:
    'Conheça os recursos do AgendasPro: agenda por profissional, página pública com QR Code, lembretes e IA no WhatsApp, sinal por Pix e relatórios.',
  path: '/recursos',
})

const available = features.filter((f) => f.status === 'available')
const soon = features.filter((f) => f.status === 'soon')
</script>

<template>
  <div>
    <section class="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="features-h1">
      <div class="container-x py-14 md:py-20">
        <p class="eyebrow">Recursos</p>
        <h1 id="features-h1" class="mt-3 max-w-3xl text-4xl sm:text-5xl">Tudo o que o seu negócio precisa para agendar e reduzir faltas</h1>
        <p class="mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">Do primeiro contato do cliente até o horário confirmado e pago.</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <SignupLink location="features_hero" large />
          <WhatsappLink location="features_hero" large />
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="available-title">
      <div class="container-x">
        <h2 id="available-title" class="text-3xl">Disponíveis</h2>
        <ul class="mt-8 grid gap-5 md:grid-cols-2">
          <li v-for="f in available" :key="f.id" class="card p-6">
            <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><AppIcon :name="f.icon" /></span>
            <h3 class="mt-4 text-xl">{{ f.title }}</h3>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ f.long }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="section bg-slate-50" aria-labelledby="soon-title">
      <div class="container-x">
        <h2 id="soon-title" class="text-3xl">Em breve no Premium</h2>
        <p class="mt-2 max-w-2xl text-[var(--color-ink-soft)]">Estes recursos estão em desenvolvimento. As datas de liberação serão comunicadas aos clientes.</p>
        <ul class="mt-8 grid gap-5 md:grid-cols-2">
          <li v-for="f in soon" :key="f.id" class="card p-6">
            <div class="flex items-start justify-between gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-[var(--color-ink-soft)]"><AppIcon :name="f.icon" /></span>
              <span class="badge-soon">Em breve</span>
            </div>
            <h3 class="mt-4 text-xl">{{ f.title }}</h3>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ f.long }}</p>
          </li>
        </ul>
        <p class="mt-8"><RouterLink to="/precos" class="font-semibold text-brand-700 underline">Ver planos e preços</RouterLink></p>
      </div>
    </section>
  </div>
</template>
