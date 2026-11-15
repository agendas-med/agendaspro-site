<script setup>
import { useSeo } from '../composables/useSeo.js'
import { integrations } from '../data/features.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'

useSeo({
  title: 'Integrações do AgendasPro: WhatsApp, Asaas (Pix), Google Agenda e Instagram',
  description:
    'O AgendasPro conversa com o WhatsApp e o Asaas (Pix) e, em breve, com o Google Agenda e o Instagram. Veja o que cada integração faz.',
  path: '/integracoes',
})

const iconFor = { whatsapp: 'whatsapp', asaas: 'pix', google: 'google', instagram: 'instagram' }
</script>

<template>
  <div>
    <section class="bg-gradient-to-b from-brand-50 to-white" aria-labelledby="int-h1">
      <div class="container-x py-14 md:py-20">
        <p class="eyebrow">Integrações</p>
        <h1 id="int-h1" class="mt-3 max-w-3xl text-4xl sm:text-5xl">Conectado às ferramentas que o seu negócio já usa</h1>
        <p class="mt-5 max-w-2xl text-lg text-[var(--color-ink-soft)]">Menos digitação e menos troca de aplicativo: o AgendasPro cuida do elo entre agenda, WhatsApp e pagamento.</p>
      </div>
    </section>

    <section class="section pt-6 md:pt-6" aria-label="Lista de integrações">
      <div class="container-x">
        <ul class="grid gap-5 md:grid-cols-2">
          <li v-for="i in integrations" :key="i.id" class="card p-6">
            <div class="flex items-start justify-between gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><AppIcon :name="iconFor[i.id]" /></span>
              <span v-if="i.status === 'soon'" class="badge-soon">Em breve</span>
            </div>
            <h2 class="mt-4 text-xl">{{ i.name }}</h2>
            <p class="mt-2 text-[var(--color-ink-soft)]">{{ i.summary }}</p>
            <ul class="mt-4 space-y-2 text-sm">
              <li v-for="p in i.points" :key="p" class="flex gap-2"><AppIcon name="check" :size="18" class="mt-0.5 shrink-0 text-brand-600" />{{ p }}</li>
            </ul>
            <p class="mt-4 text-xs text-[var(--color-ink-soft)]">{{ i.note }}</p>
          </li>
        </ul>
        <div class="mt-10"><SignupLink location="integrations" large /></div>
      </div>
    </section>
  </div>
</template>
