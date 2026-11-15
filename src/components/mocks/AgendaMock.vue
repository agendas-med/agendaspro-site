<script setup>
// Ilustração (dados fictícios) da agenda por profissional. Decorativa.
const cols = [
  { name: 'Profissional A', slots: [['09:00', 'Consulta', 'bg-brand-100'], ['10:00', 'Retorno', 'bg-sky-100'], ['11:30', 'Bloqueado', 'bg-slate-200']] },
  { name: 'Profissional B', slots: [['09:30', 'Avaliação', 'bg-brand-100'], ['11:00', 'Procedimento', 'bg-amber-100']] },
]
</script>

<template>
  <div class="card overflow-hidden text-[13px]" role="img" aria-label="Ilustração de uma agenda com dois profissionais e horários marcados">
    <div class="flex items-center justify-between border-b border-[var(--color-line)] bg-slate-50 px-4 py-2.5 font-semibold">
      <span>Agenda do dia</span>
      <span class="text-[var(--color-ink-soft)]">Exemplo</span>
    </div>
    <div class="grid grid-cols-2 gap-px bg-[var(--color-line)]">
      <div v-for="c in cols" :key="c.name" class="bg-white p-3">
        <p class="mb-2 font-semibold">{{ c.name }}</p>
        <div v-for="s in c.slots" :key="s[0]" class="mb-2 rounded-lg px-2.5 py-2" :class="s[2]">
          <span class="font-semibold">{{ s[0] }}</span>
          <span class="ml-1 text-[var(--color-ink-soft)]">{{ s[1] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
