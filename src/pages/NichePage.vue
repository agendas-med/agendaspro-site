<script setup>
// Landing por segmento gerada a partir de data/niches.js (rota /para/:nicho).
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSeo, faqLd } from '../composables/useSeo.js'
import { nicheBySlug } from '../data/niches.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'
import WhatsappLink from '../components/ui/WhatsappLink.vue'
import FaqAccordion from '../components/ui/FaqAccordion.vue'
import LeadForm from '../components/forms/LeadForm.vue'
import NotFoundPage from './NotFoundPage.vue'

const route = useRoute()
const niche = computed(() => nicheBySlug[String(route.params.nicho)])

if (niche.value) {
  const n = niche.value
  useSeo({
    title: `${n.title} | AgendasPro`,
    description: n.description,
    path: `/para/${n.slug}`,
    jsonLd: n.faq?.length ? [faqLd(n.faq)] : [],
  })
}
</script>

<template>
  <NotFoundPage v-if="!niche" />
  <div v-else>
    <section class="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="niche-h1">
      <div class="container-x py-14 md:py-20">
        <p class="eyebrow">{{ niche.short }}</p>
        <h1 id="niche-h1" class="mt-3 max-w-3xl text-4xl sm:text-5xl">{{ niche.headline }}</h1>
        <p class="mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">{{ niche.lead }}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <SignupLink :location="`niche_${niche.slug}`" large />
          <WhatsappLink :location="`niche_${niche.slug}`" large :message="`Olá! Tenho um negócio de ${niche.name.toLowerCase()} e quero conhecer o AgendasPro.`" />
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="niche-pains">
      <div class="container-x grid gap-6 md:grid-cols-2">
        <div class="card p-6">
          <h2 id="niche-pains" class="text-2xl">O que costuma atrapalhar</h2>
          <ul class="mt-4 space-y-3">
            <li v-for="p in niche.pains" :key="p" class="flex gap-2.5 text-[var(--color-ink-soft)]">
              <AppIcon name="alert" :size="20" class="mt-0.5 shrink-0 text-amber-600" />{{ p }}
            </li>
          </ul>
        </div>
        <div class="card p-6 ring-2 ring-brand-600">
          <h2 class="text-2xl">Como o AgendasPro resolve</h2>
          <ul class="mt-4 space-y-3">
            <li v-for="s in niche.solutions" :key="s" class="flex gap-2.5 text-[var(--color-ink-soft)]">
              <AppIcon name="check" :size="20" class="mt-0.5 shrink-0 text-brand-600" />{{ s }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section bg-slate-50 pt-12 md:pt-12" aria-labelledby="niche-services">
      <div class="container-x">
        <h2 id="niche-services" class="text-2xl">Serviços que você pode oferecer na sua página</h2>
        <ul class="mt-5 flex flex-wrap gap-2">
          <li v-for="s in niche.services" :key="s" class="rounded-full border border-[var(--color-line)] bg-white px-4 py-1.5 text-sm font-medium">{{ s }}</li>
        </ul>
        <p class="mt-6 text-sm text-[var(--color-ink-soft)]">
          Veja <RouterLink to="/recursos" class="underline">todos os recursos</RouterLink> e os <RouterLink to="/precos" class="underline">planos</RouterLink>.
        </p>
      </div>
    </section>

    <section v-if="niche.faq?.length" class="section" aria-labelledby="niche-faq">
      <div class="container-x max-w-3xl">
        <h2 id="niche-faq" class="text-3xl">Perguntas frequentes</h2>
        <div class="mt-8"><FaqAccordion :items="niche.faq" :id-prefix="`niche-${niche.slug}-faq`" /></div>
      </div>
    </section>

    <section class="section bg-brand-900 text-white" aria-labelledby="niche-cta">
      <div class="container-x grid items-start gap-10 md:grid-cols-2">
        <div>
          <h2 id="niche-cta" class="!text-white text-3xl">Quer ver o AgendasPro no seu negócio?</h2>
          <p class="mt-4 text-white/85">Crie a conta grátis ou deixe seu contato para falarmos pelo WhatsApp.</p>
        </div>
        <div class="text-[var(--color-ink)]"><LeadForm :id-prefix="`niche-${niche.slug}-lead`" :default-segment="niche.slug" :location="`niche_${niche.slug}`" /></div>
      </div>
    </section>
  </div>
</template>
