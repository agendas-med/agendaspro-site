<script setup>
// Captura de lead dentro do chat (só audiência "empresa") -> POST /public/chat/lead via controlador.
// Consentimento LGPD explícito (checkbox desmarcado por padrão + link da política). Sem dado pessoal em URL.
import { onMounted, reactive, ref, watch } from 'vue'
import { niches } from '../../data/niches.js'
import { isValidWhatsappBR, maskPhoneBR, toE164BR } from '../../lib/phone.js'

defineProps({
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['submit', 'cancel'])

const form = reactive({ name: '', whatsapp: '', email: '', segment: '', message: '', consent: false })
const errors = reactive({ name: '', whatsapp: '', email: '', consent: '' })
const first = ref(null)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

onMounted(() => first.value?.focus())

// Some o erro de um campo assim que ele deixa de ser inválido (sem revalidar os demais).
watch(() => form.name, (v) => { if (errors.name && v.trim().length >= 2) errors.name = '' })
watch(() => form.whatsapp, (v) => { if (errors.whatsapp && isValidWhatsappBR(v)) errors.whatsapp = '' })
watch(() => form.email, (v) => { if (errors.email && (!v || EMAIL_RE.test(v.trim()))) errors.email = '' })
watch(() => form.consent, (v) => { if (v) errors.consent = '' })

function validate() {
  errors.name = form.name.trim().length >= 2 ? '' : 'Informe o seu nome.'
  errors.whatsapp = isValidWhatsappBR(form.whatsapp) ? '' : 'Informe um WhatsApp com DDD, ex.: (11) 91234-5678.'
  errors.email = !form.email || EMAIL_RE.test(form.email.trim()) ? '' : 'E-mail inválido (ou deixe em branco).'
  errors.consent = form.consent ? '' : 'É preciso concordar para a equipe entrar em contato.'
  return !errors.name && !errors.whatsapp && !errors.email && !errors.consent
}

function submit() {
  if (!validate()) {
    const k = ['name', 'whatsapp', 'email', 'consent'].find((x) => errors[x])
    document.getElementById(`chat-lead-${k}`)?.focus()
    return
  }
  emit('submit', {
    name: form.name.trim(),
    whatsapp: toE164BR(form.whatsapp),
    email: form.email.trim(),
    segment: form.segment,
    message: form.message.trim(),
    consent: true,
  })
}
</script>

<template>
  <form class="space-y-3 rounded-xl border border-line bg-white p-3 text-sm" novalidate aria-labelledby="chat-lead-title" @submit.prevent="submit">
    <h3 id="chat-lead-title" class="text-base font-semibold">Deixe seu contato</h3>
    <p class="text-xs text-[var(--color-ink-soft)]">Nossa equipe retorna pelo WhatsApp. Só pedimos o essencial.</p>

    <div>
      <label for="chat-lead-name" class="field-label">Nome</label>
      <input id="chat-lead-name" ref="first" v-model="form.name" class="field" type="text" autocomplete="name" maxlength="120" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'chat-lead-name-err' : undefined" />
      <p v-if="errors.name" id="chat-lead-name-err" class="field-error">{{ errors.name }}</p>
    </div>
    <div>
      <label for="chat-lead-whatsapp" class="field-label">WhatsApp</label>
      <input
        id="chat-lead-whatsapp"
        :value="form.whatsapp"
        class="field"
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        placeholder="(11) 91234-5678"
        :aria-invalid="Boolean(errors.whatsapp)"
        :aria-describedby="errors.whatsapp ? 'chat-lead-whatsapp-err' : undefined"
        @input="form.whatsapp = maskPhoneBR($event.target.value)"
      />
      <p v-if="errors.whatsapp" id="chat-lead-whatsapp-err" class="field-error">{{ errors.whatsapp }}</p>
    </div>
    <div>
      <label for="chat-lead-email" class="field-label">E-mail <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
      <input id="chat-lead-email" v-model="form.email" class="field" type="email" autocomplete="email" maxlength="160" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'chat-lead-email-err' : undefined" />
      <p v-if="errors.email" id="chat-lead-email-err" class="field-error">{{ errors.email }}</p>
    </div>
    <div>
      <label for="chat-lead-segment" class="field-label">Segmento <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
      <select id="chat-lead-segment" v-model="form.segment" class="field">
        <option value="">Prefiro não informar</option>
        <option v-for="n in niches" :key="n.slug" :value="n.name">{{ n.name }}</option>
        <option value="Outro segmento">Outro segmento</option>
      </select>
    </div>
    <div>
      <label for="chat-lead-message" class="field-label">Recado <span class="font-normal text-[var(--color-ink-soft)]">(opcional)</span></label>
      <textarea id="chat-lead-message" v-model="form.message" class="field" rows="2" maxlength="500" />
    </div>

    <div>
      <label class="flex items-start gap-2 text-xs">
        <input
          id="chat-lead-consent"
          v-model="form.consent"
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
          :aria-invalid="Boolean(errors.consent)"
          :aria-describedby="errors.consent ? 'chat-lead-consent-err' : undefined"
        />
        <span>
          Concordo em ser contatado pelo AgendasPro e com o tratamento dos meus dados conforme a
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" class="font-medium text-brand-700 underline">Política de Privacidade</a>.
        </span>
      </label>
      <p v-if="errors.consent" id="chat-lead-consent-err" class="field-error">{{ errors.consent }}</p>
    </div>

    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <div class="flex gap-2">
      <button type="submit" class="btn btn-primary flex-1" :disabled="busy" :aria-busy="busy">{{ busy ? 'Enviando…' : 'Enviar contato' }}</button>
      <button type="button" class="btn btn-outline" :disabled="busy" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
