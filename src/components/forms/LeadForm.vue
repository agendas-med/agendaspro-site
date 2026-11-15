<script setup>
// Formulário de lead -> POST /public/leads. Honeypot, máscara/validação de WhatsApp, Turnstile,
// estados de carregando/erro/sucesso. Evento generate_lead no sucesso.
import { computed, reactive, ref } from 'vue'
import { niches } from '../../data/niches.js'
import { maskPhoneBR, isValidWhatsappBR } from '../../lib/phone.js'
import { publicApi, friendlyError } from '../../services/publicApi.js'
import { buildLeadPayload } from '../../lib/bookingPayload.js'
import { track } from '../../services/analytics.js'
import { useAttribution } from '../../composables/useAttribution.js'
import TurnstileWidget from '../ui/TurnstileWidget.vue'

const props = defineProps({
  idPrefix: { type: String, default: 'lead' },
  defaultSegment: { type: String, default: '' },
  location: { type: String, default: 'home' },
})

const attribution = useAttribution()
const form = reactive({ name: '', whatsapp: '', email: '', segment: props.defaultSegment, message: '', website: '', consent: false })
const errors = reactive({ name: '', whatsapp: '', email: '', segment: '', consent: '' })
const status = ref('idle') // idle | loading | success | error
const errorMsg = ref('')
const turnstile = ref(null)
const turnstileFailed = ref(false)
const tsToken = ref('') // o envio só é liberado com um token válido (reset() devolve outro de forma assíncrona)

const segments = [...niches.map((n) => ({ value: n.slug, label: n.name })), { value: 'outro', label: 'Outro segmento' }]
const id = (n) => `${props.idPrefix}-${n}`
const loading = computed(() => status.value === 'loading')

