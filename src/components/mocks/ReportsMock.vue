<script setup>
// Ilustração (valores fictícios, sem unidade) de relatórios. Decorativa.
const bars = [40, 62, 48, 75, 58, 88, 70]
</script>

<template>
  <div class="card mx-auto w-full max-w-sm p-4 text-[13px]" role="img" aria-label="Ilustração de um gráfico de barras de agendamentos por semana">
    <p class="font-semibold">Agendamentos por dia (exemplo)</p>
    <div class="mt-3 flex h-28 items-end gap-2" aria-hidden="true">
      <span v-for="(b, i) in bars" :key="i" class="flex-1 rounded-t bg-brand-500" :style="{ height: b + '%' }" />
    </div>
    <div class="mt-3 flex justify-between text-[var(--color-ink-soft)]">
      <span>Compareceram</span><span>Faltaram</span><span>Cancelaram</span>
    </div>
  </div>
</template>
