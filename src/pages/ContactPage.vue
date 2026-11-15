<script setup>
import { useSeo } from '../composables/useSeo.js'
import { company } from '../config/company.js'
import AppIcon from '../components/ui/AppIcon.vue'
import SignupLink from '../components/ui/SignupLink.vue'
import WhatsappLink from '../components/ui/WhatsappLink.vue'
import LeadForm from '../components/forms/LeadForm.vue'

useSeo({
  title: 'Contato | AgendasPro',
  description: 'Fale com a equipe do AgendasPro pelo WhatsApp, e-mail ou deixe seu contato para receber retorno comercial.',
  path: '/contato',
})

const emailReady = !company.supportEmail.startsWith('[')
</script>

<template>
  <section class="section" aria-labelledby="contact-h1">
    <div class="container-x grid items-start gap-10 md:grid-cols-2">
      <div>
        <p class="eyebrow">Contato</p>
        <h1 id="contact-h1" class="mt-3 text-4xl">Vamos conversar sobre o seu negócio</h1>
        <p class="mt-4 text-lg text-[var(--color-ink-soft)]">Tire dúvidas sobre planos e recursos ou peça uma conversa com a nossa equipe. Respondemos em horário comercial.</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <WhatsappLink location="contact" large />
          <SignupLink location="contact" variant="outline" large>Criar conta grátis</SignupLink>
        </div>
        <ul class="mt-8 space-y-3 text-[var(--color-ink-soft)]">
          <li v-if="emailReady" class="flex items-center gap-2">
            <AppIcon name="mail" :size="20" class="text-brand-600" />
            <a :href="`mailto:${company.supportEmail}`" class="underline">{{ company.supportEmail }}</a>
          </li>
          <li class="text-sm">
            Para assuntos de privacidade e dados pessoais, veja a <RouterLink to="/privacidade" class="underline">Política de Privacidade</RouterLink>.
          </li>
          <li class="text-sm">
            Cliente de um estabelecimento e precisa remarcar ou cancelar? Use o link do seu agendamento, enviado por WhatsApp.
          </li>
        </ul>
      </div>
      <LeadForm id-prefix="contact-lead" location="contact" />
    </div>
  </section>
</template>