const onPhone = (e) => {
  form.whatsapp = maskPhoneBR(e.target.value)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate() {
  errors.name = form.name.trim().length >= 2 ? '' : 'Informe o seu nome.'
  errors.whatsapp = isValidWhatsappBR(form.whatsapp) ? '' : 'Informe um WhatsApp válido com DDD, ex.: (11) 91234-5678.'
  errors.email = !form.email || EMAIL_RE.test(form.email.trim()) ? '' : 'Informe um e-mail válido ou deixe em branco.'
  errors.segment = form.segment ? '' : 'Escolha o segmento do seu negócio.'
  errors.consent = form.consent ? '' : 'Para receber o contato é preciso concordar com o uso dos dados.'
  return !errors.name && !errors.whatsapp && !errors.email && !errors.segment && !errors.consent
}

async function submit() {
  if (loading.value) return
  errorMsg.value = ''
  if (!validate()) {
    status.value = 'idle'
    const first = ['name', 'whatsapp', 'email', 'segment', 'consent'].find((k) => errors[k])
    document.getElementById(id(first))?.focus()
    return
  }
  // Honeypot preenchido = robô: finge sucesso sem enviar nada.
  if (form.website) {
    status.value = 'success'
    return
  }
  if (!tsToken.value) {
    errorMsg.value = turnstileFailed.value
      ? 'A verificação de segurança não está disponível. Recarregue a página e tente de novo.'
      : 'Aguarde a verificação de segurança terminar e envie de novo.'
    status.value = 'error'
    return
  }
  status.value = 'loading'
  try {
    await publicApi.createLead(
      buildLeadPayload({ form, attribution: attribution.value, token: turnstile.value?.getToken() || '' }),
    )
    track('generate_lead', { location: props.location, segment: form.segment })
    status.value = 'success'
  } catch (e) {
    errorMsg.value = friendlyError(e)
    status.value = 'error'
  } finally {
    turnstile.value?.reset() // token de uso único
  }
}
</script>

<template>
  <div>
    <div v-if="status === 'success'" class="card p-6 text-center" role="status">
      <p class="text-xl font-bold">Recebemos o seu contato.</p>
      <p class="mt-2 text-[var(--color-ink-soft)]">Nossa equipe retorna pelo WhatsApp em breve. Obrigado pelo interesse no AgendasPro.</p>
    </div>

    <form v-else class="card space-y-4 p-5 sm:p-6" novalidate @submit.prevent="submit">
      <div>
        <label :for="id('name')" class="field-label">Nome</label>
        <input
          :id="id('name')"
          v-model="form.name"
          class="field"
          type="text"
          name="name"
          autocomplete="name"
          :aria-invalid="Boolean(errors.name)"
          :aria-describedby="errors.name ? id('name-err') : undefined"
          required
        />
        <p v-if="errors.name" :id="id('name-err')" class="field-error">{{ errors.name }}</p>
      </div>

      <div>
        <label :for="id('whatsapp')" class="field-label">WhatsApp</label>
        <input
          :id="id('whatsapp')"
          :value="form.whatsapp"
          class="field"
          type="tel"
          name="whatsapp"
          inputmode="tel"
          autocomplete="tel-national"
          placeholder="(11) 91234-5678"
          :aria-invalid="Boolean(errors.whatsapp)"
          :aria-describedby="errors.whatsapp ? id('whatsapp-err') : undefined"
          required
          @input="onPhone"
        />
        <p v-if="errors.whatsapp" :id="id('whatsapp-err')" class="field-error">{{ errors.whatsapp }}</p>
      </div>

      <div>
        <label :for="id('email')" class="field-label">E-mail <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
        <input
          :id="id('email')"
          v-model="form.email"
          class="field"
          type="email"
          name="email"
          autocomplete="email"
          :aria-invalid="Boolean(errors.email)"
          :aria-describedby="errors.email ? id('email-err') : undefined"
        />
        <p v-if="errors.email" :id="id('email-err')" class="field-error">{{ errors.email }}</p>
      </div>

      <div>
        <label :for="id('segment')" class="field-label">Segmento do negócio</label>
        <select
          :id="id('segment')"
          v-model="form.segment"
          class="field"
          name="segment"
          :aria-invalid="Boolean(errors.segment)"
          :aria-describedby="errors.segment ? id('segment-err') : undefined"
          required
        >
          <option value="" disabled>Selecione</option>
          <option v-for="s in segments" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <p v-if="errors.segment" :id="id('segment-err')" class="field-error">{{ errors.segment }}</p>
      </div>

      <div>
        <label :for="id('message')" class="field-label">Mensagem <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
        <textarea :id="id('message')" v-model="form.message" class="field" name="message" rows="3" maxlength="1000" />
      </div>

      <div>
        <label class="flex items-start gap-3 text-sm">
          <input :id="id('consent')" v-model="form.consent" type="checkbox" class="mt-1 h-5 w-5 shrink-0" :aria-invalid="Boolean(errors.consent)" :aria-describedby="errors.consent ? id('consent-err') : undefined" />
          <span>
            Concordo em ser contatado(a) pelo AgendasPro por WhatsApp, e-mail ou telefone sobre este pedido, conforme a
            <RouterLink to="/privacidade" target="_blank" class="underline">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></RouterLink>.
          </span>
        </label>
        <p v-if="errors.consent" :id="id('consent-err')" class="field-error">{{ errors.consent }}</p>
      </div>

      <!-- Honeypot: invisível para pessoas e leitores de tela; robôs costumam preencher. -->
      <div aria-hidden="true" style="position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden">
        <label :for="id('website')">Não preencha este campo</label>
        <input :id="id('website')" v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <TurnstileWidget
        ref="turnstile"
        @token="((tsToken = $event), (turnstileFailed = false))"
        @expired="tsToken = ''"
        @error="((tsToken = ''), (turnstileFailed = true))"
      />

      <p v-if="status === 'error'" class="field-error" role="alert">{{ errorMsg }}</p>

      <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="loading || !tsToken" :aria-busy="loading">
        {{ loading ? 'Enviando...' : 'Quero conhecer o AgendasPro' }}
      </button>
      <p class="text-xs text-[var(--color-ink-soft)]">
        Usamos seus dados apenas para retornar este contato, conforme a
        <RouterLink to="/privacidade" class="underline">Política de Privacidade</RouterLink>.
      </p>
    </form>
  </div>
</template>
