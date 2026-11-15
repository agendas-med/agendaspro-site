<script setup>
import { useSeo } from '../composables/useSeo.js'
import AppIcon from '../components/ui/AppIcon.vue'

useSeo({
  title: 'Página não encontrada | AgendasPro',
  description: 'A página que você procura não existe ou foi movida.',
  noindex: true,
})
</script>

<template>
  <section class="section" aria-labelledby="nf-title">
    <div class="container-x max-w-xl text-center">
      <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><AppIcon name="alert" :size="28" /></span>
      <p class="mt-4 text-sm font-semibold text-[var(--color-ink-soft)]">Erro 404</p>
      <h1 id="nf-title" class="mt-2 text-3xl sm:text-4xl">Página não encontrada</h1>
      <p class="mt-4 text-[var(--color-ink-soft)]">O endereço pode ter sido digitado errado ou a página foi movida. Se você recebeu um link de agendamento, peça um novo ao estabelecimento.</p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <RouterLink to="/" class="btn btn-primary btn-lg">Ir para o início</RouterLink>
        <RouterLink to="/contato" class="btn btn-outline btn-lg">Falar com a equipe</RouterLink>
      </div>
    </div>
  </section>
</template>
