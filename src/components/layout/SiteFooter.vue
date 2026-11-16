<script setup>
import { RouterLink } from 'vue-router'
import { company } from '../../config/company.js'
import { niches } from '../../data/niches.js'
import { openConsentBanner } from '../../services/analytics.js'
import BrandLogo from '../ui/BrandLogo.vue'
import WhatsappLink from '../ui/WhatsappLink.vue'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="bg-brand-900 text-white/80">
    <div class="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
      <div class="lg:col-span-2">
        <BrandLogo light />
        <p class="mt-4 max-w-sm text-sm leading-relaxed">
          Agendamento online para negócios de serviços: página pública, lembretes e IA no WhatsApp e cobrança de sinal por Pix.
        </p>
        <div class="mt-5">
          <WhatsappLink location="footer" />
        </div>
      </div>

      <nav aria-labelledby="f-produto">
        <h2 id="f-produto" class="mb-3 text-sm font-semibold text-white">Produto</h2>
        <ul class="text-sm md:space-y-2">
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/recursos">Recursos</RouterLink></li>
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/integracoes">Integrações</RouterLink></li>
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/precos">Preços</RouterLink></li>
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/contato">Contato</RouterLink></li>
        </ul>
      </nav>

      <nav aria-labelledby="f-nichos">
        <h2 id="f-nichos" class="mb-3 text-sm font-semibold text-white">Para quem</h2>
        <ul class="text-sm md:space-y-2">
          <li v-for="n in niches" :key="n.slug">
            <RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" :to="`/para/${n.slug}`">{{ n.name }}</RouterLink>
          </li>
        </ul>
      </nav>

      <nav aria-labelledby="f-legal">
        <h2 id="f-legal" class="mb-3 text-sm font-semibold text-white">Legal</h2>
        <ul class="text-sm md:space-y-2">
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/termos">Termos de uso</RouterLink></li>
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/privacidade">Política de privacidade</RouterLink></li>
          <li><RouterLink class="inline-flex min-h-11 items-center hover:text-white md:min-h-0" to="/cookies">Política de cookies</RouterLink></li>
          <li>
            <button type="button" class="inline-flex min-h-11 items-center text-left hover:text-white md:min-h-0" @click="openConsentBanner">
              Preferências de cookies
            </button>
          </li>
        </ul>
      </nav>
    </div>
    <div class="border-t border-white/10">
      <div class="container-x flex flex-col gap-1 py-6 text-xs leading-relaxed text-white/70 md:flex-row md:justify-between">
        <p>© {{ year }} {{ company.legalName }} · CNPJ {{ company.cnpj }}</p>
        <p>{{ company.address }}</p>
      </div>
    </div>
  </footer>
</template>
