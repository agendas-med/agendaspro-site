<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  consent,
  consentBannerOpen,
  acceptAll,
  rejectNonEssential,
  saveConsent,
  analyticsConfigured,
} from '../../services/analytics.js'

const customizing = ref(false)
const analytics = ref(false)
const marketing = ref(false)
const hasTrackers = computed(() => analyticsConfigured())

function startCustomize() {
  analytics.value = consent.value.analytics
  marketing.value = consent.value.marketing
  customizing.value = true
}
function saveCustom() {
  saveConsent({ analytics: analytics.value, marketing: marketing.value })
  customizing.value = false
}
function close() {
  rejectNonEssential()
  customizing.value = false
}
</script>

<template>
  <section
    v-if="consentBannerOpen"
    role="region"
    aria-labelledby="cookie-title"
    class="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white p-4 shadow-pop sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-2xl sm:border"
  >
    <h2 id="cookie-title" class="text-base font-semibold">Cookies e privacidade</h2>

    <template v-if="!hasTrackers">
      <p class="mt-2 text-sm text-ink-soft">
        Este site usa apenas armazenamento essencial para funcionar. Nenhum rastreador de terceiros é carregado.
        <RouterLink to="/cookies" class="text-brand-700 underline">Política de cookies</RouterLink>.
      </p>
      <button type="button" class="btn btn-primary mt-3 w-full" @click="close">Entendi</button>
    </template>

    <template v-else-if="!customizing">
      <p class="mt-2 text-sm text-ink-soft">
        Usamos cookies essenciais e, com a sua autorização, de medição e marketing para entender o uso do site e melhorar a experiência.
        <RouterLink to="/cookies" class="text-brand-700 underline">Saiba mais</RouterLink>.
      </p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-primary" @click="acceptAll">Aceitar todos</button>
        <button type="button" class="btn btn-outline" @click="rejectNonEssential">Recusar</button>
      </div>
      <button type="button" class="mt-2 w-full py-2 text-sm font-medium text-ink-soft underline" @click="startCustomize">
        Personalizar
      </button>
    </template>

    <form v-else class="mt-3 space-y-3" @submit.prevent="saveCustom">
      <label class="flex items-start gap-3 text-sm">
        <input type="checkbox" checked disabled class="mt-1 h-4 w-4" />
        <span><strong>Essenciais</strong> — necessários ao funcionamento. Sempre ativos.</span>
      </label>
      <label class="flex items-start gap-3 text-sm">
        <input v-model="analytics" type="checkbox" class="mt-1 h-4 w-4" />
        <span><strong>Medição</strong> — estatísticas de uso (Google Analytics, Microsoft Clarity).</span>
      </label>
      <label class="flex items-start gap-3 text-sm">
        <input v-model="marketing" type="checkbox" class="mt-1 h-4 w-4" />
        <span><strong>Marketing</strong> — mede campanhas (Meta Pixel).</span>
      </label>
      <button type="submit" class="btn btn-primary w-full">Salvar preferências</button>
    </form>
  </section>
</template>
