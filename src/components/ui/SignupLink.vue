<script setup>
// Link para o painel (/registro ou /entrar) com evento de analytics. Domínio vem de VITE_APP_URL.
import { appLink } from '../../config/env.js'
import { track } from '../../services/analytics.js'

const props = defineProps({
  to: { type: String, default: '/registro' },
  location: { type: String, default: 'page' },
  variant: { type: String, default: 'primary' },
  large: Boolean,
})

const onClick = () => {
  if (props.to === '/registro') track('sign_up_click', { location: props.location })
}
</script>

<template>
  <a
    :href="appLink(to)"
    rel="noopener"
    class="btn"
    :class="[variant === 'primary' ? 'btn-primary' : 'btn-outline', large && 'btn-lg']"
    @click="onClick"
  >
    <slot>Começar grátis</slot>
  </a>
</template>
