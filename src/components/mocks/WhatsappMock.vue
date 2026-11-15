<script setup>
// Ilustração (conversa fictícia) de lembrete e de recepção com IA no WhatsApp. Decorativa.
defineProps({
  variant: { type: String, default: 'reminder' }, // reminder | ai
})
const reminder = [
  { from: 'bot', text: 'Olá! Lembrete: sua consulta é amanhã, às 15:00. Confirma presença?' },
  { from: 'me', text: 'Confirmo!' },
  { from: 'bot', text: 'Perfeito, horário confirmado. Até lá!' },
]
const ai = [
  { from: 'me', text: 'Oi, queria marcar um horário para sábado' },
  { from: 'bot', text: 'Claro! Tenho 09:00, 10:30 e 14:00 livres no sábado. Qual prefere?' },
  { from: 'me', text: '10:30' },
  { from: 'bot', text: 'Agendado para sábado, 10:30. Enviei o Pix do sinal.' },
]
</script>

<template>
  <div class="card mx-auto w-full max-w-sm overflow-hidden text-[13px]" role="img" aria-label="Ilustração de uma conversa de WhatsApp com mensagens automáticas de agendamento">
    <div class="bg-brand-700 px-4 py-2.5 font-semibold text-white">{{ variant === 'ai' ? 'Recepção 24h' : 'Seu Negócio' }}</div>
    <div class="space-y-2 bg-[#efeae2] p-3">
      <div v-for="(m, i) in variant === 'ai' ? ai : reminder" :key="i" class="flex" :class="m.from === 'me' && 'justify-end'">
        <p class="max-w-[80%] rounded-xl px-3 py-2 shadow-sm" :class="m.from === 'me' ? 'bg-[#d9fdd3]' : 'bg-white'">{{ m.text }}</p>
      </div>
    </div>
  </div>
</template>
