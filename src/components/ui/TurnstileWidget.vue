<script setup>
// Cloudflare Turnstile (explicit render). Sem VITE_TURNSTILE_SITE_KEY o widget não aparece:
// em dev/mock devolve um token de bypass; em produção devolve vazio (o core decide).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { env, turnstileBypassToken } from '../../config/env.js'

const emit = defineEmits(['token', 'expired', 'error'])
const el = ref(null)
let widgetId = null
let token = ''

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise

function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = resolve
      s.onerror = () => {
        scriptPromise = undefined
        reject(new Error('turnstile_script'))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

onMounted(async () => {
  if (!env.turnstileSiteKey) {
    token = turnstileBypassToken()
    emit('token', token)
    return
  }
  try {
    await loadScript()
    widgetId = window.turnstile.render(el.value, {
      sitekey: env.turnstileSiteKey,
      language: 'pt-br',
      callback: (t) => {
        token = t
        emit('token', t)
      },
      'expired-callback': () => {
        token = ''
        emit('expired')
      },
      'error-callback': () => {
        token = ''
        emit('error')
      },
    })
  } catch {
    emit('error')
  }
})

onBeforeUnmount(() => {
  if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
})

/** Token atual ('' se ainda não resolvido). */
function getToken() {
  return token
}

/** Tokens são de uso único: chame após cada envio (sucesso ou falha). */
function reset() {
  if (!env.turnstileSiteKey) return
  token = ''
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId)
}

defineExpose({ getToken, reset })
</script>

<template>
  <div v-if="env.turnstileSiteKey" ref="el" class="min-h-[65px]" aria-label="Verificação de segurança" />
</template>
