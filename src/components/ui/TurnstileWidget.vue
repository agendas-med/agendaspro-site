<script setup>
// Cloudflare Turnstile (explicit render, VITE_TURNSTILE_SITE_KEY). Modos (src/lib/turnstileMode.js):
//  - widget: há site key -> widget real; emite `token` ao resolver, `expired`/`error` nos demais casos.
//  - bypass: sem site key, só em dev/teste e com VITE_TURNSTILE_DEV_BYPASS=true (ou mock): token fixo + aviso visível.
//  - unavailable: sem site key fora de dev (sempre em produção): aviso visível, `error` emitido e NENHUM token.
// O formulário deve manter o envio desabilitado até receber `token` (reset() devolve o token de forma assíncrona).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { env } from '../../config/env.js'
import { turnstileMode, DEV_BYPASS_TOKEN } from '../../lib/turnstileMode.js'

const emit = defineEmits(['token', 'expired', 'error'])
const el = ref(null)
const failed = ref(false)
let widgetId = null
let token = ''

const mode = computed(() =>
  turnstileMode({ siteKey: env.turnstileSiteKey, dev: env.isDev, devBypass: env.turnstileDevBypass, useMocks: env.useMocks }),
)

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
  if (mode.value === 'bypass') {
    token = DEV_BYPASS_TOKEN
    emit('token', token)
    return
  }
  if (mode.value === 'unavailable') {
    failed.value = true
    emit('error')
    return
  }
  try {
    await loadScript()
    widgetId = window.turnstile.render(el.value, {
      sitekey: env.turnstileSiteKey,
      language: 'pt-br',
      callback: (t) => {
        token = t
        failed.value = false
        emit('token', t)
      },
      'expired-callback': () => {
        token = ''
        emit('expired')
      },
      'error-callback': () => {
        token = ''
        failed.value = true
        emit('error')
      },
    })
  } catch {
    failed.value = true
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

/** Tokens são de uso único: chame após cada envio (sucesso ou falha). O widget emite `token` de novo. */
function reset() {
  if (mode.value !== 'widget') return
  token = ''
  emit('expired')
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId)
}

defineExpose({ getToken, reset, mode })
</script>

<template>
  <div>
    <div v-if="mode === 'widget'" ref="el" class="min-h-[65px]" aria-label="Verificação de segurança" />
    <p v-if="mode === 'bypass'" class="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" role="note">
      Modo de desenvolvimento: verificação de segurança desativada (bypass explícito).
    </p>
    <p v-else-if="failed" class="field-error" role="alert">
      {{ mode === 'unavailable'
        ? 'A verificação de segurança não está configurada neste ambiente. O envio está bloqueado.'
        : 'Não foi possível carregar a verificação de segurança. Recarregue a página e tente de novo.' }}
    </p>
  </div>
</template>
