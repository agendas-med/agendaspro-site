<script setup>
// "Falar no WhatsApp": wa.me com mensagem pré-preenchida e origem (utm / rota).
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { whatsappLink, whatsappIsConfigured } from '../../config/company.js'
import { env } from '../../config/env.js'
import { track } from '../../services/analytics.js'
import { useAttribution } from '../../composables/useAttribution.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  message: { type: String, default: 'Olá! Quero conhecer o AgendasPro para o meu negócio.' },
  location: { type: String, default: 'page' },
  large: Boolean,
})
const route = useRoute()
const attribution = useAttribution()
// Sem número real configurado, o botão some do build de produção (evita wa.me inválido).
const visible = whatsappIsConfigured() || env.isDev || env.useMocks
const href = computed(() => whatsappLink(props.message, attribution.value || `site${route.path}`))
</script>

<template>
  <a
    v-if="visible"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="btn btn-whatsapp"
    :class="large && 'btn-lg'"
    @click="track('whatsapp_click', { location })"
  >
    <AppIcon name="whatsapp" :size="20" />
    <slot>Falar no WhatsApp</slot>
    <span class="sr-only"> (abre em nova aba)</span>
  </a>
</template>
