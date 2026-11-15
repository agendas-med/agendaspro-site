<script setup>
// Ilustração (dados fictícios) da página pública de agendamento. Decorativa.
const times = ['09:00', '09:30', '10:30', '14:00', '15:30', '16:00']
</script>

<template>
  <div class="card mx-auto w-full max-w-[17rem] overflow-hidden text-[13px]" role="img" aria-label="Ilustração da página pública de agendamento no celular">
    <div class="bg-brand-600 px-4 py-3 text-white">
      <p class="font-semibold">Seu Negócio</p>
      <p class="text-white/85">Escolha o horário</p>
    </div>
    <div class="space-y-3 p-4">
      <div class="rounded-lg border border-[var(--color-line)] px-3 py-2">Consulta de avaliação <span class="float-right text-[var(--color-ink-soft)]">40 min</span></div>
      <div class="flex gap-2">
        <span v-for="d in ['Seg 12', 'Ter 13', 'Qua 14']" :key="d" class="rounded-lg border px-2 py-1.5 font-medium" :class="d === 'Ter 13' ? 'border-brand-600 bg-brand-50' : 'border-[var(--color-line)]'">{{ d }}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <span v-for="t in times" :key="t" class="rounded-lg border py-1.5 text-center font-medium" :class="t === '10:30' ? 'border-brand-600 bg-brand-600 text-white' : 'border-[var(--color-line)]'">{{ t }}</span>
      </div>
      <div class="rounded-lg bg-brand-600 py-2 text-center font-semibold text-white">Continuar</div>
    </div>
  </div>
</template>
